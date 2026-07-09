import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'

export const useLeaveRecordsStore = defineStore('leaveRecords', () => {
    const cache = ref({})

    function docId(year, name) {
        return `${year}__${name}`
    }

    async function fetchRecord(year, name) {
        const id = docId(year, name)
        if (cache.value[id]) return cache.value[id]
        const snap = await getDoc(doc(db, 'leaveRecords', id))
        const data = snap.exists() ? snap.data() : { year, employeeName: name, records: [] }
        cache.value[id] = data
        return data
    }

    function summarize(record) {
        const r = record?.records ?? []
        return {
            sickDays: r.reduce((s, e) => s + (e.sickDays || 0), 0),
            personalDays: r.reduce((s, e) => s + (e.personalDays || 0), 0),
            typhoonDays: r.reduce((s, e) => s + (e.typhoonDays || 0), 0),
        }
    }

    async function saveRecord(year, name, month, { sickDays, personalDays, typhoonDays }, recordedBy) {
        const id = docId(year, name)
        const docRef = doc(db, 'leaveRecords', id)
        const entry = {
            month,
            sickDays: sickDays || 0,
            personalDays: personalDays || 0,
            typhoonDays: typhoonDays || 0,
            recordedAt: new Date().toISOString(),
            recordedBy,
        }
        const snap = await getDoc(docRef)
        if (!snap.exists()) {
            await setDoc(docRef, { year, employeeName: name, records: [entry] })
        } else {
            const filtered = (snap.data().records ?? []).filter(r => r.month !== month)
            await updateDoc(docRef, { records: [...filtered, entry] })
        }
        delete cache.value[id]
    }

    async function deleteMonthRecord(year, name, month) {
        const id = docId(year, name)
        const docRef = doc(db, 'leaveRecords', id)
        const snap = await getDoc(docRef)
        if (!snap.exists()) return
        const filtered = (snap.data().records ?? []).filter(r => r.month !== month)
        await updateDoc(docRef, { records: filtered })
        delete cache.value[id]
    }

    return { fetchRecord, summarize, saveRecord, deleteMonthRecord }
})
