<template>
  <div class="flex gap-4">
    <WorkJournalEmployeeList
      :employees="uniqueEmployees"
      :model-value="selectedEmployee"
      @update:model-value="selectedEmployee = $event"
    />

    <!-- Right: log entries -->
    <div class="flex-1 flex flex-col gap-4">
      <div v-if="pendingOnly" class="rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2" style="background:rgba(239,68,68,0.1);color:#ef4444">
        ⚠ 待審核申請（近 30 天）— 共 {{ displayedLogs.length }} 筆
      </div>
      <div class="bg-white rounded-2xl shadow-sm px-4 lg:px-5 py-3 flex flex-col lg:flex-row lg:items-center gap-2">
        <div class="flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="text-sm font-semibold text-gray-800">
              {{ selectedEmployee ? `${selectedEmployee.name} 的工作日誌` : '全部員工工作日誌' }}
            </div>
            <div class="flex items-center gap-1">
              <button @click="shiftDate(-1)" class="text-gray-400 hover:text-gray-700 text-sm leading-none px-2 py-1 min-h-[36px]">◀</button>
              <span class="text-[11px] text-gray-500 whitespace-nowrap">{{ dateLabel }}</span>
              <button @click="shiftDate(1)" :disabled="isAtEnd" class="text-gray-400 hover:text-gray-700 text-sm leading-none px-2 py-1 min-h-[36px] disabled:opacity-30">▶</button>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap lg:flex-nowrap lg:justify-end">
          <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button @click="viewMode = 'day'"
              class="px-2.5 py-1.5 transition-colors"
              :class="viewMode === 'day' ? 'text-white' : 'text-gray-500 hover:bg-gray-50'"
              :style="viewMode === 'day' ? 'background:#1e2533' : ''">單日</button>
            <button @click="viewMode = 'week'"
              class="px-2.5 py-1.5 transition-colors border-l border-gray-200"
              :class="viewMode === 'week' ? 'text-white' : 'text-gray-500 hover:bg-gray-50'"
              :style="viewMode === 'week' ? 'background:#1e2533' : ''">週檢視</button>
          </div>
          <button v-if="viewMode === 'week'" @click="exportWeekLogs"
            class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">匯出本週</button>
          <button v-if="isToday" @click="openLogForm"
            class="text-sm text-white px-4 py-2 rounded-lg w-full lg:w-auto min-h-[40px] font-semibold" style="background:#1e2533">
            + 填寫今日日誌
          </button>
        </div>
      </div>

      <WorkJournalLogCard
        v-for="log in displayedLogs"
        :key="log.id"
        :log="log"
        :can-edit="canEditLog(log)"
        :is-manager="authStore.isManager"
        @edit="openEditForm"
        @approve-fuel="approveFuel"
        @approve-overtime="approveOvertime"
        @reply="handleReply"
        @preview="previewUrl = $event"
      />

      <div v-if="weekSummary" class="bg-white rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
        <span class="text-xs text-gray-400 font-semibold">本週合計</span>
        <div class="flex items-center gap-1">
          <span class="text-gray-500 text-xs">出勤</span>
          <span class="font-semibold text-gray-800">{{ weekSummary.count }} 筆</span>
        </div>
        <div v-if="weekSummary.fuelKm > 0" class="flex items-center gap-1">
          <span class="text-gray-500 text-xs">油資</span>
          <span class="font-semibold text-amber-600">{{ Number(weekSummary.fuelKm).toFixed(2) }} km</span>
          <span class="text-gray-400 text-xs">/ ${{ Number(weekSummary.fuelAmount).toFixed(2) }}</span>
        </div>
      </div>

      <div v-if="displayedLogs.length === 0" class="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
        {{ pendingOnly ? '近 30 天無待審核申請' : viewMode === 'week' ? '本週尚無工作日誌' : '今日尚無工作日誌' }}
      </div>
    </div>
  </div>

  <!-- 照片預覽 -->
  <div v-if="previewUrl" @click="previewUrl = null"
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
  </div>

  <WorkJournalLogForm
    :show="showLogForm"
    :editing-log="editingLog"
    :region="region"
    @close="showLogForm = false; editingLog = null"
    @submitted="showLogForm = false; editingLog = null"
  />
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as XLSX from 'xlsx'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useNotificationsStore } from '@/stores/notifications'
import WorkJournalEmployeeList from './WorkJournalEmployeeList.vue'
import WorkJournalLogCard from './WorkJournalLogCard.vue'
import WorkJournalLogForm from './WorkJournalLogForm.vue'

const props = defineProps({ region: String, pendingOnly: Boolean })
const logsStore = useWorkLogsStore()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const selectedEmployee = ref(null)
const previewUrl = ref(null)
const showLogForm = ref(false)
const editingLog = ref(null)
const selectedDate = ref(new Date())
const viewMode = ref('day')

function openLogForm() {
    editingLog.value = null
    showLogForm.value = true
}

function openEditForm(log) {
    editingLog.value = log
    showLogForm.value = true
}

