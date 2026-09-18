import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
    collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp, getDoc, setDoc
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const SETTINGS_PATH = 'settings/pettyCash'

export const usePettyCashStore = defineStore('pettyCash', () => {
    const entries = ref([])
    const settings = ref({
        benBudget: 10000,
        bunBudget: 30000,
        laiBudget: 10000,
        lastNotifiedBunLow: '',
        lastNotifiedLaiLow: '',
        lastNotifiedTotalLow: '',
    })
    let unsubscribe = null
    let entriesReady = false
    let entriesReadyResolvers = []

    function subscribe() {
        if (unsubscribe) return
        const q = query(collection(db, 'pettyCash'), orderBy('date', 'desc'))
        unsubscribe = onSnapshot(q, snap => {
            entries.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            if (!entriesReady) {
                entriesReady = true
                entriesReadyResolvers.forEach(resolve => resolve())
                entriesReadyResolvers = []
            }
        })
        getDoc(doc(db, SETTINGS_PATH)).then(snap => {
            if (snap.exists()) settings.value = { ...settings.value, ...snap.data() }
        })
    }

    function waitForEntriesReady() {
        if (entriesReady) return Promise.resolve()
        return new Promise(resolve => entriesReadyResolvers.push(resolve))
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        entries.value = []
        entriesReady = false
        entriesReadyResolvers = []
    }

    const totalBalance = computed(() =>
        entries.value.reduce((sum, e) => {
            if (e.type === 'topup') return sum + (e.amount || 0)
            if (e.type === 'expense') return sum - (e.amount || 0)
            return sum
        }, 0)
    )

    const bunBalance = computed(() =>
        entries.value.reduce((sum, e) => {
            if (e.payerName !== '蚌') return sum
            if (e.type === 'distribute') return sum + (e.amount || 0)
            if (e.type === 'expense') return sum - (e.amount || 0)
            if (e.type === 'return') return sum - (e.amount || 0)
            return sum
        }, 0)
    )

    const laiBalance = computed(() =>
        entries.value.reduce((sum, e) => {
            if (e.payerName !== '賴賴') return sum
            if (e.type === 'distribute') return sum + (e.amount || 0)
            if (e.type === 'expense') return sum - (e.amount || 0)
            if (e.type === 'return') return sum - (e.amount || 0)
            return sum
        }, 0)
    )

    // 柏手上實際的現金：補款進來會增加，發放給蚌／賴賴保管會減少（不管發給誰），
    // 蚌／賴賴歸還會加回來，柏自己（或蚌賴賴以外任何人）的支出會減少。
    // 這樣算出來的柏零用金 + 蚌零用金 + 賴賴零用金，永遠等於 totalBalance（補款總額－全部支出），
    // 因為錢只是在「柏／蚌／賴賴」之間轉移，不會憑空增加或消失。
    const benBalance = computed(() =>
        entries.value.reduce((sum, e) => {
            if (e.type === 'topup') return sum + (e.amount || 0)
            if (e.type === 'distribute') return sum - (e.amount || 0)
            if (e.type === 'return') return sum + (e.amount || 0)
            if (e.type === 'expense' && e.payerName !== '蚌' && e.payerName !== '賴賴') return sum - (e.amount || 0)
            return sum
        }, 0)
    )

    async function addEntry(data) {
        const authStore = useAuthStore()
        await addDoc(collection(db, 'pettyCash'), {
            ...data,
            createdBy: authStore.user?.uid ?? '',
            createdByName: authStore.name ?? '',
            createdAt: serverTimestamp(),
        })
        if (data.type === 'expense') {
            await waitForEntriesReady()
            await checkNotifications()
        }
    }

    async function updateEntry(id, data) {
        await updateDoc(doc(db, 'pettyCash', id), {
            ...data,
            updatedAt: serverTimestamp(),
        })
    }

    async function deleteEntry(id) {
        await deleteDoc(doc(db, 'pettyCash', id))
    }

    async function updateSettings(patch) {
        const next = { ...settings.value, ...patch }
        await setDoc(doc(db, SETTINGS_PATH), next, { merge: true })
        settings.value = next
    }

    async function checkNotifications() {
        const notifStore = useNotificationsStore()
        const ym = new Date().toISOString().slice(0, 7)
        const patch = {}

        // 這三則是系統自動門檻警示，不是「誰」做了什麼動作觸發的（觸發者只是剛好記了一筆
        // 支出，跟警示的對象常常是不同人），所以不掛發言人名稱，避免訊息前面的粗體人名
        // 被誤讀成「這個人的餘額不足」
        if (bunBalance.value < 5000 && settings.value.lastNotifiedBunLow !== ym) {
            await notifStore.notifyManagers(
                '',
                `蚌零用金餘額不足 $5,000，目前剩餘 $${bunBalance.value.toLocaleString()}`
            )
            patch.lastNotifiedBunLow = ym
        }
        if (laiBalance.value < 5000 && settings.value.lastNotifiedLaiLow !== ym) {
            await notifStore.notifyManagers(
                '',
                `賴賴零用金餘額不足 $5,000，目前剩餘 $${laiBalance.value.toLocaleString()}`
            )
            patch.lastNotifiedLaiLow = ym
        }
        if (totalBalance.value < 10000 && settings.value.lastNotifiedTotalLow !== ym) {
            await notifStore.notifyManagers(
                '',
                `總零用金不足 $10,000，目前剩餘 $${totalBalance.value.toLocaleString()}，請補款`
            )
            patch.lastNotifiedTotalLow = ym
        }
        if (Object.keys(patch).length) await updateSettings(patch)
    }

    return {
        entries, settings, totalBalance, bunBalance, laiBalance, benBalance,
        subscribe, cleanup, addEntry, updateEntry, deleteEntry, updateSettings
    }
})
