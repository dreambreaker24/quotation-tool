import { defineStore } from 'pinia'
import { addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useRevenueLogsStore = defineStore('revenueLogs', () => {
    async function addRevenueLog({ date, amount, paymentMethod, note, recordedBy, recordedByUid }) {
        const validAmount = Number(amount)
        if (!Number.isFinite(validAmount) || validAmount <= 0) {
            throw new Error('收入金額必須是正數')
        }
        return addDoc(collection(db, 'revenueLogs'), {
            date, amount: validAmount, paymentMethod, note, recordedBy, recordedByUid, createdAt: serverTimestamp()
        })
    }

    async function getMonthlyTotal(monthStr) {
        const start = `${monthStr}-01`
        const end = `${monthStr}-31`
        const q = query(collection(db, 'revenueLogs'), where('date', '>=', start), where('date', '<=', end))
        const snap = await getDocs(q)
        return snap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0)
    }

    return { addRevenueLog, getMonthlyTotal }
})
