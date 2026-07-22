import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/firebase'

export const useLineRecipientsStore = defineStore('lineRecipients', () => {
    const recipients = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'lineRecipients'), orderBy('followedAt', 'desc'))
        unsubscribe = onSnapshot(q, snap => {
            recipients.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function updateRecipient(id, data) {
        return updateDoc(doc(db, 'lineRecipients', id), data)
    }

    async function deleteRecipient(id) {
        return deleteDoc(doc(db, 'lineRecipients', id))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { recipients, subscribe, updateRecipient, deleteRecipient, cleanup }
})
