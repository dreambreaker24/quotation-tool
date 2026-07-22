import { defineStore } from 'pinia'
import { runTransaction, getDocs, doc, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { pickBatchesForDeduction } from '@/utils/batchDeduction'
import { aggregateBottlesByDrink, calcSaleTotal } from '@/utils/saleItems'

export const useRevenueLogsStore = defineStore('revenueLogs', () => {
    async function addRevenueLog({ date, items, paymentMethod, note, recordedBy, recordedByUid }) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('請至少新增一個銷售品項')
        }
        const amount = calcSaleTotal(items)
        const bottleNeeds = aggregateBottlesByDrink(items)

        // Transaction 內不能下查詢，先在外面查出每款飲品的候選批次 ID
        // 各款飲品的查詢彼此獨立，平行查詢縮短整體等待時間
        const candidateEntries = await Promise.all(bottleNeeds.map(async ({ drinkId }) => {
            const q = query(collection(db, 'productionBatches'), where('drinkId', '==', drinkId))
            const snap = await getDocs(q)
            return [drinkId, snap.docs.map(d => d.id)]
        }))
        const candidatesByDrink = Object.fromEntries(candidateEntries)

        return runTransaction(db, async (transaction) => {
            // 先把「所有」涉及飲品的批次都讀完，才能開始寫——
            // Firestore Transaction 規定同一個 transaction 裡所有 get() 必須在任何 set()/update() 之前完成
            // 各款飲品的讀取彼此獨立，平行讀取不影響「讀完才寫」的保證（這裡全部都還是讀）
            const batchesEntries = await Promise.all(bottleNeeds.map(async ({ drinkId }) => {
                const candidateIds = candidatesByDrink[drinkId]
                const batchRefs = candidateIds.map(id => doc(db, 'productionBatches', id))
                const batchSnaps = await Promise.all(batchRefs.map(ref => transaction.get(ref)))
                const batches = batchSnaps
                    .map((snap, i) => ({ id: candidateIds[i], ...snap.data() }))
                    .filter(b => (b.remainingQty ?? 0) > 0)
                    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
                return [drinkId, batches]
            }))
            const batchesByDrink = Object.fromEntries(batchesEntries)

            // 讀取階段結束，開始計算扣法並寫入。任一款不夠扣就直接 throw，
            // 整個 Transaction 不會提交（前面已經 update 的品項也不會生效）
            for (const { drinkId, bottles } of bottleNeeds) {
                const batches = batchesByDrink[drinkId]
                let plan
                try {
                    plan = pickBatchesForDeduction(batches, bottles)
                } catch (e) {
                    const drinkName = items.find(item => item.drinkId === drinkId)?.drinkName || drinkId
                    throw new Error(`${drinkName}${e.message}`)
                }
                plan.forEach(p => {
                    const batch = batches.find(b => b.id === p.batchId)
                    transaction.update(doc(db, 'productionBatches', p.batchId), { remainingQty: batch.remainingQty - p.deductQty })
                })
            }

            const logRef = doc(collection(db, 'revenueLogs'))
            transaction.set(logRef, { date, items, amount, paymentMethod, note, recordedBy, recordedByUid, createdAt: serverTimestamp() })
            return logRef.id
        })
    }

    async function getMonthlyTotal(monthStr) {
        if (!/^\d{4}-\d{2}$/.test(monthStr)) {
            throw new Error('月份格式錯誤，應為 YYYY-MM')
        }
        const start = `${monthStr}-01`
        const end = `${monthStr}-31`
        const q = query(collection(db, 'revenueLogs'), where('date', '>=', start), where('date', '<=', end))
        const snap = await getDocs(q)
        return snap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0)
    }

    return { addRevenueLog, getMonthlyTotal }
})
