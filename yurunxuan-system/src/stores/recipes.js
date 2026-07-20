import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useRecipesStore = defineStore('recipes', () => {
    const recipes = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'recipes'), orderBy('name'))
        unsubscribe = onSnapshot(q, snap => {
            recipes.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addRecipe(data) {
        return addDoc(collection(db, 'recipes'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateRecipe(id, data) {
        return updateDoc(doc(db, 'recipes', id), data)
    }

    async function deleteRecipe(id) {
        return deleteDoc(doc(db, 'recipes', id))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { recipes, subscribe, addRecipe, updateRecipe, deleteRecipe, cleanup }
})
