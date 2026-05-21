<template>
  <div v-if="client" class="flex-1 p-6 overflow-auto">
    <div class="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <h2 class="text-lg font-bold text-gray-800 mb-4">{{ client.name }}</h2>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-400 text-xs block mb-0.5">電話</span><p class="text-gray-700">{{ client.phone || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">Email</span><p class="text-gray-700">{{ client.email || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">Line ID</span><p class="text-gray-700">{{ client.lineId || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">地址</span><p class="text-gray-700">{{ client.address || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">來源</span><p class="text-gray-700">{{ client.source || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">預算</span><p class="text-gray-700">{{ client.budget ? `$${client.budget.toLocaleString()}` : '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">坪數</span><p class="text-gray-700">{{ client.area ? `${client.area} 坪` : '—' }}</p></div>
        <div>
          <span class="text-gray-400 text-xs block mb-0.5">狀態</span>
          <select :value="client.status" @change="updateStatus($event.target.value)"
            class="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1">
            <option value="contacted">初次接觸</option>
            <option value="negotiating">洽談中</option>
            <option value="signed">已簽約</option>
            <option value="completed">已完工</option>
            <option value="lost">已流失</option>
          </select>
        </div>
        <div v-if="client.status === 'lost'" class="col-span-2">
          <span class="text-gray-400 text-xs block mb-0.5">流失原因</span>
          <p class="text-gray-700">{{ client.lostReason || '—' }}</p>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <ClientNotes :client-id="client.id" :notes="notes" />
    </div>
  </div>
  <div v-else class="flex-1 flex items-center justify-center">
    <p class="text-sm text-gray-400">請從左側選擇客戶</p>
  </div>
</template>
<script setup>
import ClientNotes from './ClientNotes.vue'
import { useClientsStore } from '@/stores/clients'

const props = defineProps({ client: Object, notes: { type: Array, default: () => [] } })
const clientsStore = useClientsStore()

async function updateStatus(status) {
    await clientsStore.updateClient(props.client.id, { status })
}
</script>
