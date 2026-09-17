import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
    collection, query, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
    getDocs, writeBatch, collectionGroup,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { getVendorSpecialties } from '@/utils/vendorSpecialty'

export const useWorkCategoriesStore = defineStore('workCategories', () => {
    const categories = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'workCategories'), orderBy('createdAt'))
        unsubscribe = onSnapshot(q, snap => {
            categories.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
    }

    const categoryNames = computed(() => categories.value.map(c => c.name))

    async function addCategory(name) {
        return addDoc(collection(db, 'workCategories'), { name, createdAt: serverTimestamp() })
    }

    async function countUsage(name) {
        const [vendorsSnap, casesSnap, bidRequestsSnap] = await Promise.all([
            getDocs(collection(db, 'vendors')),
            getDocs(collection(db, 'cases')),
            getDocs(collectionGroup(db, 'bidRequests')),
        ])
        const vendorCount = vendorsSnap.docs.filter(d => getVendorSpecialties(d.data()).includes(name)).length
        const workTypeCount = casesSnap.docs.reduce((sum, d) => {
            const workTypes = d.data().workTypes || []
            return sum + workTypes.filter(wt => wt.name === name).length
        }, 0)
        const bidRequestCount = bidRequestsSnap.docs.filter(d => d.data().workCategory === name).length
        return { vendorCount, workTypeCount, bidRequestCount }
    }

    async function renameCategory(id, oldName, newName) {
        const [vendorsSnap, casesSnap, bidRequestsSnap] = await Promise.all([
            getDocs(collection(db, 'vendors')),
            getDocs(collection(db, 'cases')),
            getDocs(collectionGroup(db, 'bidRequests')),
        ])

        const batch = writeBatch(db)
        batch.update(doc(db, 'workCategories', id), { name: newName })

        let vendorCount = 0
        for (const vendorDoc of vendorsSnap.docs) {
            const data = vendorDoc.data()
            const specialties = getVendorSpecialties(data)
            if (!specialties.includes(oldName)) continue
            if (Array.isArray(data.specialties) && data.specialties.length > 0) {
                batch.update(vendorDoc.ref, { specialties: data.specialties.map(s => s === oldName ? newName : s) })
            } else {
                batch.update(vendorDoc.ref, { specialty: newName })
            }
            vendorCount++
        }

        let workTypeCount = 0
        for (const caseDoc of casesSnap.docs) {
            const workTypes = caseDoc.data().workTypes || []
            const matched = workTypes.filter(wt => wt.name === oldName).length
            if (matched > 0) {
                batch.update(caseDoc.ref, { workTypes: workTypes.map(wt => wt.name === oldName ? { ...wt, name: newName } : wt) })
                workTypeCount += matched
            }
        }

        let bidRequestCount = 0
        for (const bidDoc of bidRequestsSnap.docs) {
            if (bidDoc.data().workCategory === oldName) {
                batch.update(bidDoc.ref, { workCategory: newName })
                bidRequestCount++
            }
        }

        await batch.commit()
        return { vendorCount, workTypeCount, bidRequestCount }
    }

    async function deleteCategory(id, name) {
        const usage = await countUsage(name)
        if (usage.vendorCount > 0 || usage.workTypeCount > 0 || usage.bidRequestCount > 0) {
            return { deleted: false, usage }
        }
        await deleteDoc(doc(db, 'workCategories', id))
        return { deleted: true, usage }
    }

    return {
        categories, categoryNames,
        subscribe, cleanup,
        addCategory, countUsage, renameCategory, deleteCategory,
    }
})
