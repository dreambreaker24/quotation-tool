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
            <button @click="openCashout(name, '平日')"
              class="text-[10px] text-purple-600 px-1.5 py-0.5 rounded border border-purple-200 hover:bg-purple-50">換現金</button>
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
            <button @click="openCashout(name, '休息日')"
              class="text-[10px] text-purple-600 px-1.5 py-0.5 rounded border border-purple-200 hover:bg-purple-50">換現金</button>
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
        <div v-if="expiredSummary(name)" class="mt-1 flex items-center justify-between rounded-lg px-1.5 py-1 bg-amber-50 text-amber-600">
          <span class="text-[10px]">
            補休已到期未用完：平日{{ expiredSummary(name).weekdayHours }}h／休息日{{ expiredSummary(name).holidayHours }}h，應換現金 NT$ {{ expiredSummary(name).amount }}
          </span>
          <button v-if="authStore.isAdmin" @click="confirmExpiredCashout(name)"
            class="text-[10px] px-1.5 py-0.5 rounded border ml-1 flex-shrink-0 text-amber-600 border-amber-300 hover:bg-amber-100">確認到期換現金</button>
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

  <!-- 換現金 Modal -->
  <div v-if="cashoutName" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-72 mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">換現金 — {{ cashoutName }} {{ cashoutType }}補休</h3>
        <button @click="cashoutName = null" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="mb-2 text-xs text-gray-400">目前剩餘：{{ compHours(cashoutName, cashoutType) }} 小時</div>
      <div class="mb-4">
        <label class="text-xs text-gray-500 mb-1 block">要換的時數</label>
        <input v-model.number="cashoutHours" type="number" min="0" :max="compHours(cashoutName, cashoutType)" step="0.5"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>
      <div class="flex justify-end gap-2">
        <button @click="cashoutName = null" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitCashout" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">換現金</button>
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
import { useUsersStore, prevMonthStr, prevMonthOf, monthStr } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { getAnnualLeaveCycleInfo } from '@/utils/annualLeaveSchedule'
import { consumeFIFO, sumRemainingHours, expiredEntries, valueForConsumption } from '@/utils/compLedger'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const usersStore = useUsersStore()
// 其宏、柏是老闆，不追蹤補休/特休餘額，面板不顯示他們（到職日/特休週期試算仍會照常存，只是這裡排除顯示）
const UNTRACKED_NAMES = ['其宏', '柏']
const TRACKED = computed(() => usersStore.users.filter(u => !UNTRACKED_NAMES.includes(u.name)).map(u => u.name))

const ledgerByUid = ref({}) // { [uid]: entries[] }，載入後畫面用這份資料算餘額/到期提醒

async function refreshLedgers() {
    for (const name of TRACKED.value) {
        const user = usersStore.users.find(u => u.name === name)
        if (!user) continue
        const entries = await usersStore.fetchCompLedger(user.id)
        entries.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
        ledgerByUid.value = { ...ledgerByUid.value, [user.id]: entries }
    }
}

function todayStr() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

function ledgerFor(name) {
    const user = usersStore.users.find(u => u.name === name)
    return user ? (ledgerByUid.value[user.id] || []) : []
}

function compHours(name, type) {
    return +sumRemainingHours(ledgerFor(name), type).toFixed(1)
}

function expiredSummary(name) {
    const expired = expiredEntries(ledgerFor(name), todayStr())
    if (expired.length === 0) return null
    const weekdayHours = sumRemainingHours(expired, '平日')
    const holidayHours = sumRemainingHours(expired, '休息日')
    const amount = valueForConsumption(expired, expired.map(e => ({ id: e.id, hours: e.remainingHours })))
    return { entries: expired, weekdayHours, holidayHours, amount }
}

// 稽核記錄（adjustCompensatoryField 寫入 compAdjustments）僅特休適用，補休已改走 compLedger 分錄
const AUDITED_FIELDS = ['annualLeaveHours']

const authStore = useAuthStore()
const { toast } = useToast()

const editingName = ref(null)
const editingField = ref(null)
const editingLabel = ref('')
const editHours = ref(0)
const detailName = ref(null)
const detailType = ref('')
const detailLabel = ref('')
const detailEntries = ref([])
const detailLoading = ref(false)
const detailUserId = ref(null)

function getHours(name, field) {
    if (field === 'compensatoryHours') return compHours(name, '平日')
    if (field === 'compensatoryHolidayHours') return compHours(name, '休息日')
    const user = usersStore.users.find(u => u.name === name)
    return user?.[field] ?? 0
}

