import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useMaterialsStore = defineStore('materials', () => {
    const materials = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'materials'), orderBy('name'))
        unsubscribe = onSnapshot(q, snap => {
            materials.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addMaterial(data) {
        return addDoc(collection(db, 'materials'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateMaterial(id, data) {
        return updateDoc(doc(db, 'materials', id), data)
    }

    async function deleteMaterial(id) {
        return deleteDoc(doc(db, 'materials', id))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { materials, subscribe, addMaterial, updateMaterial, deleteMaterial, cleanup }
})
