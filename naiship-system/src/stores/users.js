import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, orderBy, onSnapshot, updateDoc, doc, increment } from 'firebase/firestore'
import { db } from '@/firebase'

export const useUsersStore = defineStore('users', () => {
    const users = ref([])
    let unsubscribe = null

    function subscribe() {
        if (unsubscribe) return
        const q = query(collection(db, 'users'), orderBy('name'))
        unsubscribe = onSnapshot(q, snap => {
            users.value = snap.docs.filter(d => !d.data().disabled).map(d => ({ id: d.id, ...d.data() }))
        })
    }

    async function updateUser(uid, data) {
        return updateDoc(doc(db, 'users', uid), data)
    }

    async function adjustCompensatoryHours(uid, delta) {
        return updateDoc(doc(db, 'users', uid), { compensatoryHours: increment(delta) })
    }

    async function adjustAnnualLeaveHours(uid, delta) {
        return updateDoc(doc(db, 'users', uid), { annualLeaveHours: increment(delta) })
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
    }

    return { users, subscribe, updateUser, adjustCompensatoryHours, adjustAnnualLeaveHours, cleanup }
})
