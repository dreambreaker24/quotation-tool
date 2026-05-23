import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useCalendarEventsStore = defineStore('calendarEvents', () => {
    const events = ref([])
    let unsubscribe = null

    function subscribe(companyId, year, month) {
        if (unsubscribe) unsubscribe()
        const start = new Date(year, month, 1)
        const end = new Date(year, month + 1, 0, 23, 59, 59)
        const q = query(
            collection(db, 'calendarEvents'),
            where('companyId', '==', companyId),
            where('date', '>=', Timestamp.fromDate(start)),
            where('date', '<=', Timestamp.fromDate(end)),
            orderBy('date')
        )
        unsubscribe = onSnapshot(q, snap => {
            events.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addEvent(data) {
        return addDoc(collection(db, 'calendarEvents'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateEvent(id, data) {
        return updateDoc(doc(db, 'calendarEvents', id), data)
    }

    async function deleteEvent(id) {
        return deleteDoc(doc(db, 'calendarEvents', id))
    }

    function cleanup() {
        if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
        }
        events.value = []
    }

    return { events, subscribe, addEvent, updateEvent, deleteEvent, cleanup }
})
