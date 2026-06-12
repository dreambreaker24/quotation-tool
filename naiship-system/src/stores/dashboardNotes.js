import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useDashboardNotesStore = defineStore('dashboardNotes', () => {
    const notes = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        const q = query(collection(db, 'dashboardNotes'), orderBy('createdAt', 'asc'))
        unsubscribe = onSnapshot(q, snap => {
            notes.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        notes.value = []
    }

    async function addNote({ content, authorId, authorName, attachments = [] }) {
        return await addDoc(collection(db, 'dashboardNotes'), {
            content, authorId, authorName, attachments, createdAt: serverTimestamp()
        })
    }

    async function updateNote(id, { content, attachments }) {
        await updateDoc(doc(db, 'dashboardNotes', id), {
            content, attachments, updatedAt: serverTimestamp()
        })
    }

    async function deleteNote(id) {
        await deleteDoc(doc(db, 'dashboardNotes', id))
    }

    return { notes, subscribe, cleanup, addNote, updateNote, deleteNote }
})
