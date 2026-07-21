import { defineStore } from 'pinia'
import { runTransaction, addDoc, doc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

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
        return addDoc(collection(db, 'wasteLogs'), { date, type, drinkId, qty: validQty, reason, recordedBy, recordedByUid, createdAt: serverTimestamp() })
    }

    return { addWasteLog }
})
