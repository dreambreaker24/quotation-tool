import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

export const useWorkLogsStore = defineStore('workLogs', () => {
  const logs = ref([])
  let unsubscribe = null

  function subscribe(companyId, date) {
    if (unsubscribe) unsubscribe()
    const start = new Date(date); start.setHours(0,0,0,0)
    const end = new Date(date); end.setHours(23,59,59,999)
    const q = query(
      collection(db, 'workLogs'),
      where('companyId', '==', companyId),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date')
    )
    unsubscribe = onSnapshot(q, snap => {
      logs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  }

  async function addLog(data) {
    return addDoc(collection(db, 'workLogs'), { ...data, createdAt: serverTimestamp() })
  }

  async function addReply(logId, content, userId) {
    return addDoc(collection(db, 'workLogs', logId, 'replies'), {
      content, createdBy: userId, createdAt: serverTimestamp()
    })
  }

  return { logs, subscribe, addLog, addReply }
})
