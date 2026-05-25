import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useCalendarEventsStore = defineStore('calendarEvents', () => {
    const events = ref([])
    let unsubscribe = null

    function subscribe(companyIdOrIds, year, month) {
        if (unsubscribe) unsubscribe()
        const ids = Array.isArray(companyIdOrIds) ? companyIdOrIds : [companyIdOrIds]
        const start = new Date(year, month, 1)
        const end = new Date(year, month + 1, 0, 23, 59, 59)
        const q = query(
            collection(db, 'calendarEvents'),
            where('companyId', 'in', ids),
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

    async function fetchMonthlyLeave() {
        const now = new Date()
        const start = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))
        const end = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59))
        const q = query(
            collection(db, 'calendarEvents'),
            where('date', '>=', start),
            where('date', '<=', end)
        )
        const snap = await getDocs(q)
        const result = {}
        snap.docs.forEach(d => {
            const data = d.data()
            if (data.type !== 'leave') return
            const name = data.personName || ''
            if (!name) return
            result[name] = (result[name] || 0) + (data.hours || 0)
        })
        return result
    }

    function cleanup() {
        if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
        }
        events.value = []
    }

    return { events, subscribe, addEvent, updateEvent, deleteEvent, fetchMonthlyLeave, cleanup }
})
