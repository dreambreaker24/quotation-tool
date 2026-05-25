import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useTodosStore = defineStore('todos', () => {
    const todos = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) return
        const q = query(collection(db, 'todos'))
        unsubscribe = onSnapshot(q, snap => {
            todos.value = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    const ta = a.createdAt?.toMillis?.() ?? 0
                    const tb = b.createdAt?.toMillis?.() ?? 0
                    return tb - ta
                })
        })
    }

    async function addTodo(text, uid) {
        return addDoc(collection(db, 'todos'), { text, done: false, createdBy: uid, createdAt: serverTimestamp() })
    }

    async function updateTodo(id, data) {
        return updateDoc(doc(db, 'todos', id), data)
    }

    async function deleteTodo(id) {
        return deleteDoc(doc(db, 'todos', id))
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        todos.value = []
    }

    return { todos, subscribe, addTodo, updateTodo, deleteTodo, cleanup }
})
