import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useExpenseItemsStore = defineStore('expenseItems', () => {
    const expenseItems = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'expenseItems'), orderBy('name'))
        unsubscribe = onSnapshot(q, snap => {
            expenseItems.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addExpenseItem(data) {
        return addDoc(collection(db, 'expenseItems'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateExpenseItem(id, data) {
        return updateDoc(doc(db, 'expenseItems', id), data)
    }

    async function deleteExpenseItem(id) {
        return deleteDoc(doc(db, 'expenseItems', id))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { expenseItems, subscribe, addExpenseItem, updateExpenseItem, deleteExpenseItem, cleanup }
})
