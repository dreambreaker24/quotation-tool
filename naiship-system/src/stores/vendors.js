import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useVendorsStore = defineStore('vendors', () => {
    const vendors = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'vendors'), orderBy('name'))
        unsubscribe = onSnapshot(q, snap => {
            vendors.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addVendor(data) {
        return addDoc(collection(db, 'vendors'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateVendor(id, data) {
        return updateDoc(doc(db, 'vendors', id), data)
    }

    async function deleteVendor(id) {
        return deleteDoc(doc(db, 'vendors', id))
    }

    async function deleteVendorAndCascade(vendorId) {
        const snap = await getDocs(collection(db, 'cases'))
        const updates = []
        snap.docs.forEach(caseDoc => {
            const data = caseDoc.data()
            if (data.workTypes?.some(wt => wt.vendorId === vendorId)) {
                const updated = data.workTypes.map(wt =>
                    wt.vendorId === vendorId ? { ...wt, vendorId: '', vendorName: '' } : wt
                )
                updates.push(updateDoc(doc(db, 'cases', caseDoc.id), { workTypes: updated }))
            }
        })
        await Promise.all(updates)
        return deleteDoc(doc(db, 'vendors', vendorId))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { vendors, subscribe, addVendor, updateVendor, deleteVendor, deleteVendorAndCascade, cleanup }
})
