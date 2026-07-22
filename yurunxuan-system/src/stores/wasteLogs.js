import { defineStore } from 'pinia'
import { runTransaction, addDoc, getDocs, doc, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { pickBatchesForDeduction } from '@/utils/batchDeduction'

export const useWasteLogsStore = defineStore('wasteLogs', () => {
    async function addWasteLog({ date, type, materialId, drinkId, qty, reason, recordedBy, recordedByUid }) {
        const validQty = Number(qty)
        if (!Number.isFinite(validQty) || validQty <= 0) {
            throw new Error('報廢數量必須是正數')
        }
        if (type !== 'material' && type !== 'drink') {
            throw new Error('報廢類型錯誤')
        }

        if (type === 'material') {
            return runTransaction(db, async (transaction) => {
                const materialRef = doc(db, 'materials', materialId)
                const snap = await transaction.get(materialRef)
                const currentStock = snap.data()?.currentStock ?? 0
                transaction.update(materialRef, { currentStock: currentStock - validQty })

                const logRef = doc(collection(db, 'wasteLogs'))
                transaction.set(logRef, { date, type, materialId, qty: validQty, reason, recordedBy, recordedByUid, createdAt: serverTimestamp() })
                return logRef.id
            })
        }

        const candidateQuery = query(collection(db, 'productionBatches'), where('drinkId', '==', drinkId))
        const candidateSnap = await getDocs(candidateQuery)
        const candidateIds = candidateSnap.docs.map(d => d.id)

        return runTransaction(db, async (transaction) => {
            const batchRefs = candidateIds.map(id => doc(db, 'productionBatches', id))
            const batchSnaps = await Promise.all(batchRefs.map(ref => transaction.get(ref)))

            const batches = batchSnaps
                .map((snap, i) => ({ id: candidateIds[i], ...snap.data() }))
                .filter(b => (b.remainingQty ?? 0) > 0)
                .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))

            const plan = pickBatchesForDeduction(batches, validQty)

            plan.forEach(p => {
                const batch = batches.find(b => b.id === p.batchId)
                transaction.update(doc(db, 'productionBatches', p.batchId), { remainingQty: batch.remainingQty - p.deductQty })
            })

            const logRef = doc(collection(db, 'wasteLogs'))
            transaction.set(logRef, { date, type, drinkId, qty: validQty, reason, recordedBy, recordedByUid, createdAt: serverTimestamp() })
            return logRef.id
        })
    }

    return { addWasteLog }
})
