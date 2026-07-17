import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useCasesStore = defineStore('cases', () => {
    const cases = ref([])
    let unsubscribe = null

    function subscribe(companyIds) {
        const valid = (companyIds ?? []).filter(Boolean)
        if (valid.length === 0) return
        if (unsubscribe) unsubscribe()
        const q = query(
            collection(db, 'cases'),
            where('companyId', 'in', valid),
            orderBy('createdAt', 'desc')
        )
        unsubscribe = onSnapshot(q, (snap) => {
            cases.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    function casesByStatus(status, companyId) {
        return cases.value.filter(c =>
            c.status === status && (companyId == null || c.companyId === companyId)
        )
    }

    function statusCount(status, companyId) {
        return casesByStatus(status, companyId).length
    }

    const activeCases = computed(() =>
        cases.value.filter(c => !['completed', 'lost'].includes(c.status))
    )

    async function addCase(data) {
        return addDoc(collection(db, 'cases'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateCase(id, data) {
        const patch = { ...data, updatedAt: serverTimestamp() }
        if (data.status === 'completed') {
            const existing = cases.value.find(c => c.id === id)
            if (existing?.status !== 'completed') patch.completedAt = serverTimestamp()
        }
        return updateDoc(doc(db, 'cases', id), patch)
    }

    async function deleteCase(id) {
        const [taskSnap, bidRequestSnap, photoSnap, progressNotesSnap, reviewsSnap, paymentRemindersSnap] = await Promise.all([
            getDocs(collection(db, 'cases', id, 'tasks')),
            getDocs(collection(db, 'cases', id, 'bidRequests')),
            getDocs(collection(db, 'cases', id, 'photos')),
            getDocs(collection(db, 'cases', id, 'progressNotes')),
            getDocs(collection(db, 'cases', id, 'reviews')),
            getDocs(query(collection(db, 'paymentReminders'), where('caseId', '==', id))),
        ])
        await Promise.all([
            ...taskSnap.docs.map(d => deleteDoc(d.ref)),
            ...bidRequestSnap.docs.map(d => deleteDoc(d.ref)),
            ...photoSnap.docs.map(d => deleteDoc(d.ref)),
            ...progressNotesSnap.docs.map(d => deleteDoc(d.ref)),
            ...reviewsSnap.docs.map(d => deleteDoc(d.ref)),
            ...paymentRemindersSnap.docs.map(d => deleteDoc(d.ref)),
        ])
        await deleteDoc(doc(db, 'cases', id))
    }

    return { cases, activeCases, subscribe, casesByStatus, statusCount, addCase, updateCase, deleteCase }
})
