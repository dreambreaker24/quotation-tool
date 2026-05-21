<template>
  <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
    <!-- Header: month nav + legend -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
      <div class="flex items-center gap-3">
        <button @click="prevMonth" class="text-gray-400 hover:text-gray-700 px-2">◀</button>
        <span class="font-semibold text-gray-800">{{ displayMonth }}</span>
        <button @click="nextMonth" class="text-gray-400 hover:text-gray-700 px-2">▶</button>
      </div>
      <div class="flex items-center gap-4 text-[11px]">
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded" style="background:#c9a96e"></span>案件里程碑
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-blue-400"></span>員工請假
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-red-400"></span>重要記事
        </div>
        <button class="ml-2 text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 新增</button>
      </div>
    </div>

    <!-- Status counters: 6 boxes ABOVE the calendar -->
    <div class="grid grid-cols-6 gap-3 p-4 border-b border-gray-100 bg-gray-50/50">
      <div v-for="s in statuses" :key="s.key" class="bg-white rounded-xl px-3 py-3 shadow-sm text-center">
        <div class="text-xl font-bold" :class="s.color">{{ counts[s.key] }}</div>
        <div class="text-[10px] text-gray-400 mt-0.5">{{ s.label }}</div>
      </div>
    </div>

    <!-- Day headers -->
    <div class="grid grid-cols-7 border-b border-gray-100">
      <div v-for="d in weekDays" :key="d"
        class="text-center text-[11px] font-semibold py-2"
        :class="d==='日'?'text-red-400':d==='六'?'text-blue-400':'text-gray-500'">
        {{ d }}
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="grid grid-cols-7">
      <div v-for="(cell, i) in calendarCells" :key="i"
        class="border-r border-b border-gray-100 p-2 min-h-[90px]"
        :class="[
          !cell.currentMonth && 'opacity-40',
          cell.isToday && 'bg-amber-50/30'
        ]">
        <span class="text-xs" :class="cell.isToday ? 'font-bold' : 'text-gray-600'"
          :style="cell.isToday ? 'color:#c9a96e' : ''">
          {{ cell.day }}
        </span>
        <div v-for="event in cell.events" :key="event.id"
          class="mt-1 text-[10px] rounded px-1.5 py-0.5 truncate text-white"
          :class="event.type === 'milestone' ? '' : event.type === 'leave' ? 'bg-blue-400' : 'bg-red-400'"
          :style="event.type === 'milestone' ? 'background:#c9a96e' : ''">
          {{ event.label }}
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/stores/cases'

const props = defineProps({ region: String })
const casesStore = useCasesStore()
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

const displayMonth = computed(() => `${currentYear.value}年 ${currentMonth.value + 1}月`)

function prevMonth() {
    if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- }
    else currentMonth.value--
}
function nextMonth() {
    if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ }
    else currentMonth.value++
}

const statuses = [
    { key: 'pending',            label: '待約客戶',  color: 'text-gray-700' },
    { key: 'negotiating',        label: '洽談中',    color: 'text-yellow-500' },
    { key: 'drafting',           label: '製圖中',    color: 'text-purple-500' },
    { key: 'construction',       label: '施工中',    color: 'text-blue-500' },
    { key: 'pending_settlement', label: '待結算',    color: 'text-orange-500' },
    { key: 'aftercare',          label: '售後/組裝', color: 'text-green-500' }
]

const counts = computed(() =>
    Object.fromEntries(statuses.map(s => [s.key, casesStore.statusCount(s.key, props.region)]))
)

const calendarCells = computed(() => {
    const cells = []
    const first = new Date(currentYear.value, currentMonth.value, 1)
    const startOffset = first.getDay()
    const daysInMonth = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
    const prevMonthDays = new Date(currentYear.value, currentMonth.value, 0).getDate()

    for (let i = startOffset - 1; i >= 0; i--)
        cells.push({ day: prevMonthDays - i, currentMonth: false, events: [] })

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(currentYear.value, currentMonth.value, d)
        cells.push({
            day: d,
            currentMonth: true,
            isToday: date.toDateString() === today.toDateString(),
            events: []
        })
    }

    while (cells.length % 7 !== 0)
        cells.push({ day: cells.length - daysInMonth - startOffset + 1, currentMonth: false, events: [] })

    return cells
})
</script>
