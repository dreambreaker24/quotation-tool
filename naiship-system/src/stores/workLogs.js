import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useWorkLogsStore = defineStore('workLogs', () => {
    const logs = ref([])
    let unsubscribe = null

    function subscribe(companyId, date, endDate) {
        if (unsubscribe) unsubscribe()
        const start = new Date(date); start.setHours(0, 0, 0, 0)
        const end = endDate ? new Date(endDate) : new Date(date)
        end.setHours(23, 59, 59, 999)
        const q = query(
            collection(db, 'workLogs'),
            where('companyId', '==', companyId),
            where('date', '>=', start),
            where('date', '<=', end),
            orderBy('date')
        )
        unsubscribe = onSnapshot(q, snap => {
            logs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addLog(data) {
        return addDoc(collection(db, 'workLogs'), { ...data, createdAt: serverTimestamp() })
    }

    async function addReply(logId, content, userId, userName) {
        return addDoc(collection(db, 'workLogs', logId, 'replies'), {
            content, createdBy: userId, creatorName: userName ?? '', createdAt: serverTimestamp()
        })
    }

    async function fetchMonthlyKm() {
        const now = new Date()
        const start = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))
        const end = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))
        const q = query(
            collection(db, 'workLogs'),
            where('date', '>=', start),
            where('date', '<=', end)
        )
        const snap = await getDocs(q)
        const km = {}
        snap.docs.forEach(d => {
            const data = d.data()
            const name = data.userName
            if (!name) return
            let total = 0
            if (Array.isArray(data.fuelExpenses)) {
                data.fuelExpenses.forEach(f => { total += f.distance || 0 })
            } else if (data.fuelExpense?.distance) {
                total += data.fuelExpense.distance
            }
            if (total > 0) km[name] = (km[name] || 0) + total
        })
        return km
    }

    async function fetchMonthlyAttendance() {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const q = query(
            collection(db, 'workLogs'),
            where('date', '>=', Timestamp.fromDate(startOfMonth))
        )
        const snap = await getDocs(q)
        const map = {}
        snap.docs.forEach(d => {
            const data = d.data()
            const name = data.userName
            if (!map[name]) map[name] = new Set()
            const date = data.date?.toDate?.()
            if (date) map[name].add(date.toDateString())
        })
        const result = {}
        Object.entries(map).forEach(([name, days]) => { result[name] = days.size })
        return result
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { logs, subscribe, addLog, addReply, fetchMonthlyKm, fetchMonthlyAttendance, unsubscribe: cleanup }
})
