import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, getDocs, doc, serverTimestamp, Timestamp, arrayUnion } from 'firebase/firestore'
import { db } from '@/firebase'
import { useUsersStore } from '@/stores/users'
import { buildLedgerEntry } from '@/utils/compLedger'
import { getAnnualLeaveCycleInfo } from '@/utils/annualLeaveSchedule'

export const useWorkLogsStore = defineStore('workLogs', () => {
    const logs = ref([])
    const pendingLogs = ref([])
    let unsubscribe = null
    let pendingUnsub = null

    function subscribe(companyIdOrIds, date, endDate) {
        if (unsubscribe) unsubscribe()
        const ids = Array.isArray(companyIdOrIds) ? companyIdOrIds : [companyIdOrIds]
        const start = new Date(date); start.setHours(0, 0, 0, 0)
        const end = endDate ? new Date(endDate) : new Date(date)
        end.setHours(23, 59, 59, 999)
        const q = query(
            collection(db, 'workLogs'),
            where('companyId', 'in', ids),
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

    async function addReply(logId, content, userId, userName, attachments = []) {
        const reply = {
            id: Date.now().toString(),
            content,
            createdBy: userId,
            creatorName: userName ?? '',
            createdAt: Timestamp.fromDate(new Date()),
            attachments
        }
        return updateDoc(doc(db, 'workLogs', logId), { replies: arrayUnion(reply) })
    }

    async function editReply(log, replyId, content, attachments) {
        const updatedReplies = (log.replies ?? []).map(r =>
            r.id === replyId ? { ...r, content, attachments, updatedAt: Timestamp.fromDate(new Date()) } : r
        )
        return updateDoc(doc(db, 'workLogs', log.id), { replies: updatedReplies })
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
            i === itemIndex ? { ...item, approved: isApproved, approvedAt: Timestamp.now() } : item
        )
        const allDecided = updatedItems.every(i => i.approved != null)
        const ops = [
            updateDoc(doc(db, 'workLogs', log.id), {
                overtimeItems: updatedItems,
                overtimeApproved: allDecided,
                overtimeApprovedBy: approverName,
                overtimeApprovedAt: serverTimestamp(),
            })
        ]
        if (log.userId && isApproved && prevItem?.approved == null) {
            const usersStore = useUsersStore()
            const user = await usersStore.getUser(log.userId)
            if (user) {
                const cycleInfo = getAnnualLeaveCycleInfo(user.hireDate)
                if (!cycleInfo) console.warn(`approveOvertimeItem: 使用者 ${log.userId} 沒有到職日，補休分錄將永不到期`)
                if (!user.salary) console.warn(`approveOvertimeItem: 使用者 ${log.userId} 沒有底薪資料，這筆補休分錄金額會是0`)
                const entry = buildLedgerEntry({
                    type: prevItem.type === '休息日' ? '休息日' : '平日',
                    hours: prevItem.hours || 0,
                    baseSalary: user.salary || 0,
                    expireDate: cycleInfo?.nextCycleStart ?? null,
                    sourceLogId: log.id,
                    source: 'overtime',
                })
                ops.push(usersStore.addLedgerEntry(log.userId, entry))
            } else {
                console.warn(`approveOvertimeItem: 找不到使用者 ${log.userId}，跳過補休分錄建立`)
            }
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
            if (total > 0) km[name] = Math.round(((km[name] || 0) + total) * 100) / 100
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

    async function findLogForUserDate(userId, date) {
        const start = new Date(date); start.setHours(0, 0, 0, 0)
        const end = new Date(date); end.setHours(23, 59, 59, 999)
        const q = query(
            collection(db, 'workLogs'),
            where('userId', '==', userId),
            where('date', '>=', Timestamp.fromDate(start)),
            where('date', '<=', Timestamp.fromDate(end)),
        )
        const snap = await getDocs(q)
        if (snap.empty) return null
        const d = snap.docs[0]
        return { id: d.id, ...d.data() }
    }

    async function createProxyLog(userId, userName, companyId, date) {
        return addLog({ userId, userName, companyId, date: Timestamp.fromDate(date) })
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return {
        logs, pendingLogs,
        subscribe, subscribePending, cleanupPending,
        addLog, updateLog, addReply, editReply,
        approveFuel, approveOvertimeItem,
        fetchMonthlyKm, fetchMonthlyOvertimeHours, fetchMonthlyAttendance,
        findLogForUserDate, createProxyLog,
        unsubscribe: cleanup
    }
})
