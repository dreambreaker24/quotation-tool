import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, updateDoc, getDoc, doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

// 用 sv-SE locale 取得 'YYYY-MM-DD' 格式字串、強制鎖定 Asia/Taipei 時區，
// 避免依賴瀏覽器/伺服器系統時區設定（跟 src/utils/paymentSegments.js 的 todayStr() 同一套手法）
export function monthStr(date = new Date()) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 7)
}

export function prevMonthStr(date = new Date()) {
    const [y, m] = monthStr(date).split('-').map(Number)
    const prevM = m === 1 ? 12 : m - 1
    const prevY = m === 1 ? y - 1 : y
    return `${prevY}-${String(prevM).padStart(2, '0')}`
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

    async function adjustCompensatoryHours(uid, delta) {
        return updateDoc(doc(db, 'users', uid), { compensatoryHours: increment(delta) })
    }

    async function adjustCompensatoryHolidayHours(uid, delta) {
        return updateDoc(doc(db, 'users', uid), { compensatoryHolidayHours: increment(delta) })
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

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
    }

    return { users, subscribe, updateUser, adjustCompensatoryHours, adjustCompensatoryHolidayHours, adjustAnnualLeaveHours, ensureMonthClosed, getClosingBalance, cleanup }
})
