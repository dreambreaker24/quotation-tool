import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, getDocs, doc, serverTimestamp, Timestamp, arrayUnion, increment } from 'firebase/firestore'
import { db } from '@/firebase'

export const useWorkLogsStore = defineStore('workLogs', () => {
    const logs = ref([])
    const pendingLogs = ref([])
    let unsubscribe = null
    let pendingUnsub = null

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

    function subscribePending() {
        if (pendingUnsub) return
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 30)
        const q = query(
            collection(db, 'workLogs'),
            where('date', '>=', Timestamp.fromDate(cutoff))
        )
        pendingUnsub = onSnapshot(q, snap => {
            pendingLogs.value = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(log =>
                    (log.fuelExpenses?.length && log.fuelApproved === false) ||
                    (log.overtimeItems?.length && log.overtimeApproved === false)
                )
        })
    }

    function cleanupPending() {
        if (pendingUnsub) { pendingUnsub(); pendingUnsub = null }
        pendingLogs.value = []
    }

    async function addLog(data) {
        return addDoc(collection(db, 'workLogs'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateLog(logId, data) {
        return updateDoc(doc(db, 'workLogs', logId), { ...data, updatedAt: serverTimestamp() })
    }

    async function addReply(logId, content, userId, userName) {
        const reply = {
            id: Date.now().toString(),
            content,
            createdBy: userId,
            creatorName: userName ?? '',
            createdAt: Timestamp.fromDate(new Date())
        }
        return updateDoc(doc(db, 'workLogs', logId), { replies: arrayUnion(reply) })
    }

    async function approveFuel(logId, approverName) {
        return updateDoc(doc(db, 'workLogs', logId), {
            fuelApproved: true,
            fuelApprovedBy: approverName,
            fuelApprovedAt: serverTimestamp(),
        })
    }

    async function approveOvertime(logId, approverName, userId, overtimeHours) {
        const ops = [
            updateDoc(doc(db, 'workLogs', logId), {
                overtimeApproved: true,
                overtimeApprovedBy: approverName,
                overtimeApprovedAt: serverTimestamp(),
            })
        ]
        if (userId && overtimeHours > 0) {
            ops.push(updateDoc(doc(db, 'users', userId), { compensatoryHours: increment(overtimeHours) }))
        }
        await Promise.all(ops)
    }

    async function fetchMonthlyKm() {
        const now = new Date()
        const start = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))
        const end = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))
        const q = query(collection(db, 'workLogs'), where('date', '>=', start), where('date', '<=', end))
        const snap = await getDocs(q)
        const km = {}
        snap.docs.forEach(d => {
            const data = d.data()
            const name = data.userName
            if (!name) return
            const approved = data.fuelApproved !== false  // undefined = backward compat = approved
            if (!approved) return
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

    async function fetchMonthlyOvertimeHours() {
        const now = new Date()
        const start = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))
        const end = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))
        const q = query(collection(db, 'workLogs'), where('date', '>=', start), where('date', '<=', end))
        const snap = await getDocs(q)
        const hours = {}
        snap.docs.forEach(d => {
            const data = d.data()
            const name = data.userName
            if (!name || !data.overtimeApproved || !Array.isArray(data.overtimeItems)) return
            const total = data.overtimeItems.reduce((s, i) => s + (i.hours || 0), 0)
            if (total > 0) hours[name] = (hours[name] || 0) + total
        })
        return hours
    }

    async function fetchMonthlyAttendance() {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const q = query(collection(db, 'workLogs'), where('date', '>=', Timestamp.fromDate(startOfMonth)))
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

    return {
        logs, pendingLogs,
        subscribe, subscribePending, cleanupPending,
        addLog, updateLog, addReply,
        approveFuel, approveOvertime,
        fetchMonthlyKm, fetchMonthlyOvertimeHours, fetchMonthlyAttendance,
        unsubscribe: cleanup
    }
})
