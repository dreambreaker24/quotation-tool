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
            <div class="text-sm font-semibold text-gray-800 pl-3 border-l-2 truncate min-w-0" style="border-left-color:#c9a96e">
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
          <button v-if="authStore.isManager" @click="openProxyPicker"
            class="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg w-full lg:w-auto min-h-[40px] font-semibold hover:border-gray-400">
            + 幫同事補加班/油資
          </button>
        </div>
      </div>

      <WorkJournalLogCard
        v-for="log in displayedLogs"
        :key="log.id"
        :log="log"
        :can-edit="canEditContentFor(log) || canEditOvertimeFuelFor(log)"
        :is-manager="authStore.isManager"
        :is-admin="authStore.isAdmin"
        @edit="openEditForm"
        @approve-fuel="approveFuel"
        @approve-overtime-item="approveOvertimeItem"
        @reply="handleReply"
        @preview="handlePreview"
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
  <div v-if="previewList.length > 0" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    @click.self="closePreview">
    <button v-if="previewIndex > 0" @click="navigatePhoto(-1)"
      class="absolute left-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">‹</button>
    <img :src="previewList[previewIndex]" class="max-h-[80vh] max-w-[80vw] rounded-xl cursor-default">
    <button v-if="previewIndex < previewList.length - 1" @click="navigatePhoto(1)"
      class="absolute right-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">›</button>
  </div>

  <WorkJournalLogForm
    :show="showLogForm"
    :editing-log="editingLog"
    :region="region"
    :can-edit-content="editingLog ? canEditContentFor(editingLog) : true"
    :can-edit-overtime-fuel="editingLog ? canEditOvertimeFuelFor(editingLog) : true"
    @close="showLogForm = false; editingLog = null"
    @submitted="showLogForm = false; editingLog = null"
  />

  <!-- 主管代發：選同事與日期 -->
  <div v-if="showProxyPicker" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">幫同事補加班/油資申請</h3>
        <button @click="showProxyPicker = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">同事 *</label>
          <select v-model="proxyForm.userId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 選擇同事 —</option>
            <option v-for="u in usersStore.users.filter(u => u.companyId === region)" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">日期 *</label>
          <input v-model="proxyForm.date" type="date" :max="todayStr"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showProxyPicker = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitProxyPicker" :disabled="proxySubmitting || !proxyForm.userId || !proxyForm.date"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ proxySubmitting ? '處理中…' : '下一步' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as XLSX from 'xlsx'
import { Timestamp } from 'firebase/firestore'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useNotificationsStore } from '@/stores/notifications'
import { useUsersStore } from '@/stores/users'
import { canEditGeneralContent, canSelfEditOvertimeFuel } from '@/utils/workJournalDeadline'
import WorkJournalEmployeeList from './WorkJournalEmployeeList.vue'
import WorkJournalLogCard from './WorkJournalLogCard.vue'
import WorkJournalLogForm from './WorkJournalLogForm.vue'

const props = defineProps({ region: String, pendingOnly: Boolean, jumpDate: String })
const logsStore = useWorkLogsStore()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const usersStore = useUsersStore()
const { toast } = useToast()

const selectedEmployee = ref(null)
const previewList = ref([])
const previewIndex = ref(0)
const showLogForm = ref(false)
const editingLog = ref(null)
const selectedDate = ref(new Date())
const viewMode = ref('day')

const showProxyPicker = ref(false)
const proxyForm = ref({ userId: '', date: '' })
const proxySubmitting = ref(false)

