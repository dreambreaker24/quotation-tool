import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

export function defaultCaseBonusData() {
    return {
        designContractAmount: 0,
        constructionContractAmount: 0,
        salesPersonIds: [], salesSplit: {},
        designerIds: [], designerSplit: {},
        siteManagerIds: [], siteManagerSplit: {},
        miscExpenses: 0,
        teamBonusAmount: 0, teamBonusSplit: {},
        qualitativeChecks: {
            sales: { 達成簽約: false, 案件資訊: false, 簽約後交接: false },
            designer: { 丈量: false, 提案: false, 設計: false, 與業主收款: false, 廠商收取發票: false },
            siteManager: { 品質: false, 工程進度: false, 無重大客訴: false, 無嚴重追加錯誤: false, 收尾驗收: false },
        },
        notes: '',
    }
}

export const useCaseBonusDataStore = defineStore('caseBonusData', () => {
    const cache = ref({})

    async function fetchData(caseId) {
        if (cache.value[caseId]) return cache.value[caseId]
        const snap = await getDoc(doc(db, 'caseBonusData', caseId))
        const data = snap.exists() ? { ...defaultCaseBonusData(), ...snap.data() } : defaultCaseBonusData()
        cache.value[caseId] = data
        return data
    }

    async function saveData(caseId, data) {
        const authStore = useAuthStore()
        await setDoc(doc(db, 'caseBonusData', caseId), {
            ...data,
            updatedAt: serverTimestamp(),
            updatedBy: authStore.name ?? '',
        }, { merge: true })
        cache.value[caseId] = { ...cache.value[caseId], ...data }
    }

    function cleanup() {
        cache.value = {}
    }

    return { cache, fetchData, saveData, cleanup }
})