function isTodayDate(ts) {
    if (!ts) return false
    const d = ts.toDate?.() ?? new Date(ts)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function canEditLog(log) {
    if (authStore.isManager) return true
    return log.userId === authStore.user?.uid && isTodayDate(log.date)
}

async function approveFuel(logId) {
    try {
        await logsStore.approveFuel(logId, authStore.name ?? '')
        toast('油資已確認')
    } catch {
        toast('確認失敗，請重試', 'error')
    }
}

async function approveOvertime(logId) {
    try {
        await logsStore.approveOvertime(logId, authStore.name ?? '')
        toast('加班已確認')
    } catch {
        toast('確認失敗，請重試', 'error')
    }
}

async function handleReply(logId, content) {
    try {
        await logsStore.addReply(logId, content, authStore.user?.uid ?? 'unknown', authStore.name ?? '')
        const log = logsStore.logs.find(l => l.id === logId)
        const ownerName = log?.userName ?? ''
        notifStore.notifyAll(authStore.name ?? '', `回覆了 ${ownerName} 的工作日誌`, '', '', authStore.companyId ?? '')
    } catch {
        toast('回覆失敗，請重試', 'error')
    }
}

function getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
}
function getWeekEnd(date) {
    const start = getWeekStart(date)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
}

const isToday = computed(() => {
    const t = new Date()
    const s = selectedDate.value
    return t.getFullYear() === s.getFullYear() && t.getMonth() === s.getMonth() && t.getDate() === s.getDate()
})

const isAtEnd = computed(() => {
    const today = new Date()
    if (viewMode.value === 'week') return getWeekEnd(selectedDate.value) >= today
    return isToday.value
})

function fmtDate(d) {
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const dateLabel = computed(() => {
    if (viewMode.value === 'week') {
        const ws = getWeekStart(selectedDate.value)
        const we = getWeekEnd(selectedDate.value)
        return `${fmtDate(ws)} - ${fmtDate(we)}`
    }
    const d = selectedDate.value
    if (isToday.value) return `${fmtDate(d)}（今日）`
    return fmtDate(d)
})

function shiftDate(delta) {
    const d = new Date(selectedDate.value)
    const step = viewMode.value === 'week' ? delta * 7 : delta
    d.setDate(d.getDate() + step)
    if (d > new Date()) return
    selectedDate.value = d
}

watch([() => props.region, selectedDate, viewMode], ([region]) => {
    if (!region) return
    if (viewMode.value === 'week') {
        logsStore.subscribe(region, getWeekStart(selectedDate.value), getWeekEnd(selectedDate.value))
    } else {
        logsStore.subscribe(region, selectedDate.value)
    }
}, { immediate: true })

onMounted(() => { if (props.pendingOnly && authStore.isManager) logsStore.subscribePending() })
onUnmounted(() => logsStore.unsubscribe?.())

const uniqueEmployees = computed(() => {
    const seen = new Set()
    return logsStore.logs
        .filter(l => { if (seen.has(l.userId)) return false; seen.add(l.userId); return true })
        .map(l => ({ id: l.userId, name: l.userName, hasLog: true }))
})

const displayedLogs = computed(() => {
    if (props.pendingOnly) return logsStore.pendingLogs
    return selectedEmployee.value
        ? logsStore.logs.filter(l => l.userId === selectedEmployee.value.id)
        : logsStore.logs
})

const weekSummary = computed(() => {
    if (viewMode.value !== 'week' || displayedLogs.value.length === 0) return null
    const totalFuelKm = displayedLogs.value.reduce((sum, log) => {
        const km = log.fuelExpenses?.reduce((s, f) => s + (f.distance || 0), 0) ?? (log.fuelExpense?.distance || 0)
        return sum + km
    }, 0)
    return { count: displayedLogs.value.length, fuelKm: totalFuelKm, fuelAmount: totalFuelKm * 6 }
})

function exportWeekLogs() {
    if (displayedLogs.value.length === 0) { alert('本週無工作日誌記錄'); return }
    const rows = []
    displayedLogs.value.forEach(log => {
        const dateStr = log.date
            ? (() => { const d = log.date.toDate?.() ?? new Date(log.date); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` })()
            : ''
        const caseReport = log.caseEntries?.length
            ? log.caseEntries.map(e => `${e.caseName}：${e.content}`).join('\n')
            : (log.content || '')
        const otherWork = log.otherItems?.map(i => i.content).join('\n') || ''
        const fuelKm = log.fuelExpenses?.reduce((s, f) => s + (f.distance || 0), 0) ?? (log.fuelExpense?.distance || 0)
        rows.push({ '員工姓名': log.userName || '', '日期': dateStr, '案件回報': caseReport, '其他工作': otherWork, '油資(km)': fuelKm || '', '油資($)': fuelKm ? fuelKm * 6 : '' })
    })
    const sheet = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, '工作日誌')
    const weekStart = getWeekStart(selectedDate.value)
    const weekEnd = getWeekEnd(selectedDate.value)
    const fmt = d => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    XLSX.writeFile(wb, `工作日誌_${fmt(weekStart)}_${fmt(weekEnd)}.xlsx`)
}
</script>
