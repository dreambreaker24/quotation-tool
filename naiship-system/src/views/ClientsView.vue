<template>
  <ClientList :selected="selectedClient" @select="selectClient" @add="showForm = true" />
  <ClientDetail :client="selectedClient" :notes="clientNotes" />
</template>
<script setup>
import { ref } from 'vue'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/firebase'
import ClientList from '@/components/clients/ClientList.vue'
import ClientDetail from '@/components/clients/ClientDetail.vue'

const selectedClient = ref(null)
const clientNotes = ref([])
const showForm = ref(false)

async function loadNotes(clientId) {
  if (!clientId) { clientNotes.value = []; return }
  const q = query(collection(db, 'clients', clientId, 'notes'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  clientNotes.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function selectClient(client) {
  selectedClient.value = client
  await loadNotes(client?.id)
}
</script>
