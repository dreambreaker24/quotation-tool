<template>
  <div class="w-20 sm:w-56 text-white flex-shrink-0 min-h-screen pt-4 pb-6 flex flex-col" style="background:#1e2533">
    <!-- 桌面版：完整分區標籤 -->
    <div class="hidden sm:block px-4 py-2 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">選擇分區</div>
    <div class="px-1 sm:px-3 flex flex-col gap-1">
      <button v-for="r in regions" :key="r.id"
        @click="emit('select-region', r.id)"
        class="rounded-lg py-2 text-left transition-colors px-2 sm:px-3"
        :style="modelValue === r.id ? 'background:#c9a96e;color:#1e2533;font-weight:600' : 'color:#d1d5db'"
        :class="modelValue !== r.id ? 'hover:bg-white/5' : ''">
        <!-- 手機：只顯示縮寫 -->
        <span class="block sm:hidden text-xs text-center">{{ r.short }}</span>
        <!-- 桌面：完整名稱 -->
        <span class="hidden sm:block text-sm">{{ r.label }}</span>
      </button>
    </div>
    <!-- 搜尋框桌面才顯示 -->
    <div class="hidden sm:block mt-4 px-4 py-2 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">案件快搜</div>
    <div class="hidden sm:block px-3">
      <input v-model="search" type="text" placeholder="搜尋案件..."
        class="w-full text-white placeholder-gray-500 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
        style="background:rgba(255,255,255,0.1)">
    </div>
    <div class="px-1 sm:px-3 mt-3 flex flex-col gap-1 overflow-y-auto">
      <div v-for="c in filteredCases" :key="c.id"
        @click="emit('select-region', c.companyId); emit('select-case', c.id)"
        class="rounded-lg px-1.5 sm:px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors flex items-stretch gap-1 sm:gap-2 overflow-hidden">
        <div class="w-0.5 rounded-full flex-shrink-0 self-stretch"
          :style="`background:${STATUS_COLORS[c.status] ?? '#6b7280'}`"></div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-white truncate">{{ c.name }}</div>
          <div class="hidden sm:block text-[10px] text-gray-400">{{ c.assigneeName }}</div>
          <div v-if="deadlineInfo(c)" class="flex items-center gap-1 mt-0.5">
            <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold"
              :style="`color:${deadlineInfo(c).color};background:${deadlineInfo(c).bg}`">
              ⚑ {{ deadlineInfo(c).label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { deadlineInfo } from '@/composables/useDeadlineInfo'

const props = defineProps({ modelValue: String })
const emit = defineEmits(['select-region', 'select-case'])
const casesStore = useCasesStore()
const search = ref('')

const STATUS_COLORS = {
    pending: '#94a3b8',
    negotiating: '#c9a96e',
    drafting: '#f472b6',
    construction: '#3b82f6',
    pending_settlement: '#f97316',
    aftercare: '#22c55e',
    completed: '#22c55e',
    lost: '#ef4444',
}

const regions = [
    { id: 'south', label: '奈拾南區', short: '南' },
    { id: 'north', label: '奈拾北區', short: '北' },
    { id: 'central', label: '奈拾中區', short: '中' }
]

const filteredCases = computed(() => {
    if (search.value) return casesStore.cases.filter(c => c.name.includes(search.value))
    return casesStore.cases.filter(c => c.companyId === props.modelValue)
})
</script>
