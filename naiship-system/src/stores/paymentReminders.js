import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore'
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

    const upcomingAutoSoon = computed(() => {
        const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        return upcomingAuto.value.filter(r => r.dueDate <= thirtyDaysLater)
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
        await setDoc(doc(db, 'paymentReminders', docId), {
            ...data,
            status: 'pending',
            createdAt: serverTimestamp(),
            doneAt: null,
            doneBy: null,
        })
    }

    async function deleteAutoReminder(docId) {
        await deleteDoc(doc(db, 'paymentReminders', docId))
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
        upcomingAuto, upcomingAutoSoon,
        subscribe, cleanup,
        addReminder, markDone,
        addAutoReminder, deleteAutoReminder,
    }
})
