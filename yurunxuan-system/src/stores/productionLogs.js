import { defineStore } from 'pinia'
import { runTransaction, doc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { calcProductionDeductions } from '@/utils/stockTransaction'

export const useProductionLogsStore = defineStore('productionLogs', () => {
    async function addProductionLog({ date, drinkId, drinkName, qty, recordedBy, recordedByUid, ingredients }) {
        const deductions = calcProductionDeductions(ingredients, qty)
        return runTransaction(db, async (transaction) => {
            const materialRefs = deductions.map(d => doc(db, 'materials', d.materialId))
            const materialSnaps = await Promise.all(materialRefs.map(ref => transaction.get(ref)))

            materialSnaps.forEach((snap, i) => {
                const currentStock = snap.data()?.currentStock ?? 0
                transaction.update(materialRefs[i], { currentStock: currentStock + deductions[i].delta })
            })

            const logRef = doc(collection(db, 'productionLogs'))
            transaction.set(logRef, { date, drinkId, drinkName, qty, recordedBy, recordedByUid, createdAt: serverTimestamp() })
            return logRef.id
        })
    }

    return { addProductionLog }
})