const todayStr = computed(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function openProxyPicker() {
    proxyForm.value = { userId: '', date: todayStr.value }
    showProxyPicker.value = true
}

async function submitProxyPicker() {
    if (!proxyForm.value.userId || !proxyForm.value.date || proxySubmitting.value) return
    proxySubmitting.value = true
    try {
        const targetUser = usersStore.users.find(u => u.id === proxyForm.value.userId)
        const dateObj = new Date(`${proxyForm.value.date}T00:00:00`)
        let log = await logsStore.findLogForUserDate(proxyForm.value.userId, dateObj)
        if (!log) {
            const docRef = await logsStore.createProxyLog(proxyForm.value.userId, targetUser?.name ?? '', props.region, dateObj)
            log = { id: docRef.id, userId: proxyForm.value.userId, userName: targetUser?.name ?? '', companyId: props.region, date: Timestamp.fromDate(dateObj) }
        }
        showProxyPicker.value = false
        editingLog.value = log
        showLogForm.value = true
    } catch {
        toast('補建日誌失敗，請重試', 'error')
    } finally {
        proxySubmitting.value = false
    }
}

function handlePreview({ urls, index }) {
    previewList.value = urls
    previewIndex.value = index
}

function closePreview() {
    previewList.value = []
    previewIndex.value = 0
}

function navigatePhoto(dir) {
    const next = previewIndex.value + dir
    if (next >= 0 && next < previewList.value.length) previewIndex.value = next
}

function handleKeydown(e) {
    if (!previewList.value.length) return
    if (e.key === 'Escape') { closePreview(); return }
    if (e.key === 'ArrowRight') { e.preventDefault(); navigatePhoto(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); navigatePhoto(-1) }
}

function openLogForm() {
    editingLog.value = null
    showLogForm.value = true
}

function openEditForm(log) {
    editingLog.value = log
    showLogForm.value = true
}

function canEditContentFor(log) {
    if (!canEditGeneralContent(log.date)) return false
    return authStore.isManager || log.userId === authStore.user?.uid
}

function canEditOvertimeFuelFor(log) {
    if (authStore.isManager) return true
    return log.userId === authStore.user?.uid && canSelfEditOvertimeFuel(log.date)
}

async function approveFuel(logId) {
    try {
        await logsStore.approveFuel(logId, authStore.name ?? '')
        toast('油資已確認')
    } catch {
        toast('確認失敗，請重試', 'error')
    }
}

async function approveOvertimeItem(log, itemIndex, isApproved) {
    try {
        await logsStore.approveOvertimeItem(log, itemIndex, isApproved, authStore.name ?? '')
        toast(isApproved ? '加班已同意' : '加班已不同意')
    } catch {
        toast('操作失敗，請重試', 'error')
    }
}

async function handleReply(logId, content) {
    try {
        await logsStore.addReply(logId, content, authStore.user?.uid ?? 'unknown', authStore.name ?? '')
        const log = logsStore.logs.find(l => l.id === logId) ?? logsStore.pendingLogs.find(l => l.id === logId)
        const ownerName = log?.userName ?? ''
        const d = log?.date?.toDate?.() ?? new Date()
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
        const logDateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        notifStore.notifyAll(authStore.name ?? '', `回覆了 ${ownerName} 在 ${dateStr} 的工作日誌`, '', '', authStore.companyId ?? '', logDateISO)
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

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
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
    const wd = `（週${WEEKDAYS[d.getDay()]}）`
    if (isToday.value) return `${fmtDate(d)}${wd}今日`
    return `${fmtDate(d)}${wd}`
})

function shiftDate(delta) {
    const d = new Date(selectedDate.value)
    const step = viewMode.value === 'week' ? delta * 7 : delta
    d.setDate(d.getDate() + step)
    if (d > new Date()) return
    selectedDate.value = d
}

watch(() => props.jumpDate, (d) => {
    if (!d) return
    const parts = d.split('-')
    if (parts.length !== 3) return
    selectedDate.value = new Date(+parts[0], +parts[1] - 1, +parts[2])
}, { immediate: true })

watch([() => props.region, selectedDate, viewMode], ([region]) => {
    if (!region) return
    if (viewMode.value === 'week') {
        logsStore.subscribe(region, getWeekStart(selectedDate.value), getWeekEnd(selectedDate.value))
    } else {
        logsStore.subscribe(region, selectedDate.value)
    }
}, { immediate: true })

onMounted(() => {
    if (props.pendingOnly && authStore.isManager) logsStore.subscribePending()
    window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
    logsStore.unsubscribe?.()
    window.removeEventListener('keydown', handleKeydown)
})

const uniqueEmployees = computed(() => {
    const seen = new Set()
    return logsStore.logs
        .filter(l => { if (seen.has(l.userId)) return false; seen.add(l.userId); return true })
        .map(l => {
            const currentName = usersStore.users.find(u => u.id === l.userId)?.name || l.userName
            return { id: l.userId, name: currentName, hasLog: true }
        })
        .filter(e => e.name)
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
        const empName = usersStore.users.find(u => u.id === log.userId)?.name || log.userName || ''
        rows.push({ '員工姓名': empName, '日期': dateStr, '案件回報': caseReport, '其他工作': otherWork, '油資(km)': fuelKm || '', '油資($)': fuelKm ? fuelKm * 6 : '' })
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
