import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'

export const useNotificationsStore = defineStore('notifications', () => {
    const notifications = ref([])
    let unsubscribe = null

    function subscribe(uid) {
        if (unsubscribe) unsubscribe()
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', uid),
            where('createdAt', '>=', Timestamp.fromDate(todayStart)),
            orderBy('createdAt', 'desc')
        )
        unsubscribe = onSnapshot(q,
            snap => { notifications.value = snap.docs.map(d => ({ id: d.id, ...d.data() })) },
            err => console.error('[notifications] onSnapshot error:', err)
        )
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        notifications.value = []
    }

    async function notifyAll(actorName, message, caseId, caseName, companyId = '') {
        const authStore = useAuthStore()
        const usersStore = useUsersStore()
        const currentUid = authStore.user?.uid
        const jobs = []
        for (const u of usersStore.users) {
            if (u.id === currentUid || u.disabled) continue
            jobs.push(addDoc(collection(db, 'notifications'), {
                userId: u.id,
                actorName,
                message,
                caseId: caseId ?? '',
                caseName: caseName ?? '',
                companyId: companyId ?? '',
                createdAt: serverTimestamp(),
            }))
        }
        await Promise.all(jobs)
    }

    async function notifyManagers(actorName, message) {
        const authStore = useAuthStore()
        const usersStore = useUsersStore()
        const currentUid = authStore.user?.uid
        const jobs = []
        for (const u of usersStore.users) {
            if (u.id === currentUid || u.disabled) continue
            if (!['admin', 'manager'].includes(u.role)) continue
            jobs.push(addDoc(collection(db, 'notifications'), {
                userId: u.id,
                actorName,
                message,
                caseId: '',
                caseName: '',
                companyId: '',
                createdAt: serverTimestamp(),
            }))
        }
        await Promise.all(jobs)
    }

    async function markRead(id) {
        await updateDoc(doc(db, 'notifications', id), { read: true })
    }

    return { notifications, subscribe, cleanup, notifyAll, notifyManagers, markRead }
})
