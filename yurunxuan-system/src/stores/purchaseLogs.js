import { defineStore } from 'pinia'
import { runTransaction, doc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const usePurchaseLogsStore = defineStore('purchaseLogs', () => {
    async function addPurchaseLog({ date, materialId, qty, unitCost, vendorId, recordedBy, recordedByUid }) {
        return runTransaction(db, async (transaction) => {
            const materialRef = doc(db, 'materials', materialId)
            const snap = await transaction.get(materialRef)
            const currentStock = snap.data()?.currentStock ?? 0
            transaction.update(materialRef, { currentStock: currentStock + qty })

            const logRef = doc(collection(db, 'purchaseLogs'))
            transaction.set(logRef, { date, materialId, qty, unitCost, vendorId, recordedBy, recordedByUid, createdAt: serverTimestamp() })
            return logRef.id
        })
    }

    return { addPurchaseLog }
})
