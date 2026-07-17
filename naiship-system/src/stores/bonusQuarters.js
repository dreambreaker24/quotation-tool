import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

export function defaultQuarterData() {
    return {
        entries: [],
        adminTarget: {
            leadCount: 0, signedCount: 0,
            leadThresholds: [],
            signedBonusPerCase: 1000,
            assignedToUid: '', assignedToName: '',
        },
        teamBonus: { sales: 0, designer: 0, siteManager: 0, admin: 0 },
    }
}

export const useBonusQuartersStore = defineStore('bonusQuarters', () => {
    const current = ref(null)

    async function fetchQuarter(quarterKey) {
        const snap = await getDoc(doc(db, 'bonusQuarters', quarterKey))
        current.value = snap.exists() ? { ...defaultQuarterData(), ...snap.data() } : defaultQuarterData()
        return current.value
    }

    async function saveQuarter(quarterKey, data) {
        const authStore = useAuthStore()
        const patch = { ...data, lastCalculatedAt: serverTimestamp(), lastCalculatedBy: authStore.name ?? '' }
        await setDoc(doc(db, 'bonusQuarters', quarterKey), patch, { merge: true })
        current.value = { ...current.value, ...data }
    }

    async function markEntryPaid(quarterKey, entryIndex, paid) {
        const authStore = useAuthStore()
        const docRef = doc(db, 'bonusQuarters', quarterKey)
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef)
            const data = snap.data() ?? defaultQuarterData()
            const entries = [...(data.entries || [])]
            if (!entries[entryIndex]) throw new Error('entry not found')
            entries[entryIndex] = {
                ...entries[entryIndex],
                paid,
                paidAt: paid ? serverTimestamp() : null,
                paidBy: paid ? (authStore.name ?? '') : '',
            }
            tx.set(docRef, { ...data, entries }, { merge: true })
        })
        if (current.value) {
            const entries = [...current.value.entries]
            entries[entryIndex] = { ...entries[entryIndex], paid, paidBy: paid ? (authStore.name ?? '') : '' }
            current.value = { ...current.value, entries }
        }
    }

    function cleanup() {
        current.value = null
    }

    return { current, fetchQuarter, saveQuarter, markEntryPaid, cleanup }
})
