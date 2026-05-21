<template>
  <CaseSidebar :model-value="selectedRegion" @select-region="selectedRegion = $event" />
  <main class="flex-1 flex flex-col overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-6 flex items-center gap-1 flex-shrink-0">
      <button v-for="tab in tabs" :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-3 text-sm transition-colors"
        :class="activeTab === tab.id ? 'border-b-2 font-semibold' : 'text-gray-500 hover:text-gray-700'"
        :style="activeTab === tab.id ? 'border-color:#c9a96e;color:#c9a96e' : ''">
        {{ tab.label }}
      </button>
      <div class="ml-auto flex items-center gap-2 py-2">
        <button class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 新增案件</button>
        <select v-model="selectedMonth" class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>
    <div class="flex-1 overflow-auto p-6">
      <CalendarTab v-if="activeTab === 'cal'" :region="selectedRegion" />
      <GanttTab v-else-if="activeTab === 'gantt'" :region="selectedRegion" :month="selectedMonth" />
      <WorkJournalTab v-else-if="activeTab === 'log'" :region="selectedRegion" />
    </div>
  </main>
</template>
<script setup>
import { ref, computed } from 'vue'
import CaseSidebar from '@/components/cases/CaseSidebar.vue'
import CalendarTab from '@/components/cases/CalendarTab.vue'
import GanttTab from '@/components/cases/GanttTab.vue'
import WorkJournalTab from '@/components/cases/WorkJournalTab.vue'

const selectedRegion = ref('south')
const activeTab = ref('cal')
const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)

const tabs = [
  { id: 'cal', label: '行事曆' },
  { id: 'gantt', label: '案件進度' },
  { id: 'log', label: '工作日誌' }
]

const monthOptions = computed(() => {
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: `${d.getFullYear()}年 ${d.getMonth()+1}月`
    })
  }
  return opts
})
</script>
