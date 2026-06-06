import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useCaseProgressNotesStore = defineStore('caseProgressNotes', () => {
    const notes = ref([])
    let unsubscribe = null

    function subscribe(caseId) {
        if (!caseId) return
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        notes.value = []
        const q = query(
            collection(db, 'cases', caseId, 'progressNotes'),
            orderBy('createdAt', 'asc')
        )
        unsubscribe = onSnapshot(q, snap => {
            notes.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        notes.value = []
    }

    async function addNote(caseId, { text, authorId, authorName, attachments = [] }) {
        const ref = await addDoc(
            collection(db, 'cases', caseId, 'progressNotes'),
            { text, authorId, authorName, attachments, createdAt: serverTimestamp() }
        )
        await updateDoc(doc(db, 'cases', caseId), {
            latestNote: { text, authorName, updatedAt: serverTimestamp() }
        })
        return ref
    }

    async function updateNote(caseId, noteId, { text, attachments }) {
        return await updateDoc(
            doc(db, 'cases', caseId, 'progressNotes', noteId),
            { text, attachments, updatedAt: serverTimestamp() }
        )
    }

    return { notes, subscribe, cleanup, addNote, updateNote }
})
