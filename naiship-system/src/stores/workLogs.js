import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, getDocs, doc, serverTimestamp, Timestamp, arrayUnion, increment } from 'firebase/firestore'
import { db } from '@/firebase'
import { useUsersStore } from '@/stores/users'

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
                    (log.overtimeItems?.length && log.overtimeItems.some(i => i.approved == null))
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

    async function approveOvertimeItem(log, itemIndex, isApproved, approverName) {
        const prevItems = log.overtimeItems ?? []
        const prevItem = prevItems[itemIndex]
        const updatedItems = prevItems.map((item, i) =>
            i === itemIndex ? { ...item, approved: isApproved } : item
        )
        const allDecided = updatedItems.every(i => i.approved != null)
        // 只在首次核准時累加補休時數，動手加之前先確保上個月的餘額已經結算凍結
        if (log.userId && isApproved && prevItem?.approved == null) {
            await useUsersStore().ensureMonthClosed(log.userId)
        }
        const ops = [
            updateDoc(doc(db, 'workLogs', log.id), {
                overtimeItems: updatedItems,
                overtimeApproved: allDecided,
                overtimeApprovedBy: approverName,
                overtimeApprovedAt: serverTimestamp(),
            })
        ]
        if (log.userId && isApproved && prevItem?.approved == null) {
            const field = prevItem.type === '休息日' ? 'compensatoryHolidayHours' : 'compensatoryHours'
            ops.push(updateDoc(doc(db, 'users', log.userId), {
                [field]: increment(prevItem.hours || 0)
            }))
        }
        await Promise.all(ops)
    }

    async function fetchMonthlyKm(year, month) {
        const y = year ?? new Date().getFullYear()
        const m = month != null ? month : new Date().getMonth()
        const start = Timestamp.fromDate(new Date(y, m, 1))
        const end = Timestamp.fromDate(new Date(y, m + 1, 0, 23, 59, 59, 999))
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

    async function fetchMonthlyOvertimeHours(year, month) {
        const y = year ?? new Date().getFullYear()
        const m = month != null ? month : new Date().getMonth()
        const start = Timestamp.fromDate(new Date(y, m, 1))
        const end = Timestamp.fromDate(new Date(y, m + 1, 0, 23, 59, 59, 999))
        const q = query(collection(db, 'workLogs'), where('date', '>=', start), where('date', '<=', end))
        const snap = await getDocs(q)
        const hours = {}
        snap.docs.forEach(d => {
            const data = d.data()
            const name = data.userName
            if (!name || !Array.isArray(data.overtimeItems)) return
            const hasPerItem = data.overtimeItems.some(i => 'approved' in i)
            // 舊格式：整批核准，全部計入；新格式：只計 approved===true 的筆
            const total = hasPerItem
                ? data.overtimeItems.filter(i => i.approved === true).reduce((s, i) => s + (i.hours || 0), 0)
                : (data.overtimeApproved ? data.overtimeItems.reduce((s, i) => s + (i.hours || 0), 0) : 0)
            if (total > 0) hours[name] = (hours[name] || 0) + total
        })
        return hours
    }

    async function fetchMonthlyAttendance(year, month) {
        const y = year ?? new Date().getFullYear()
        const m = month != null ? month : new Date().getMonth()
        const start = Timestamp.fromDate(new Date(y, m, 1))
        const end = Timestamp.fromDate(new Date(y, m + 1, 0, 23, 59, 59, 999))
        const q = query(collection(db, 'workLogs'), where('date', '>=', start), where('date', '<=', end))
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

    async function fetchApprovedOvertimeDetail(userId, type) {
        const now = new Date()
        const y = now.getFullYear()
        const m = now.getMonth()
        const start = Timestamp.fromDate(new Date(y, m, 1))
        const end = Timestamp.fromDate(new Date(y, m + 1, 0, 23, 59, 59, 999))
        const q = query(
            collection(db, 'workLogs'),
            where('userId', '==', userId),
            where('date', '>=', start),
            where('date', '<=', end),
        )
        const snap = await getDocs(q)
        const entries = []
        snap.docs.forEach(d => {
            const data = d.data()
            const date = data.date?.toDate?.() ?? null
            ;(data.overtimeItems || []).forEach(item => {
                if (item.approved !== true) return
                const isHoliday = item.type === '休息日'
                if (type === 'holiday' && !isHoliday) return
                if (type === 'weekday' && isHoliday) return
                entries.push({ date, hours: item.hours || 0, reason: item.reason || '' })
            })
        })
        return entries.sort((a, b) => (a.date ?? 0) - (b.date ?? 0))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return {
        logs, pendingLogs,
        subscribe, subscribePending, cleanupPending,
        addLog, updateLog, addReply,
        approveFuel, approveOvertimeItem,
        fetchMonthlyKm, fetchMonthlyOvertimeHours, fetchMonthlyAttendance, fetchApprovedOvertimeDetail,
        unsubscribe: cleanup
    }
})
