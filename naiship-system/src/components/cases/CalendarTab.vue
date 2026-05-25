<template>
  <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gray-100">
      <div class="flex items-center gap-3">
        <button @click="prevMonth" class="text-gray-400 hover:text-gray-700 px-2">◀</button>
        <span class="font-semibold text-gray-800">{{ displayMonth }}</span>
        <button @click="nextMonth" class="text-gray-400 hover:text-gray-700 px-2">▶</button>
        <div class="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] ml-2">
          <button @click="showAllRegions = false"
            class="px-2.5 py-1 transition-colors"
            :class="!showAllRegions ? 'text-white' : 'text-gray-500 hover:bg-gray-50'"
            :style="!showAllRegions ? 'background:#1e2533' : ''">本區</button>
          <button @click="showAllRegions = true"
            class="px-2.5 py-1 transition-colors border-l border-gray-200"
            :class="showAllRegions ? 'text-white' : 'text-gray-500 hover:bg-gray-50'"
            :style="showAllRegions ? 'background:#c9a96e' : ''">全區</button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px]">
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background:#c9a96e"></span>案件里程碑</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-blue-400"></span>員工請假</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-red-400"></span>重要記事</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background:#a855f7"></span>客戶跟進</div>
        <button @click="showAddEvent = true" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 新增</button>
      </div>
    </div>

    <!-- Status counters -->
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 p-3 sm:p-4 border-b border-gray-100 bg-gray-50/50">
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
        class="border-r border-b border-gray-100 p-1 sm:p-2 min-h-[70px] sm:min-h-[90px]"
        :class="[
          !cell.currentMonth && 'opacity-40',
          cell.isToday && 'bg-amber-50/30',
          cell.currentMonth && 'cursor-pointer hover:bg-gray-50/50 transition-colors'
        ]"
        @click="cell.currentMonth && openAddOnDate(cell.dateStr)">
        <span class="text-xs" :class="cell.isToday ? 'font-bold' : 'text-gray-600'"
          :style="cell.isToday ? 'color:#c9a96e' : ''">
          {{ cell.day }}
        </span>
        <div v-for="event in cell.events" :key="event.id"
          @click.stop="openEditEvent(event)"
          class="mt-1 text-[10px] rounded px-1.5 py-0.5 truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
          :class="event.type === 'leave' ? 'bg-blue-400' : event.type === 'note' ? 'bg-red-400' : ''"
          :style="event.type === 'milestone' ? 'background:#c9a96e' : event.type === 'followup' ? 'background:#a855f7' : ''">
          {{ event.label }}
        </div>
      </div>
    </div>
  </div>

  <!-- 新增事件 Modal -->
  <div v-if="showAddEvent" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">新增行事曆事件</h3>
        <button @click="showAddEvent = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">事件類型</label>
          <div class="flex gap-2">
            <button v-for="t in eventTypes" :key="t.key"
              @click="eventForm.type = t.key"
              class="flex-1 text-xs py-2 rounded-lg border transition-colors"
              :class="eventForm.type === t.key ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 hover:border-gray-300'"
              :style="eventForm.type === t.key ? `background:${t.color}` : ''">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">日期 *</label>
          <input v-model="eventForm.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <template v-if="eventForm.type === 'leave'">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">請假人員 *</label>
            <select v-model="eventForm.personName" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="">— 請選擇 —</option>
              <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">請假時數 *</label>
            <input v-model.number="eventForm.hours" type="number" min="0" step="0.5"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">事由（選填）</label>
            <input v-model="eventForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：個人事假、病假">
          </div>
        </template>
        <template v-else>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">說明 *</label>
            <input v-model="eventForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
              :placeholder="eventForm.type === 'milestone' ? '例：台南東區翻新 開工' : '例：年度品質回顧'">
          </div>
        </template>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showAddEvent = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitEvent" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">新增</button>
      </div>
    </div>
  </div>

  <!-- 編輯 / 刪除事件 Modal -->
  <div v-if="showEditEvent" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">編輯事件</h3>
        <button @click="showEditEvent = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">事件類型</label>
          <div class="flex gap-2">
            <button v-for="t in eventTypes" :key="t.key"
              @click="editForm.type = t.key"
              class="flex-1 text-xs py-2 rounded-lg border transition-colors"
              :class="editForm.type === t.key ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 hover:border-gray-300'"
              :style="editForm.type === t.key ? `background:${t.color}` : ''">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">日期</label>
          <input v-model="editForm.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <template v-if="editForm.type === 'leave'">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">請假人員</label>
            <select v-model="editForm.personName" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="">— 請選擇 —</option>
              <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">請假時數</label>
            <input v-model.number="editForm.hours" type="number" min="0" step="0.5"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">事由</label>
            <input v-model="editForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </template>
        <template v-else>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">說明</label>
            <input v-model="editForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </template>
      </div>
      <div class="flex justify-between mt-5">
        <button @click="removeEvent" class="text-sm text-red-400 hover:text-red-600 px-3 py-2">刪除</button>
        <div class="flex gap-2">
          <button @click="showEditEvent = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="saveEditEvent" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">儲存</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { Timestamp } from 'firebase/firestore'
