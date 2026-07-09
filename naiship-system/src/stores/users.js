import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, updateDoc, doc, increment } from 'firebase/firestore'
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

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
    }

    return { users, subscribe, updateUser, adjustCompensatoryHours, adjustCompensatoryHolidayHours, adjustAnnualLeaveHours, cleanup }
})
