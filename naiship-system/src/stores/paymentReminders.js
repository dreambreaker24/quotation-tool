import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

export const usePaymentRemindersStore = defineStore('paymentReminders', () => {
    const reminders = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) unsubscribe()
        const q = query(
            collection(db, 'paymentReminders'),
            where('status', '==', 'pending')
        )
        unsubscribe = onSnapshot(q,
            snap => { reminders.value = snap.docs.map(d => ({ id: d.id, ...d.data() })) },
            err => console.error('[paymentReminders] onSnapshot error:', err)
        )
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        reminders.value = []
    }

    const pendingOwner = computed(() => reminders.value.filter(r => r.type === 'owner' && (!r.source || r.source === 'manual')))
    const pendingVendor = computed(() => reminders.value.filter(r => r.type === 'vendor' && (!r.source || r.source === 'manual')))

    const upcomingAuto = computed(() =>
        reminders.value
            .filter(r => r.source === 'auto')
            .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    )

    function thisMonthRange() {
        const now = new Date()
        const y = now.getFullYear(), m = now.getMonth()
        const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
        const lastDay = new Date(y, m + 2, 0)
        const end = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
        return { start, end }
    }

    const upcomingAutoSoon = computed(() => {
        const { start, end } = thisMonthRange()
        return upcomingAuto.value.filter(r =>
            r.type === 'vendor' && r.dueDate >= start && r.dueDate <= end
        )
    })

    const upcomingOwnerSoon = computed(() => {
        const { start, end } = thisMonthRange()
        return upcomingAuto.value.filter(r =>
            r.type === 'owner' && r.dueDate >= start && r.dueDate <= end
        )
    })

    async function addReminder(data) {
        return addDoc(collection(db, 'paymentReminders'), {
            ...data,
            status: 'pending',
            createdAt: serverTimestamp(),
            doneAt: null,
            doneBy: null,
        })
    }

    async function addAutoReminder(docId, data) {
        const ref = doc(db, 'paymentReminders', docId)
        const snap = await getDoc(ref)
        if (snap.exists() && snap.data().status === 'done') {
            await updateDoc(ref, { dueDate: data.dueDate })
            return
        }
        await setDoc(ref, {
            ...data,
            status: 'pending',
            createdAt: serverTimestamp(),
            doneAt: null,
            doneBy: null,
        })
    }

    async function deleteAutoReminder(docId) {
        const ref = doc(db, 'paymentReminders', docId)
        const snap = await getDoc(ref)
        if (snap.exists()) await deleteDoc(ref)
    }

    async function markDone(id) {
        const authStore = useAuthStore()
        await updateDoc(doc(db, 'paymentReminders', id), {
            status: 'done',
            doneAt: serverTimestamp(),
            doneBy: authStore.user?.uid ?? '',
        })
    }

    return {
        reminders, pendingOwner, pendingVendor,
        upcomingAuto, upcomingAutoSoon, upcomingOwnerSoon,
        subscribe, cleanup,
        addReminder, markDone,
        addAutoReminder, deleteAutoReminder,
    }
})
