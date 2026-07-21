import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useMonthlyExpensesStore = defineStore('monthlyExpenses', () => {
    const monthlyExpenses = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'monthlyExpenses'), orderBy('date', 'desc'))
        unsubscribe = onSnapshot(q, snap => {
            monthlyExpenses.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addMonthlyExpense(data) {
        return addDoc(collection(db, 'monthlyExpenses'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateMonthlyExpense(id, data) {
        return updateDoc(doc(db, 'monthlyExpenses', id), data)
    }

    async function deleteMonthlyExpense(id) {
        return deleteDoc(doc(db, 'monthlyExpenses', id))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { monthlyExpenses, subscribe, addMonthlyExpense, updateMonthlyExpense, deleteMonthlyExpense, cleanup }
})
