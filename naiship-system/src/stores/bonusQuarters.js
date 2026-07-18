import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore'
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

// 用 role+personId+caseId 當識別鍵，不用陣列索引——避免前端重新試算後陣列順序
// 跟 Firestore 實際存的順序不一致時，位置式索引指向錯誤的那一筆。
function entryKey(entry) {
    return `${entry.role}|${entry.personId}|${entry.caseId || ''}`
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

    // clientEntries：呼叫端目前畫面上顯示的完整 entries 陣列（不是只有要標記的那一筆）。
    // 文件還沒建立過（尚未按過「儲存本季資料」）時，會拿這份資料當底，讓第一次點
    // 「已發放」也能成功寫入，不用強制使用者先手動存檔一次。
    async function markEntryPaid(quarterKey, clientEntries, targetEntry, paid) {
        const authStore = useAuthStore()
        const key = entryKey(targetEntry)
        const docRef = doc(db, 'bonusQuarters', quarterKey)
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef)
            const existing = snap.exists() ? snap.data() : null
            const baseEntries = existing?.entries?.length ? existing.entries : clientEntries
            const idx = baseEntries.findIndex(e => entryKey(e) === key)
            const patchedEntry = {
                ...(idx >= 0 ? baseEntries[idx] : targetEntry),
                paid,
                paidAt: paid ? Timestamp.now() : null,
                paidBy: paid ? (authStore.name ?? '') : '',
            }
            const nextEntries = idx >= 0
                ? baseEntries.map((e, i) => (i === idx ? patchedEntry : e))
                : [...baseEntries, patchedEntry]
            tx.set(docRef, { ...defaultQuarterData(), ...existing, entries: nextEntries }, { merge: true })
        })
        if (current.value) {
            const idx = current.value.entries.findIndex(e => entryKey(e) === key)
            if (idx >= 0) {
                const nextEntries = [...current.value.entries]
                nextEntries[idx] = { ...nextEntries[idx], paid, paidBy: paid ? (authStore.name ?? '') : '' }
                current.value = { ...current.value, entries: nextEntries }
            }
        }
    }

    function cleanup() {
        current.value = null
    }

    return { current, fetchQuarter, saveQuarter, markEntryPaid, cleanup }
})
