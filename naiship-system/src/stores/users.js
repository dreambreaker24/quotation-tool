import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, updateDoc, getDoc, getDocs, addDoc, doc, increment, serverTimestamp } from 'firebase/firestore'
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

    async function adjustAnnualLeaveHours(uid, delta) {
        return updateDoc(doc(db, 'users', uid), { annualLeaveHours: increment(delta) })
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

    // 套用特休週期：跟一般的 adjustCompensatoryField 不同之處是要「同一次 updateDoc」把餘額
    // 和週期起算日一起寫入，避免中途失敗導致餘額已加但週期起算日沒更新、按鈕誤判成還沒套用
    // 而被重複點擊套用
    async function applyAnnualLeaveCycle(uid, newValue, prevValue, cycleStart, adjustedBy) {
        const delta = newValue - prevValue
        await updateDoc(doc(db, 'users', uid), { annualLeaveHours: newValue, annualLeaveAppliedCycleStart: cycleStart })
        if (delta !== 0) {
            await addDoc(collection(db, 'users', uid, 'compAdjustments'), {
                field: 'annualLeaveHours', delta, prevValue, newValue,
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

    async function fetchCompLedger(uid) {
        const snap = await getDocs(collection(db, 'users', uid, 'compLedger'))
        return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    }

    async function addLedgerEntry(uid, entry) {
        const ref = await addDoc(collection(db, 'users', uid, 'compLedger'), { ...entry, createdAt: serverTimestamp() })
        return ref.id
    }

    async function applyLedgerConsumption(uid, updatedEntries) {
        await Promise.all(updatedEntries.map(e =>
            updateDoc(doc(db, 'users', uid, 'compLedger', e.id), { remainingHours: e.remainingHours })
        ))
    }

    async function getUser(uid) {
        const snap = await getDoc(doc(db, 'users', uid))
        return snap.exists() ? { id: snap.id, ...snap.data() } : null
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
    }

    return {
        users, subscribe, updateUser, adjustAnnualLeaveHours,
        adjustCompensatoryField, applyAnnualLeaveCycle,
        fetchCompAdjustments, getUser, cleanup,
        fetchCompLedger, addLedgerEntry, applyLedgerConsumption,
    }
})
