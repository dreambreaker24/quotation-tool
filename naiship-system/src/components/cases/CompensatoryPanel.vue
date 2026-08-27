<template>
  <div class="bg-white rounded-2xl shadow-sm px-4 py-3 mb-4">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-sm font-semibold text-gray-700">補休／特休餘額</span>
      <span class="text-[11px] text-gray-400">（已審核加班累積）</span>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div v-for="name in TRACKED" :key="name" class="bg-white rounded-xl px-3 py-3 shadow-sm border border-gray-100 border-t-4" style="border-top-color:#c9a96e">
        <div class="flex items-center gap-1.5 mb-2">
          <span class="text-[11px] text-gray-400">{{ name }}</span>
          <span v-if="lastMonthTotal(name) !== null" class="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
            上月結餘 {{ lastMonthTotal(name) }}h
          </span>
        </div>

        <!-- 平日補休 -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">平日補休</span>
            <span class="text-base font-bold text-red-500">{{ getHours(name, 'compensatoryHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">H</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openDetail(name, 'weekday', '平日補休')"
              class="text-[10px] text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-400">明細</button>
            <button @click="openEdit(name, 'compensatoryHours', '平日補休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'compensatoryHours', '平日補休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>
        <!-- 休息日補休 -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">休息日補休</span>
            <span class="text-base font-bold text-red-500">{{ getHours(name, 'compensatoryHolidayHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">H</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openDetail(name, 'holiday', '休息日補休')"
              class="text-[10px] text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-400">明細</button>
            <button @click="openEdit(name, 'compensatoryHolidayHours', '休息日補休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'compensatoryHolidayHours', '休息日補休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>

        <!-- 特休 -->
        <div class="flex items-center justify-between">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">特休</span>
            <span class="text-base font-bold text-amber-500">{{ getHours(name, 'annualLeaveHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">天</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openEdit(name, 'annualLeaveHours', '特休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'annualLeaveHours', '特休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>
        <div v-if="leaveCycleInfo(name)" class="mt-1 flex items-center justify-between rounded-lg px-1.5 py-1"
          :class="isLeaveCycleDue(name) ? 'bg-amber-50 text-amber-600' : 'text-gray-400'">
          <span class="text-[10px]">依到職日：目前 {{ leaveCycleInfo(name).currentCycleDays }} 天（{{ formatCycleDate(leaveCycleInfo(name).nextCycleStart) }} 起 +{{ leaveCycleInfo(name).nextCycleDays }} 天）</span>
          <button v-if="authStore.isAdmin" @click="applyLeaveCycle(name)" :disabled="!isLeaveCycleDue(name)"
            class="text-[10px] px-1.5 py-0.5 rounded border ml-1 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            :class="isLeaveCycleDue(name) ? 'text-amber-600 border-amber-300 hover:bg-amber-100' : 'text-gray-400 border-gray-200'">套用</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 調整 Modal -->
  <div v-if="editingName" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-72 mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">調整{{ editingLabel }}時數 — {{ editingName }}</h3>
        <button @click="editingName = null" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="mb-4">
        <label class="text-xs text-gray-500 mb-1 block">{{ editingLabel === '特休' ? '天數（天）' : '時數（小時）' }}</label>
        <input v-model.number="editHours" type="number" min="0" step="0.5"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>
      <div class="flex justify-end gap-2">
        <button @click="editingName = null" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="saveEdit" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">儲存</button>
      </div>
    </div>
  </div>

  <!-- 明細 Modal -->
  <div v-if="detailName" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-gray-800">{{ detailLabel }}明細 — {{ detailName }}</h3>
        <button @click="detailName = null" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <select v-model="selectedMonth" class="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mb-2 focus:outline-none focus:ring-1">
        <option value="">本期未結算</option>
        <option v-for="m in availableMonths" :key="m" :value="m">{{ formatMonthLabel(m) }}結算</option>
      </select>
      <div v-if="selectedMonth && selectedMonthBalance !== null" class="text-[11px] text-gray-500 mb-2">
        該月結算後餘額：<span class="font-semibold text-gray-700">{{ selectedMonthBalance }}h</span>
      </div>
      <div v-if="detailLoading" class="text-xs text-gray-400 text-center py-4">載入中…</div>
      <div v-else-if="detailEntries.length === 0" class="text-xs text-gray-400 text-center py-4">尚無已核准的加班記錄或人工調整</div>
      <div v-else class="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
        <div v-for="(e, i) in detailEntries" :key="i" class="flex items-center gap-3 justify-between text-xs border rounded-lg px-3 py-2"
          :class="e.manual ? 'border-amber-100 bg-amber-50' : 'border-gray-100 bg-gray-50'">
          <span class="text-gray-600 whitespace-nowrap">{{ formatDetailDate(e.date) }}</span>
          <span class="font-semibold text-gray-800 whitespace-nowrap">{{ e.hours }} 小時</span>
          <span class="text-gray-400 truncate flex-1 text-right">{{ e.reason }}</span>
        </div>
      </div>
      <div class="flex justify-end mt-4">
        <button @click="detailName = null" class="text-sm text-gray-400 px-4 py-2">關閉</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import { useUsersStore, prevMonthStr, prevMonthOf } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useToast } from '@/composables/useToast'
import { getAnnualLeaveCycleInfo } from '@/utils/annualLeaveSchedule'

const usersStore = useUsersStore()
// 其宏、柏是老闆，不追蹤補休/特休餘額，面板不顯示他們（到職日/特休週期試算仍會照常存，只是這裡排除顯示）
const UNTRACKED_NAMES = ['其宏', '柏']
const TRACKED = computed(() => usersStore.users.filter(u => !UNTRACKED_NAMES.includes(u.name)).map(u => u.name))
// 補休月結（ensureMonthClosed）只跟這兩個欄位有關，特休沒有月結快照機制
const MONTH_CLOSING_FIELDS = ['compensatoryHours', 'compensatoryHolidayHours']
// 稽核記錄（adjustCompensatoryField 寫入 compAdjustments）三個欄位都適用
const AUDITED_FIELDS = ['compensatoryHours', 'compensatoryHolidayHours', 'annualLeaveHours']

const authStore = useAuthStore()
const logsStore = useWorkLogsStore()
const { toast } = useToast()

const editingName = ref(null)
const editingField = ref(null)
const editingLabel = ref('')
const editHours = ref(0)
const lastMonthBalances = ref({})
const detailName = ref(null)
const detailType = ref('')
const detailLabel = ref('')
const detailEntries = ref([])
const detailLoading = ref(false)
const detailUserId = ref(null)
const selectedMonth = ref('')
const availableMonths = ref([])
const selectedMonthBalance = ref(null)

watch(selectedMonth, () => { if (detailName.value) loadDetail() })

function getHours(name, field) {
    const user = usersStore.users.find(u => u.name === name)
    const val = user?.[field] ?? 0
    return field === 'compensatoryHours' ? +val.toFixed(1) : val
}

function lastMonthTotal(name) {
    const b = lastMonthBalances.value[name]
    if (!b) return null
    return +(b.weekdayHours + b.holidayHours).toFixed(1)
}

async function refreshLastMonthBalances() {
    const month = prevMonthStr(new Date())
    for (const name of TRACKED.value) {
        const user = usersStore.users.find(u => u.name === name)
        if (!user) continue
        await usersStore.ensureMonthClosed(user.id)
        lastMonthBalances.value[name] = await usersStore.getClosingBalance(user.id, month)
    }
}

watch(() => usersStore.users.length, (len) => {
    if (len > 0) refreshLastMonthBalances()
}, { immediate: true })

function openEdit(name, field, label) {
    editingName.value = name
    editingField.value = field
    editingLabel.value = label
    editHours.value = getHours(name, field)
}

async function openDetail(name, type, label) {
    detailName.value = name
    detailType.value = type
    detailLabel.value = label
    selectedMonth.value = ''
    selectedMonthBalance.value = null
    const user = usersStore.users.find(u => u.name === name)
    detailUserId.value = user?.id ?? null
    availableMonths.value = user ? await usersStore.listClosingMonths(user.id) : []
    await loadDetail()
}

function formatMonthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number)
    return `${y}年${m}月`
}

async function loadDetail() {
    detailEntries.value = []
    detailLoading.value = true
    try {
        const uid = detailUserId.value
        if (!uid) return
        const field = detailType.value === 'holiday' ? 'compensatoryHolidayHours' : 'compensatoryHours'
        let periodStart = null
        let periodEnd = null
        if (selectedMonth.value) {
            const closing = await usersStore.getClosingBalance(uid, selectedMonth.value)
            periodEnd = closing?.closedAt?.toDate?.() ?? null
            selectedMonthBalance.value = closing
                ? (detailType.value === 'holiday' ? closing.holidayHours : closing.weekdayHours)
                : null
            const prevClosing = await usersStore.getClosingBalance(uid, prevMonthOf(selectedMonth.value))
            periodStart = prevClosing?.closedAt?.toDate?.() ?? null
        } else {
            selectedMonthBalance.value = null
            const user = usersStore.users.find(u => u.id === uid)
            if (user?.compClosedMonth) {
                const closing = await usersStore.getClosingBalance(uid, user.compClosedMonth)
                periodStart = closing?.closedAt?.toDate?.() ?? null
            }
        }
        const [overtimeEntries, adjustments] = await Promise.all([
            logsStore.fetchApprovedOvertimeDetail(uid, detailType.value, periodStart, periodEnd),
            usersStore.fetchCompAdjustments(uid, field, periodStart, periodEnd),
        ])
        detailEntries.value = [...overtimeEntries, ...adjustments].sort((a, b) => (a.date ?? 0) - (b.date ?? 0))
    } finally {
        detailLoading.value = false
    }
}

function formatDetailDate(date) {
    if (!date) return ''
    return `${date.getMonth() + 1}/${date.getDate()}`
}

async function saveEdit() {
    const user = usersStore.users.find(u => u.name === editingName.value)
    if (!user) { toast('找不到此員工', 'error'); return }
    try {
        if (MONTH_CLOSING_FIELDS.includes(editingField.value)) {
            await usersStore.ensureMonthClosed(user.id)
        }
        if (AUDITED_FIELDS.includes(editingField.value)) {
            const prevValue = getHours(editingName.value, editingField.value)
            await usersStore.adjustCompensatoryField(user.id, editingField.value, editHours.value, prevValue, authStore.name)
        } else {
            await usersStore.updateUser(user.id, { [editingField.value]: editHours.value })
        }
        toast(`${editingLabel.value}時數已更新`)
        editingName.value = null
    } catch {
        toast('更新失敗，請重試', 'error')
    }
}

async function confirmReset(name, field, label) {
    if (!confirm(`確定要將 ${name} 的${label}時數歸零？`)) return
    const user = usersStore.users.find(u => u.name === name)
    if (!user) { toast('找不到此員工', 'error'); return }
    try {
        if (MONTH_CLOSING_FIELDS.includes(field)) {
            await usersStore.ensureMonthClosed(user.id)
        }
        if (AUDITED_FIELDS.includes(field)) {
            const prevValue = getHours(name, field)
            await usersStore.adjustCompensatoryField(user.id, field, 0, prevValue, authStore.name)
        } else {
            await usersStore.updateUser(user.id, { [field]: 0 })
        }
        toast(`${name} ${label}時數已歸零`)
    } catch {
        toast('歸零失敗，請重試', 'error')
    }
}

function leaveCycleInfo(name) {
    const user = usersStore.users.find(u => u.name === name)
    if (!user?.hireDate) return null
    return getAnnualLeaveCycleInfo(user.hireDate)
}

function isLeaveCycleDue(name) {
    const user = usersStore.users.find(u => u.name === name)
    const info = leaveCycleInfo(name)
    if (!user || !info) return false
    return info.currentCycleStart > (user.annualLeaveAppliedCycleStart || '')
}

function formatCycleDate(dateStr) {
    const [y, m, d] = dateStr.split('-')
    return `${y}/${m}/${d}`
}

async function applyLeaveCycle(name) {
    const user = usersStore.users.find(u => u.name === name)
    const info = leaveCycleInfo(name)
    if (!user || !info) return
    try {
        const prevValue = getHours(name, 'annualLeaveHours')
        const newValue = prevValue + info.currentCycleDays
        await usersStore.applyAnnualLeaveCycle(user.id, newValue, prevValue, info.currentCycleStart, authStore.name)
        toast(`${name} 特休已套用，+${info.currentCycleDays}天`)
    } catch {
        toast('套用失敗，請重試', 'error')
    }
}
</script>
