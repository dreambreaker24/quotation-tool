import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useCaseTasksStore = defineStore('caseTasks', () => {
    const tasks = ref([])
    let unsubscribe = null

    function subscribe(caseId) {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        tasks.value = []
        if (!caseId) return
        const q = query(
            collection(db, 'cases', caseId, 'tasks'),
            orderBy('createdAt', 'asc')
        )
        unsubscribe = onSnapshot(q, snap => {
            tasks.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addTask(caseId, type, content, creatorName, createdBy, attachments = []) {
        return addDoc(collection(db, 'cases', caseId, 'tasks'), {
            type, content, creatorName, createdBy, attachments, createdAt: serverTimestamp()
        })
    }

    async function updateTask(caseId, taskId, content, attachments) {
        const data = { content }
        if (attachments !== undefined) data.attachments = attachments
        return updateDoc(doc(db, 'cases', caseId, 'tasks', taskId), data)
    }

    async function toggleDone(caseId, taskId, done, doneByEmail = '') {
        const update = { done, doneByEmail: done ? doneByEmail : '' }
        return updateDoc(doc(db, 'cases', caseId, 'tasks', taskId), update)
    }

    async function deleteTask(caseId, taskId) {
        return deleteDoc(doc(db, 'cases', caseId, 'tasks', taskId))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { tasks, subscribe, addTask, updateTask, toggleDone, deleteTask, cleanup }
})