import { useCasesStore } from '@/stores/cases'
import { useCalendarEventsStore } from '@/stores/calendarEvents'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useToast } from '@/composables/useToast'

const props = defineProps({ region: String })
const casesStore = useCasesStore()
const eventsStore = useCalendarEventsStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const { toast } = useToast()
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())
const showAddEvent = ref(false)
const showAllRegions = ref(false)
const ALL_REGIONS = ['south', 'north', 'central']

const eventTypes = [
  { key: 'milestone', label: '案件里程碑', color: '#c9a96e' },
  { key: 'leave',     label: '員工請假',   color: '#60a5fa' },
  { key: 'note',      label: '重要記事',   color: '#f87171' },
  { key: 'followup',  label: '客戶跟進',   color: '#a855f7' },
]
const blankEvent = () => ({ type: 'milestone', date: '', label: '', personName: '', hours: 0 })
const eventForm = ref(blankEvent())
const showEditEvent = ref(false)
const editingEventId = ref(null)
const editForm = ref({ type: 'milestone', date: '', label: '', personName: '', hours: 0 })

function tsToDateStr(ts) {
  const d = ts?.toDate?.() ?? new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function openEditEvent(event) {
  editingEventId.value = event.id
  editForm.value = {
    type: event.type, date: tsToDateStr(event.date), label: event.label || '',
    personName: event.personName || '', hours: event.hours || 0,
  }
  showEditEvent.value = true
}

async function saveEditEvent() {
  if (!editForm.value.date) return
  const isLeave = editForm.value.type === 'leave'
  if (isLeave && !editForm.value.personName) return
  if (!isLeave && !editForm.value.label) return
  try {
    const payload = {
      type: editForm.value.type,
      date: Timestamp.fromDate(new Date(editForm.value.date)),
      label: isLeave
        ? `${editForm.value.personName} 請假${editForm.value.hours ? ` ${editForm.value.hours}h` : ''}`
        : editForm.value.label,
    }
    if (isLeave) {
      payload.personName = editForm.value.personName
      payload.hours = editForm.value.hours || 0
    }
    await eventsStore.updateEvent(editingEventId.value, payload)
    showEditEvent.value = false
  } catch {
    toast('儲存失敗，請重試', 'error')
  }
}

async function removeEvent() {
  try {
    await eventsStore.deleteEvent(editingEventId.value)
    showEditEvent.value = false
  } catch {
    toast('刪除失敗，請重試', 'error')
  }
}

watch([() => props.region, currentYear, currentMonth, showAllRegions], ([region]) => {
  if (region) eventsStore.subscribe(
    showAllRegions.value ? ALL_REGIONS : region,
    currentYear.value, currentMonth.value
  )
}, { immediate: true })

onUnmounted(() => eventsStore.cleanup())

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
    const dayEvents = eventsStore.events.filter(e => {
      const eDate = e.date?.toDate?.() ?? new Date(e.date)
      return eDate.getFullYear() === currentYear.value &&
             eDate.getMonth() === currentMonth.value &&
             eDate.getDate() === d
    })
    cells.push({
      day: d, currentMonth: true,
      isToday: date.toDateString() === today.toDateString(),
      dateStr: `${currentYear.value}-${String(currentMonth.value + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
      events: dayEvents
    })
  }
  while (cells.length % 7 !== 0)
    cells.push({ day: cells.length - daysInMonth - startOffset + 1, currentMonth: false, events: [] })
  return cells
})

function openAddOnDate(dateStr) {
    eventForm.value = { ...blankEvent(), date: dateStr }
    showAddEvent.value = true
}

async function submitEvent() {
  if (!eventForm.value.date) return
  const isLeave = eventForm.value.type === 'leave'
  if (isLeave && !eventForm.value.personName) return
  if (!isLeave && !eventForm.value.label) return
  try {
    const payload = {
      companyId: props.region,
      type: eventForm.value.type,
      date: Timestamp.fromDate(new Date(eventForm.value.date)),
      label: isLeave
        ? `${eventForm.value.personName} 請假${eventForm.value.hours ? ` ${eventForm.value.hours}h` : ''}`
        : eventForm.value.label,
      createdBy: authStore.user?.uid ?? '',
    }
    if (isLeave) {
      payload.personName = eventForm.value.personName
      payload.hours = eventForm.value.hours || 0
    }
    await eventsStore.addEvent(payload)
    eventForm.value = blankEvent()
    showAddEvent.value = false
  } catch {
    toast('新增失敗，請重試', 'error')
  }
}
</script>
