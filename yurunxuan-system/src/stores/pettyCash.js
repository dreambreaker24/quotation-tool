import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const SETTINGS_REF_PATH = ['settings', 'pettyCash']

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
        getDoc(doc(db, ...SETTINGS_REF_PATH)).then(snap => {
            if (snap.exists()) settings.value = { ...settings.value, ...snap.data() }
        })
    }

    async function addEntry(data) {
        return addDoc(collection(db, 'pettyCash'), { ...data, createdAt: serverTimestamp() })
    }

    async function updateSettings(patch) {
        const next = { ...settings.value, ...patch }
        await setDoc(doc(db, ...SETTINGS_REF_PATH), next, { merge: true })
        settings.value = next
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null }; entries.value = [] }

    return { entries, settings, subscribe, addEntry, updateSettings, cleanup }
})
