<template>
  <div class="w-56 text-white flex-shrink-0 min-h-screen pt-4 pb-6 flex flex-col" style="background:#1e2533">
    <div class="px-4 py-2 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">選擇分區</div>
    <div class="px-3 flex flex-col gap-1">
      <button v-for="r in regions" :key="r.id"
        @click="emit('select-region', r.id)"
        class="rounded-lg px-3 py-2.5 text-sm text-left transition-colors"
        :style="modelValue === r.id ? 'background:#c9a96e;color:#1e2533;font-weight:600' : 'color:#d1d5db'"
        :class="modelValue !== r.id ? 'hover:bg-white/5' : ''">
        {{ r.label }}
      </button>
    </div>
    <div class="mt-4 px-4 py-2 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">案件快搜</div>
    <div class="px-3">
      <input v-model="search" type="text" placeholder="搜尋案件..."
        class="w-full text-white placeholder-gray-500 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
        style="background:rgba(255,255,255,0.1)">
    </div>
    <div class="px-3 mt-3 flex flex-col gap-1 overflow-y-auto">
      <div v-for="c in filteredCases" :key="c.id"
        class="rounded-lg px-3 py-2 cursor-pointer hover:bg-white/5">
        <div class="text-xs font-medium text-white">{{ c.name }}</div>
        <div class="text-[10px] text-gray-400">{{ c.assigneeName }}</div>
        <div v-if="deadlineInfo(c)" class="flex items-center gap-1 mt-0.5">
          <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold"
            :style="`color:${deadlineInfo(c).color};background:${deadlineInfo(c).bg}`">
            ⚑ {{ deadlineInfo(c).label }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/stores/cases'

const props = defineProps({ modelValue: String })
const emit = defineEmits(['select-region'])
const casesStore = useCasesStore()
const search = ref('')

const regions = [
    { id: 'south', label: '奈拾南區' },
    { id: 'north', label: '奈拾北區' },
    { id: 'central', label: '奈拾中區' }
]

function deadlineInfo(c) {
    if (!c.deadline) return null
    const d = c.deadline.toDate?.() ?? new Date(c.deadline)
    const days = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
    if (days < 0) return { label: `逾期 ${Math.abs(days)} 天`, color: '#ef4444', bg: 'rgba(239,68,68,0.2)' }
    if (days <= 14) return { label: `剩 ${days} 天`, color: '#f97316', bg: 'rgba(249,115,22,0.2)' }
    if (days <= 30) return { label: `剩 ${days} 天`, color: '#f59e0b', bg: 'rgba(245,158,11,0.2)' }
    return { label: `剩 ${days} 天`, color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' }
}

const filteredCases = computed(() =>
    casesStore.cases
        .filter(c => c.companyId === props.modelValue)
        .filter(c => !search.value || c.name.includes(search.value))
)
</script>