watch(() => usersStore.users.length, (len) => {
    if (len > 0) refreshLedgers()
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
    const user = usersStore.users.find(u => u.name === name)
    detailUserId.value = user?.id ?? null
    await loadDetail()
}

async function loadDetail() {
    detailEntries.value = []
    detailLoading.value = true
    try {
        const uid = detailUserId.value
        if (!uid) return
        const type = detailType.value === 'holiday' ? '休息日' : '平日'
        const entries = ledgerFor(detailName.value).filter(e => e.type === type)
        detailEntries.value = entries.map(e => ({
            date: e.createdAt?.toDate?.() ?? null,
            hours: e.hours,
            reason: `${e.source === 'migration' ? '舊資料轉入' : e.source === 'adjustment' ? '人工調整' : '加班核准'}・剩餘${e.remainingHours}h${e.expireDate ? `・到期${e.expireDate}` : ''}`,
            manual: e.source !== 'overtime',
        }))
    } finally {
        detailLoading.value = false
    }
}

function formatDetailDate(date) {
    if (!date) return ''
    return `${date.getMonth() + 1}/${date.getDate()}`
}

const COMP_FIELD_TYPE = { compensatoryHours: '平日', compensatoryHolidayHours: '休息日' }

async function saveEdit() {
    const user = usersStore.users.find(u => u.name === editingName.value)
    if (!user) { toast('找不到此員工', 'error'); return }
    const compType = COMP_FIELD_TYPE[editingField.value]
    try {
        if (compType) {
            const prevValue = compHours(editingName.value, compType)
            const delta = Math.round((editHours.value - prevValue) * 10) / 10
            await adjustCompLedger(user.id, compType, delta, `人工調整（${authStore.name}）`)
        } else if (AUDITED_FIELDS.includes(editingField.value)) {
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
    const compType = COMP_FIELD_TYPE[field]
    try {
        if (compType) {
            const entries = ledgerFor(name).filter(e => e.type === compType && e.remainingHours > 0)
            const totalRemaining = entries.reduce((s, e) => s + e.remainingHours, 0)
            await usersStore.applyLedgerConsumption(user.id, entries.map(e => ({ id: e.id, remainingHours: 0 })))
            if (totalRemaining > 0) {
                await addDoc(collection(db, 'users', user.id, 'compAdjustments'), {
                    field: compType, delta: -totalRemaining,
                    adjustedBy: authStore.name ?? '', adjustedAt: serverTimestamp(),
                })
            }
            await refreshLedgers()
        } else if (AUDITED_FIELDS.includes(field)) {
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

// 手動調整補休分錄：delta>0 新增一筆分錄（用目前底薪／特休週期），delta<0 依FIFO扣減既有分錄
async function adjustCompLedger(uid, type, delta, reason) {
    if (delta === 0) return
    if (delta > 0) {
        const user = usersStore.users.find(u => u.id === uid)
        const cycleInfo = user?.hireDate ? getAnnualLeaveCycleInfo(user.hireDate) : null
        await usersStore.addLedgerEntry(uid, {
            type, hours: delta, remainingHours: delta,
            value: 0, baseRateAtAccrual: 0,
            expireDate: cycleInfo?.nextCycleStart ?? null,
            sourceLogId: null, source: 'adjustment', note: reason,
        })
    } else {
        const entries = ledgerFor(usersStore.users.find(u => u.id === uid)?.name).filter(e => e.type === type)
        const { updatedEntries } = consumeFIFO(entries, type, -delta)
        const touched = updatedEntries.filter(e => entries.find(orig => orig.id === e.id && orig.remainingHours !== e.remainingHours))
        await usersStore.applyLedgerConsumption(uid, touched)
        await addDoc(collection(db, 'users', uid, 'compAdjustments'), {
            field: type, delta,
            adjustedBy: authStore.name ?? '', adjustedAt: serverTimestamp(),
        })
    }
    await refreshLedgers()
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

const cashoutName = ref(null)
const cashoutType = ref('')
const cashoutHours = ref(0)

function openCashout(name, type) {
    cashoutName.value = name
    cashoutType.value = type
    cashoutHours.value = 0
}

async function performCashout(name, type, consumptions, entries, reason) {
    const user = usersStore.users.find(u => u.name === name)
    if (!user) { toast('找不到此員工', 'error'); return }
    const amount = valueForConsumption(entries, consumptions)
    const hours = consumptions.reduce((s, c) => s + c.hours, 0)
    const byId = new Map(entries.map(e => [e.id, e]))
    const updated = consumptions.map(c => ({ id: c.id, remainingHours: byId.get(c.id).remainingHours - c.hours }))
    await usersStore.applyLedgerConsumption(user.id, updated)
    await addDoc(collection(db, 'users', user.id, 'compCashouts'), {
        type, hours, amount,
        payMonth: monthStr(new Date()),
        entriesConsumed: consumptions,
        reason,
        createdBy: authStore.name ?? '',
        createdAt: serverTimestamp(),
    })
    await refreshLedgers()
    toast(`${name} 已換現金 ${hours} 小時，NT$ ${amount}（會出現在本月薪資單）`)
}

async function submitCashout() {
    const hours = cashoutHours.value
    if (!hours || hours <= 0) { toast('請輸入要換的時數', 'error'); return }
    const available = compHours(cashoutName.value, cashoutType.value)
    if (hours > available) { toast('時數超過目前餘額', 'error'); return }
    const entries = ledgerFor(cashoutName.value).filter(e => e.type === cashoutType.value && e.remainingHours > 0)
    const { consumptions } = consumeFIFO(entries, cashoutType.value, hours)
    await performCashout(cashoutName.value, cashoutType.value, consumptions, entries, 'manual')
    cashoutName.value = null
}

async function confirmExpiredCashout(name) {
    const summary = expiredSummary(name)
    if (!summary) return
    if (!confirm(`確定要把 ${name} 已到期的補休（平日${summary.weekdayHours}h／休息日${summary.holidayHours}h，共NT$${summary.amount}）換成現金嗎？`)) return
    const weekdayEntries = summary.entries.filter(e => e.type === '平日')
    const holidayEntries = summary.entries.filter(e => e.type === '休息日')
    if (weekdayEntries.length) {
        const weekdayConsumptions = weekdayEntries.map(e => ({ id: e.id, hours: e.remainingHours }))
        await performCashout(name, '平日', weekdayConsumptions, weekdayEntries, 'expired')
    }
    if (holidayEntries.length) {
        const holidayConsumptions = holidayEntries.map(e => ({ id: e.id, hours: e.remainingHours }))
        await performCashout(name, '休息日', holidayConsumptions, holidayEntries, 'expired')
    }
}
</script>
