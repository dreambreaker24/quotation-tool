<template>
  <div v-if="hasAny" id="payment-reminders" class="mb-6">
    <h2 class="text-sm font-bold text-gray-700 mb-3 pl-3 border-l-2" style="border-left-color:#c9a96e">付款清單</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

      <!-- 左半：廠商付款排程 -->
      <div id="scheduled-reminders">
        <div class="text-xs font-semibold text-blue-600 mb-2 pl-2 border-l-2 border-blue-300">廠商付款排程</div>
        <div v-if="groupedSegments.length === 0" class="text-[11px] text-gray-400">目前無廠商付款排程</div>
        <div class="flex flex-col gap-3">
          <div v-for="seg in groupedSegments" :key="seg.key"
            class="rounded-xl overflow-hidden border"
            :style="`border-color:${seg.border}; background:${seg.bg}`">
            <!-- 時間段標題 -->
            <div class="px-3 py-1.5 text-[11px] font-bold border-b"
              :style="`color:${seg.textColor}; border-color:${seg.border}`">
              {{ seg.label }}
            </div>
            <!-- 日期分組 -->
            <div v-for="dateGroup in seg.dates" :key="dateGroup.date"
              class="border-b last:border-0"
              :style="`border-color:${seg.border}`">
              <!-- 日期 header -->
              <div class="px-4 py-2 flex items-center gap-2"
                :style="`background:${seg.border}35`">
                <span class="text-sm font-black tracking-wide"
                  :style="`color:${seg.textColor}`">
                  {{ dateGroup.date === '未設日期' ? '未設日期' : formatDate(dateGroup.date) }}
                </span>
                <span v-if="seg.key === 'overdue' && dateGroup.date !== '未設日期'"
                  class="text-[10px] text-red-600 bg-red-100 rounded-full px-2 py-0.5 font-bold">
                  逾期 {{ overdueDays(dateGroup.date) }} 天
                </span>
              </div>
              <!-- 案件分組 -->
              <div class="px-3 py-2.5 flex flex-col gap-2">
                <div v-for="caseGroup in dateGroup.cases" :key="caseGroup.caseId"
                  class="bg-white rounded-lg px-3 py-2.5 shadow-sm">
                  <!-- 案件名稱 -->
                  <div class="flex items-center gap-1.5 mb-2">
                    <div class="w-1 h-3.5 rounded-full flex-shrink-0" :style="`background:${seg.textColor}`"></div>
                    <span class="text-xs font-bold text-gray-800">{{ caseGroup.caseName }}</span>
                  </div>
                  <!-- 工種列表 -->
                  <div class="flex flex-col gap-1.5 pl-2.5">
                    <div v-for="r in caseGroup.items" :key="r.id"
                      class="flex items-center gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center flex-wrap gap-1 text-[11px]">
                          <span class="font-semibold text-gray-700">{{ r.workTypeName }}</span>
                          <template v-if="r.vendorName">
                            <span class="text-gray-300">·</span>
                            <span class="text-gray-400">{{ r.vendorName }}</span>
                          </template>
                          <button v-else @click="jumpToCase(r)"
                            class="text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 text-[10px] hover:bg-red-100 transition-colors font-medium">
                            ⚠️ 未填廠商
                          </button>
                        </div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                          <span class="text-xs font-bold text-gray-800">${{ (r.amount || 0).toLocaleString() }}</span>
                          <span class="text-[10px]"
                            :class="getInvoiceReceived(r) ? 'text-green-600' : 'text-amber-500'">
                            {{ getInvoiceReceived(r) ? '✓ 發票已到' : '待收發票' }}
                          </span>
                        </div>
                      </div>
                      <button v-if="authStore.isManager" @click="markDone(r.id)"
                        :disabled="doneFeedback[r.id]"
                        class="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                        :class="doneFeedback[r.id] ? 'bg-green-500 text-white cursor-default' : 'bg-gray-50 text-green-700 hover:bg-green-50 border border-green-200'">
                        {{ doneFeedback[r.id] ? '✓ 完成' : '完成' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右半：待請款（不動） -->
      <div id="owner-reminders">
        <div class="text-xs font-semibold mb-2 pl-2 border-l-2" style="color:#c9a96e;border-left-color:#c9a96e">待請款</div>
        <div v-if="ownerItems.length === 0" class="text-[11px] text-gray-400">目前無待請款項目</div>
        <div class="flex flex-col gap-2">
          <div v-for="r in ownerItems" :key="r.id"
            class="border border-amber-100 rounded-xl p-3 bg-amber-50/30 border-l-4 hover:shadow-sm transition-shadow" style="border-left-color:#c9a96e">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div v-if="r.source === 'auto'" class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    :class="isOverdue(r.dueDate) ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'">
                    {{ isOverdue(r.dueDate) ? '逾期' : r.dueDate }}
                  </span>
                  <span v-if="isOverdue(r.dueDate)" class="text-[10px] text-gray-400">{{ r.dueDate }}</span>
                </div>
                <div class="text-xs font-semibold text-gray-800 truncate">{{ r.caseName }}</div>
                <div class="text-[11px] text-gray-500 mt-0.5">
                  {{ r.workTypeName }}<template v-if="r.description"> · {{ r.description }}</template>
                </div>
                <div class="text-sm font-bold mt-1" style="color:#c9a96e">${{ (r.amount || 0).toLocaleString() }}</div>
                <div v-if="r.note" class="text-[11px] text-gray-400 mt-0.5">{{ r.note }}</div>
                <div v-if="r.createdByName" class="text-[10px] text-gray-300 mt-1">{{ r.createdByName }} 建立</div>
              </div>
              <button v-if="authStore.isManager" @click="markDone(r.id)"
                :disabled="doneFeedback[r.id]"
                class="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                :class="doneFeedback[r.id] ? 'bg-green-500 text-white cursor-default' : 'bg-green-100 text-green-700 hover:bg-green-200'">
                {{ doneFeedback[r.id] ? '✓ 已完成' : '標記完成' }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'
import { useAuthStore } from '@/stores/auth'
import { useCasesStore } from '@/stores/cases'

const router = useRouter()
const remindersStore = usePaymentRemindersStore()
const authStore = useAuthStore()
const casesStore = useCasesStore()
const doneFeedback = ref({})

function getInvoiceReceived(r) {
    const c = casesStore.cases.find(c => c.id === r.caseId)
    return c?.workTypes?.find(wt => wt.id === r.workTypeId)?.invoiceReceived ?? false
}

function todayStr() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

function isOverdue(dueDate) {
    return !!dueDate && dueDate < todayStr()
}

function overdueDays(dueDate) {
    if (!dueDate) return 0
    const t = new Date(todayStr())
    const d = new Date(dueDate)
    return Math.max(0, Math.floor((t - d) / 86400000))
}

const segmentDefs = computed(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const thisLastDay = new Date(y, m + 1, 0)
    const nextM = m === 11 ? 1 : m + 2
    return [
        { key: 'overdue',   label: `🔴 逾期`,                                bg: '#fef2f2', border: '#fca5a5', textColor: '#dc2626' },
        { key: 'thisMonth', label: `🟠 本月底（${thisLastDay.getMonth()+1}/${thisLastDay.getDate()} 前）`, bg: '#fff7ed', border: '#fdba74', textColor: '#ea580c' },
        { key: 'nextEarly', label: `🟡 下月（${nextM}/1–15）`,               bg: '#fefce8', border: '#fde68a', textColor: '#ca8a04' },
        { key: 'nextLate',  label: `🔵 下月（${nextM}/16 起）`,              bg: '#f0f9ff', border: '#7dd3fc', textColor: '#0284c7' },
    ]
})

function getSegment(dueDate) {
    const t = todayStr()
    if (!dueDate || dueDate < t) return 'overdue'
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const thisEnd = new Date(y, m + 1, 0).toLocaleDateString('sv-SE')
    if (dueDate <= thisEnd) return 'thisMonth'
    const nextY = m === 11 ? y + 1 : y
    const nextM = m === 11 ? 0 : m + 1
    const mid = `${nextY}-${String(nextM + 1).padStart(2, '0')}-15`
    if (dueDate <= mid) return 'nextEarly'
    return 'nextLate'
}

function formatDate(dateStr) {
    if (!dateStr) return '未設日期'
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}月${d.getDate()}日`
}

const groupedSegments = computed(() => {
    // Segment → Date → Case → Items
    const buckets = {}
    for (const r of remindersStore.vendorDisplayItems) {
        const seg = getSegment(r.dueDate)
        const dateKey = r.dueDate || '未設日期'
        const caseKey = r.caseId || '_'
        if (!buckets[seg]) buckets[seg] = {}
        if (!buckets[seg][dateKey]) buckets[seg][dateKey] = {}
        if (!buckets[seg][dateKey][caseKey]) {
            buckets[seg][dateKey][caseKey] = {
                caseId: r.caseId,
                caseName: r.caseName || '未知案件',
                companyId: r.companyId || '',
                items: [],
            }
        }
        buckets[seg][dateKey][caseKey].items.push(r)
    }
    return segmentDefs.value
        .map(def => ({
            ...def,
            dates: Object.entries(buckets[def.key] || {})
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, caseMap]) => ({
                    date,
                    cases: Object.values(caseMap).sort((a, b) => a.caseName.localeCompare(b.caseName)),
                }))
        }))
        .filter(s => s.dates.length > 0)
})

function sortByOverdueThenDate(items) {
    return items.slice().sort((a, b) => {
        const aOver = isOverdue(a.dueDate), bOver = isOverdue(b.dueDate)
        if (aOver !== bOver) return aOver ? -1 : 1
        return (a.dueDate || '').localeCompare(b.dueDate || '')
    })
}

const ownerItems = computed(() => sortByOverdueThenDate([
    ...remindersStore.pendingOwner,
    ...remindersStore.upcomingOwnerSoon,
].filter(r => (r.amount || 0) > 0)))

const hasAny = computed(() => groupedSegments.value.length > 0 || ownerItems.value.length > 0)

function jumpToCase(r) {
    const q = { caseId: r.caseId }
    if (r.companyId) q.region = r.companyId
    router.push({ path: '/cases', query: q })
}

async function markDone(id) {
    doneFeedback.value = { ...doneFeedback.value, [id]: true }
    await remindersStore.markDone(id)
}
</script>
