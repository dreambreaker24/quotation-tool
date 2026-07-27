import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

export const usePettyCashStore = defineStore('pettyCash', () => {
    const entries = ref([])
    const settings = ref({ lowBalanceThreshold: null })
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(collection(db, 'pettyCash'), orderBy('date', 'desc'))
        unsubscribe = onSnapshot(q, snap => {
            entries.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
        getDoc(doc(db, 'settings', 'pettyCash')).then(snap => {
            if (snap.exists()) settings.value = { ...settings.value, ...snap.data() }
        })
    }

    async function addEntry(data) {
        const authStore = useAuthStore()
        return addDoc(collection(db, 'pettyCash'), { ...data, createdBy: authStore.name ?? '', createdAt: serverTimestamp() })
    }

    async function updateSettings(patch) {
        const next = { ...settings.value, ...patch }
        await setDoc(doc(db, 'settings', 'pettyCash'), next, { merge: true })
        settings.value = next
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        entries.value = []
        settings.value = { lowBalanceThreshold: null }
    }

    return { entries, settings, subscribe, addEntry, updateSettings, cleanup }
})
