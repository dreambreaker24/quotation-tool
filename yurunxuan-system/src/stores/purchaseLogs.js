import { defineStore } from 'pinia'
import { runTransaction, doc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const usePurchaseLogsStore = defineStore('purchaseLogs', () => {
    async function addPurchaseLog({ date, materialId, qty, unitCost, vendorId, recordedBy, recordedByUid }) {
        const validQty = Number(qty)
        if (!Number.isFinite(validQty) || validQty <= 0) {
            throw new Error('進貨數量必須是正數')
        }
        const validUnitCost = Number(unitCost) || 0

        return runTransaction(db, async (transaction) => {
            const materialRef = doc(db, 'materials', materialId)
            const snap = await transaction.get(materialRef)
            const currentStock = snap.data()?.currentStock ?? 0
            transaction.update(materialRef, { currentStock: currentStock + validQty })

            const logRef = doc(collection(db, 'purchaseLogs'))
            transaction.set(logRef, { date, materialId, qty: validQty, unitCost: validUnitCost, vendorId, recordedBy, recordedByUid, createdAt: serverTimestamp() })
            return logRef.id
        })
    }

    async function getLatestUnitCosts() {
        const snap = await getDocs(collection(db, 'purchaseLogs'))
        const latest = {}
        snap.docs.forEach(d => {
            const data = d.data()
            const existing = latest[data.materialId]
            const isNewer = !existing ||
                data.date > existing.date ||
                (data.date === existing.date && (data.createdAt?.seconds ?? 0) > (existing.createdAt?.seconds ?? 0))
            if (isNewer) {
                latest[data.materialId] = { date: data.date, unitCost: data.unitCost, createdAt: data.createdAt }
            }
        })
        return Object.fromEntries(Object.entries(latest).map(([id, v]) => [id, v.unitCost]))
    }

    return { addPurchaseLog, getLatestUnitCosts }
})
