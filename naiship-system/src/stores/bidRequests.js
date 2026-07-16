import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, doc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '@/firebase'
import { WT_COLORS } from '@/constants/workTypeColors'

export function buildWinningWorkType(bidRequest, winningBidId, existingWorkTypesCount, finalVendor, finalWorkCategory) {
    const winner = (bidRequest.bids || []).find(b => b.id === winningBidId)
    if (!winner) throw new Error('winning bid not found')
    if (!finalVendor?.vendorId) throw new Error('finalVendor with vendorId is required')
    const resolvedCategory = finalWorkCategory || ''
    return {
        id: `wt_${Date.now()}`,
        name: resolvedCategory || bidRequest.category,
        vendorId: finalVendor.vendorId,
        vendorName: finalVendor.vendorName,
        startDate: '',
        endDate: '',
        hasQuote: true,
        hasSchedule: false,
        vendorCostItems: winner.quoteAmount > 0
            ? [{ id: `vc_${Date.now()}`, description: bidRequest.category, amount: winner.quoteAmount, note: winner.note || '' }]
            : [],
        vendorCostFree: false,
        costIncludesTax: winner.includesTax || false,
        color: WT_COLORS[existingWorkTypesCount % WT_COLORS.length],
        vendorPayments: [],
        done: false,
        invoiceReceived: false,
        locations: [],
        customName: !resolvedCategory,
    }
}

export const useBidRequestsStore = defineStore('bidRequests', () => {
    const bidRequests = ref([])
    let unsubscribe = null

    function subscribe(caseId) {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        bidRequests.value = []
        if (!caseId) return
        const q = query(collection(db, 'cases', caseId, 'bidRequests'), orderBy('createdAt', 'asc'))
        unsubscribe = onSnapshot(q, snap => {
            bidRequests.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    async function addBidRequest(caseId, category, workCategory, note, createdBy) {
        return addDoc(collection(db, 'cases', caseId, 'bidRequests'), {
            category, workCategory: workCategory || '', note: note || '', status: 'open', bids: [],
            createdBy, createdAt: serverTimestamp(),
        })
    }

    async function addBid(caseId, bidRequestId, bidData) {
        const newBid = { id: `bid_${Date.now()}`, quotePhotoIds: [], submittedAt: new Date().toISOString(), ...bidData }
        await updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), {
            bids: arrayUnion(newBid),
        })
        return newBid.id
    }

    async function appendQuotePhotoId(caseId, bidRequestId, bidEntryId, photoId) {
        const br = bidRequests.value.find(b => b.id === bidRequestId)
        if (!br) return
        const updatedBids = (br.bids || []).map(b =>
            b.id === bidEntryId ? { ...b, quotePhotoIds: [...(b.quotePhotoIds || []), photoId] } : b
        )
        await updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), { bids: updatedBids })
    }

    async function removeQuotePhotoId(caseId, bidRequestId, bidEntryId, photoId) {
        await deleteDoc(doc(db, 'cases', caseId, 'photos', photoId))
        const br = bidRequests.value.find(b => b.id === bidRequestId)
        if (!br) return
        const updatedBids = (br.bids || []).map(b =>
            b.id === bidEntryId ? { ...b, quotePhotoIds: (b.quotePhotoIds || []).filter(id => id !== photoId) } : b
        )
        await updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), { bids: updatedBids })
    }

    async function updateBid(caseId, bidRequestId, bidEntryId, updatedData) {
        const br = bidRequests.value.find(b => b.id === bidRequestId)
        if (!br) return
        const updatedBids = (br.bids || []).map(b => b.id === bidEntryId ? { ...b, ...updatedData } : b)
        await updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), { bids: updatedBids })
    }

    async function removeBid(caseId, bidRequestId, bidEntryId) {
        const photoSnap = await getDocs(query(
            collection(db, 'cases', caseId, 'photos'),
            where('bidRequestId', '==', bidRequestId),
            where('bidEntryId', '==', bidEntryId),
        ))
        await Promise.all(photoSnap.docs.map(d => deleteDoc(d.ref)))
        const br = bidRequests.value.find(b => b.id === bidRequestId)
        if (!br) return
        const updatedBids = (br.bids || []).filter(b => b.id !== bidEntryId)
        await updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), { bids: updatedBids })
    }

    async function markConverted(caseId, bidRequestId, winningBidId, convertedWorkTypeId) {
        return updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), {
            status: 'converted', winningBidId, convertedWorkTypeId,
        })
    }

    async function repointQuotePhotos(caseId, photoIds, workTypeId) {
        await Promise.all((photoIds || []).map(pid =>
            updateDoc(doc(db, 'cases', caseId, 'photos', pid), { type: 'vendor_quote', workTypeId })
        ))
    }

    async function deleteBidRequest(caseId, bidRequestId) {
        const photoSnap = await getDocs(query(collection(db, 'cases', caseId, 'photos'), where('bidRequestId', '==', bidRequestId)))
        await Promise.all(photoSnap.docs.map(d => deleteDoc(d.ref)))
        await deleteDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId))
    }

    return {
        bidRequests, subscribe, cleanup,
        addBidRequest, addBid, updateBid, removeBid, appendQuotePhotoId, removeQuotePhotoId,
        markConverted, repointQuotePhotos, deleteBidRequest,
    }
})
