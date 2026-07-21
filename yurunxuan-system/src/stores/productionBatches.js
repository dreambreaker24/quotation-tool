import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'

export const useProductionBatchesStore = defineStore('productionBatches', () => {
    const batches = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'productionBatches'), orderBy('expiryDate'))
        unsubscribe = onSnapshot(q, snap => {
            batches.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { batches, subscribe, cleanup }
})
