<template>
  <div class="w-full sm:w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 sm:min-h-screen">
    <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
      <span class="text-sm font-semibold pl-2 border-l-2" style="color:#1e2533;border-left-color:#c9a96e">客戶列表</span>
      <button @click="emit('add')" class="text-xs text-white px-2 py-1 rounded-lg" style="background:#1e2533">+ 新增</button>
    </div>
    <div class="px-4 py-2 border-b border-gray-100 flex flex-col gap-1.5">
      <input v-model="search" type="text" placeholder="搜尋客戶..."
        class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
      <select v-model="statusFilter" class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1">
        <option value="">全部狀態</option>
        <option value="contacted">初次接觸</option>
        <option value="negotiating">洽談中</option>
        <option value="signed">已簽約</option>
        <option value="completed">已完工</option>
        <option value="returning">回頭客</option>
        <option value="lost">已流失</option>
      </select>
      <select v-model="regionFilter" class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1">
        <option value="">全部分區</option>
        <option value="south">奈拾南區</option>
        <option value="north">奈拾北區</option>
        <option value="central">奈拾中區</option>
      </select>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-for="c in filteredClients" :key="c.id"
        @click="emit('select', c)"
        class="px-4 py-3 cursor-pointer border-b border-gray-100 transition-all border-l-4"
        :style="selected?.id === c.id ? 'background:rgba(201,169,110,0.1);border-left-color:#c9a96e' : 'border-left-color:transparent'"
        :class="selected?.id !== c.id ? 'hover:bg-amber-50/40 hover:border-l-amber-200 hover:-translate-y-px' : ''">
        <div class="text-sm font-medium text-gray-800">{{ c.name }}</div>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="text-[10px] px-2 py-0.5 rounded-full" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
          <span v-if="isDueFollowUp(c)" class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">跟進</span>
          <span class="text-[10px] text-gray-400">{{ c.phone }}</span>
        </div>
      </div>
      <div v-if="filteredClients.length === 0" class="px-4 py-6 text-center text-gray-400 text-xs">
        尚無客戶資料
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useClientsStore } from '@/stores/clients'

const props = defineProps({ selected: Object })
const emit = defineEmits(['select', 'add'])
const clientsStore = useClientsStore()
const search = ref('')
const statusFilter = ref('')
const regionFilter = ref('')

const filteredClients = computed(() =>
    clientsStore.clients.filter(c => {
        if (search.value && !c.name?.includes(search.value) && !c.phone?.includes(search.value)) return false
        if (statusFilter.value && c.status !== statusFilter.value) return false
        if (regionFilter.value && c.companyId !== regionFilter.value) return false
        return true
    })
)

const statusMap = { contacted: '初次接觸', negotiating: '洽談中', signed: '已簽約', completed: '已完工', returning: '回頭客', lost: '已流失' }
const statusClassMap = {
    contacted: 'bg-gray-100 text-gray-500',
    negotiating: 'bg-amber-100 text-amber-700',
    signed: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    returning: 'bg-purple-100 text-purple-700',
    lost: 'bg-red-100 text-red-500'
}
function statusLabel(s) { return statusMap[s] ?? s }
function statusClass(s) { return statusClassMap[s] ?? 'bg-gray-100 text-gray-500' }
function isDueFollowUp(c) {
    if (!c.followUpDate) return false
    return c.followUpDate <= new Date().toISOString().slice(0, 10)
}
</script>
