<template>
  <ClientList :selected="selectedClient" @select="selectedClient = $event" @add="showForm = true" />
  <ClientDetail :client="selectedClient" :notes="[]" />
</template>
<script setup>
import { ref } from 'vue'
import ClientList from '@/components/clients/ClientList.vue'
import ClientDetail from '@/components/clients/ClientDetail.vue'
const selectedClient = ref(null)
const showForm = ref(false)
</script>
