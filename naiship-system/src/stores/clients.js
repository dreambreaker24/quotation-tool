import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useClientsStore = defineStore('clients', () => {
    const clients = ref([])
    let unsubscribe = null

    function subscribe(companyIds) {
        const valid = (companyIds ?? []).filter(Boolean)
        if (valid.length === 0) return
        if (unsubscribe) unsubscribe()
        const q = query(
            collection(db, 'clients'),
            where('companyId', 'in', valid),
            orderBy('createdAt', 'desc')
        )
        unsubscribe = onSnapshot(q, snap => {
            clients.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addClient(data) {
        return addDoc(collection(db, 'clients'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateClient(id, data) {
        return updateDoc(doc(db, 'clients', id), data)
    }

    async function addNote(clientId, content, attachments, userId) {
        return addDoc(collection(db, 'clients', clientId, 'notes'), {
            content, attachments, createdBy: userId, createdAt: serverTimestamp()
        })
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        clients.value = []
    }

    return { clients, subscribe, addClient, updateClient, addNote, cleanup }
})
