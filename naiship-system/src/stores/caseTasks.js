import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
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

    async function addTask(caseId, type, content, creatorName, createdBy) {
        return addDoc(collection(db, 'cases', caseId, 'tasks'), {
            type, content, creatorName, createdBy, createdAt: serverTimestamp()
        })
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { tasks, subscribe, addTask, cleanup }
})
