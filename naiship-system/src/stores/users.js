import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, updateDoc, getDoc, getDocs, addDoc, doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

// 用 sv-SE locale 取得 'YYYY-MM-DD' 格式字串、強制鎖定 Asia/Taipei 時區，
// 避免依賴瀏覽器/伺服器系統時區設定（跟 src/utils/paymentSegments.js 的 todayStr() 同一套手法）
export function monthStr(date = new Date()) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 7)
}

export function prevMonthOf(monthKey) {
    const [y, m] = monthKey.split('-').map(Number)
    const prevM = m === 1 ? 12 : m - 1
    const prevY = m === 1 ? y - 1 : y
    return `${prevY}-${String(prevM).padStart(2, '0')}`
}

export function prevMonthStr(date = new Date()) {
    return prevMonthOf(monthStr(date))
}

export const useUsersStore = defineStore('users', () => {
    const users = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) return
        const q = query(collection(db, 'users'), orderBy('name'))
        unsubscribe = onSnapshot(q, snap => {
            users.value = snap.docs.filter(d => !d.data().disabled).map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function updateUser(uid, data) {
        return updateDoc(doc(db, 'users', uid), data)
    }

    async function logLeaveAdjustment(uid, field, delta, meta) {
        if (!meta || delta === 0) return
        await addDoc(collection(db, 'users', uid, 'compAdjustments'), {
            field, delta, source: 'leave',
            leaveType: meta.leaveType || '',
            adjustedBy: meta.adjustedBy || '',
            adjustedAt: serverTimestamp(),
        })
    }

    async function adjustCompensatoryHours(uid, delta, meta = null) {
        await updateDoc(doc(db, 'users', uid), { compensatoryHours: increment(delta) })
        await logLeaveAdjustment(uid, 'compensatoryHours', delta, meta)
    }

    async function adjustCompensatoryHolidayHours(uid, delta, meta = null) {
        await updateDoc(doc(db, 'users', uid), { compensatoryHolidayHours: increment(delta) })
        await logLeaveAdjustment(uid, 'compensatoryHolidayHours', delta, meta)
    }

    async function adjustAnnualLeaveHours(uid, delta) {
        return updateDoc(doc(db, 'users', uid), { annualLeaveHours: increment(delta) })
    }

    // 補休月結：把「上個月」的補休/休息日補休餘額凍結成快照後歸零。
    // 因為系統沒有排程後端，這個函式被設計成在任何會讀取/修改補休欄位的操作
    // 「之前」都先呼叫一次，等於把結算動作塞進操作的必經路徑上——新月份的
    // 第一筆異動一定會先觸發結算，用的是「異動發生前一刻」的餘額，不可能
    // 有跨月混算。第一次呼叫（compClosedMonth 不存在）只設定基準月份，不
    // 做任何快照/歸零，避免部署當下把還沒過完的當月餘額誤判成「上個月」結清。
    // 已知限制：若在月底最後一天才第一次部署上線，當月餘額不會被首次呼叫
    // 捕捉到（下個月才會補上，但那個月的餘額會被跳過不結算）。
    async function ensureMonthClosed(uid, now = new Date()) {
        const userRef = doc(db, 'users', uid)
        const monthToClose = prevMonthStr(now)
        return runTransaction(db, async (tx) => {
            const snap = await tx.get(userRef)
            const data = snap.data() ?? {}
            const closedMonth = data.compClosedMonth ?? null
            if (closedMonth === null) {
                tx.set(userRef, { compClosedMonth: monthToClose }, { merge: true })
                return
            }
            if (closedMonth >= monthToClose) return
            const weekdayHours = data.compensatoryHours || 0
            const holidayHours = data.compensatoryHolidayHours || 0
            const snapshotRef = doc(db, 'users', uid, 'compClosingBalances', monthToClose)
            tx.set(snapshotRef, { weekdayHours, holidayHours, closedAt: serverTimestamp() })
            tx.update(userRef, {
                compensatoryHours: 0,
                compensatoryHolidayHours: 0,
                compClosedMonth: monthToClose,
            })
        })
    }

    async function getClosingBalance(uid, month) {
        const snap = await getDoc(doc(db, 'users', uid, 'compClosingBalances', month))
        return snap.exists() ? snap.data() : null
    }

    // 補休結算快照依月份分開存，回傳這個人所有已結算過的月份（新到舊排序），
    // 讓明細視窗可以列出來給使用者挑選查看歷史月份
    async function listClosingMonths(uid) {
        const snap = await getDocs(collection(db, 'users', uid, 'compClosingBalances'))
        return snap.docs.map(d => d.id).sort().reverse()
    }

    // 手動調整補休/休息日補休時數（「調整」「歸零」按鈕）：這條路徑不經過加班核准流程，
    // 沒有對應的 workLog 可查，所以額外寫一筆 compAdjustments 記錄，讓明細清單能追溯到這筆異動。
    async function adjustCompensatoryField(uid, field, newValue, prevValue, adjustedBy) {
        const delta = newValue - prevValue
        await updateDoc(doc(db, 'users', uid), { [field]: newValue })
        if (delta !== 0) {
            await addDoc(collection(db, 'users', uid, 'compAdjustments'), {
                field, delta, prevValue, newValue,
                adjustedBy: adjustedBy || '',
                adjustedAt: serverTimestamp(),
            })
        }
    }

    async function fetchCompAdjustments(uid, field, periodStart, periodEnd = null) {
        const q = query(collection(db, 'users', uid, 'compAdjustments'), where('field', '==', field))
        const snap = await getDocs(q)
        return snap.docs
            .map(d => d.data())
            .filter(a => {
                const at = a.adjustedAt?.toDate?.() ?? null
                if (periodStart && at && at < periodStart) return false
                if (periodEnd && at && at >= periodEnd) return false
                return true
            })
            .map(a => ({
                date: a.adjustedAt?.toDate?.() ?? null,
                hours: a.delta,
                reason: a.source === 'leave'
                    ? `請假${a.leaveType ? `（${a.leaveType}）` : ''}${a.adjustedBy ? `－${a.adjustedBy}` : ''}`
                    : `人工調整${a.adjustedBy ? `（${a.adjustedBy}）` : ''}`,
                manual: a.source !== 'leave',
            }))
    }

    async function getUser(uid) {
        const snap = await getDoc(doc(db, 'users', uid))
        return snap.exists() ? { id: snap.id, ...snap.data() } : null
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
    }

    return { users, subscribe, updateUser, adjustCompensatoryHours, adjustCompensatoryHolidayHours, adjustAnnualLeaveHours, ensureMonthClosed, getClosingBalance, listClosingMonths, adjustCompensatoryField, fetchCompAdjustments, getUser, cleanup }
})
