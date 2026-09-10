import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useCalendarEventsStore = defineStore('calendarEvents', () => {
    const events = ref([])
    let unsubscribe = null

    function subscribe(companyIdOrIds, year, month) {
        if (unsubscribe) unsubscribe()
        const ids = Array.isArray(companyIdOrIds) ? companyIdOrIds : [companyIdOrIds]
        const firstOfMonth = new Date(year, month, 1)
        const startOffset = (firstOfMonth.getDay() + 6) % 7
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const nextDays = (7 - (startOffset + daysInMonth) % 7) % 7
        const start = new Date(year, month, 1 - startOffset)
        const end = new Date(year, month + 1, nextDays, 23, 59, 59)
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

    async function addEvent(data, dedupeId = null) {
        const payload = { ...data, createdAt: serverTimestamp() }
        if (dedupeId) {
            return setDoc(doc(db, 'calendarEvents', dedupeId), payload)
        }
        return addDoc(collection(db, 'calendarEvents'), payload)
    }

    async function updateEvent(id, data) {
        return updateDoc(doc(db, 'calendarEvents', id), data)
    }

    async function deleteEvent(id) {
        return deleteDoc(doc(db, 'calendarEvents', id))
    }

    async function fetchMonthlyLeave(year, month) {
        const y = year ?? new Date().getFullYear()
        const m = month != null ? month : new Date().getMonth()
        const start = Timestamp.fromDate(new Date(y, m, 1))
        const end = Timestamp.fromDate(new Date(y, m + 1, 0, 23, 59, 59))
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

    async function fetchMonthlyLeaveDetail(year, month, name) {
        const y = year ?? new Date().getFullYear()
        const m = month != null ? month : new Date().getMonth()
        const start = Timestamp.fromDate(new Date(y, m, 1))
        const end = Timestamp.fromDate(new Date(y, m + 1, 0, 23, 59, 59))
        const q = query(
            collection(db, 'calendarEvents'),
            where('date', '>=', start),
            where('date', '<=', end)
        )
        const snap = await getDocs(q)
        const entries = []
        snap.docs.forEach(d => {
            const data = d.data()
            if (data.type !== 'leave' || data.personName !== name) return
            entries.push({
                id: d.id,
                date: data.date?.toDate?.() ?? null,
                leaveType: data.leaveType || '',
                hours: data.hours || 0,
                leaveTypeLocked: data.leaveTypeLocked || false,
                convertedFromLeaveType: data.convertedFromLeaveType || '',
                compConsumption: data.compConsumption || [],
            })
        })
        return entries.sort((a, b) => (a.date ?? 0) - (b.date ?? 0))
    }

    // 查詢某人「所有」請假事件（不限月份），供 CalendarTab.vue 新增/編輯請假前的重疊檢查使用。
    // 之所以不限月份範圍：請假的 date 欄位可能落在跟目前行事曆檢視畫面不同的月份（例如編輯6月建立、
    // 8月生效的請假），只用 personName 過濾、日期重疊判斷交給呼叫端的 findOverlappingLeave 處理。
    async function fetchLeaveEventsByPerson(personName) {
        const q = query(
            collection(db, 'calendarEvents'),
            where('type', '==', 'leave'),
            where('personName', '==', personName)
        )
        const snap = await getDocs(q)
        return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    }

    function cleanup() {
        if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
        }
        events.value = []
    }

    return { events, subscribe, addEvent, updateEvent, deleteEvent, fetchMonthlyLeave, fetchMonthlyLeaveDetail, fetchLeaveEventsByPerson, cleanup }
})
