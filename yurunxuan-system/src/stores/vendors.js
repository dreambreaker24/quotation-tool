import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useVendorsStore = defineStore('vendors', () => {
    const vendors = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'vendors'), orderBy('name'))
        unsubscribe = onSnapshot(q, snap => {
            vendors.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function addVendor(data) {
        return addDoc(collection(db, 'vendors'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateVendor(id, data) {
        return updateDoc(doc(db, 'vendors', id), data)
    }

    async function deleteVendor(id) {
        return deleteDoc(doc(db, 'vendors', id))
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { vendors, subscribe, addVendor, updateVendor, deleteVendor, cleanup }
})
