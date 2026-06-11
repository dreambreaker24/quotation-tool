<template>
  <aside class="w-56 text-white flex-shrink-0 min-h-screen pt-4 pb-6 overflow-y-auto" style="background:#1e2533">
    <!-- 待確認申請（主管才看得到） -->
    <div v-if="authStore.isManager && pendingCount > 0" class="mx-3 mb-4 rounded-xl p-3" style="background:rgba(239,68,68,0.15)">
      <div class="text-[10px] text-red-300 font-semibold uppercase tracking-wide mb-1">待確認申請</div>
      <div class="text-white text-sm font-bold">{{ pendingCount }} 筆</div>
      <div class="text-[10px] text-gray-400 mt-0.5">油資 / 加班待確認</div>
      <button @click="router.push({ name: 'cases', query: { tab: 'log', pendingOnly: 'true' } })"
        class="mt-2 text-[10px] text-amber-300 hover:text-amber-100 underline">前往工作日誌審核</button>
    </div>

    <div v-if="authStore.isManager && hasPendingPayments"
      class="mx-3 mb-4 rounded-xl p-3" style="background:rgba(201,169,110,0.15)">
      <div class="text-[10px] font-semibold uppercase tracking-wide mb-1" style="color:#c9a96e">待付款</div>
      <div v-if="pendingOwnerCount > 0" class="text-white text-xs">向業主請款 {{ pendingOwnerCount }} 筆</div>
      <div v-if="pendingVendorCount > 0" class="text-white text-xs">廠商匯款 {{ pendingVendorCount }} 筆</div>
      <a href="#payment-reminders"
        class="mt-2 block text-[10px] underline hover:opacity-80" style="color:#c9a96e">前往待付款清單</a>
    </div>

    <div v-if="authStore.isManager && hasUpcomingAuto"
      class="mx-3 mb-4 rounded-xl p-3" style="background:rgba(59,130,246,0.15)">
      <div class="text-[10px] text-blue-300 font-semibold uppercase tracking-wide mb-1">即將到期</div>
      <div class="text-white text-sm font-bold">{{ upcomingAutoCount }} 筆</div>
      <div class="text-[10px] text-gray-400 mt-0.5">本月底及下月排程</div>
      <a href="#scheduled-reminders"
        class="mt-2 block text-[10px] text-blue-300 hover:text-blue-100 underline">前往排程提醒</a>
    </div>

    <div class="px-4 py-2 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">進行中案件</div>
    <div v-for="(regionCases, region) in activeCasesByRegion" :key="region" class="px-3 mt-2">
      <div class="text-[11px] font-semibold px-2 py-1" style="color:#c9a96e">{{ regionName[region] }}</div>
      <div v-for="c in regionCases" :key="c.id"
        @click="goToCase(c)"
        class="rounded-lg px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors">
        <div class="text-xs font-medium text-white">{{ c.name }}</div>
        <div class="text-[10px] text-gray-400">負責：{{ c.assigneeName }}</div>
      </div>
    </div>
  </aside>
  <main class="flex-1 p-6 overflow-auto">
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold text-gray-800">{{ selectedYear }} 年度總覽</h1>
        <select v-model="selectedYear" class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option v-for="y in years" :key="y">{{ y }}</option>
        </select>
      </div>
    </div>
    <DashboardTodo class="mb-4" />
    <PaymentReminders class="mt-4" />
    <StatsSection :year="selectedYear" />
    <EmployeeTable :year="selectedYear" class="mt-6" />
    <MonthlyCashFlow :year="selectedYear" :month="currentMonth" class="mt-6" />
  </main>
</template>
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import StatsSection from '@/components/dashboard/StatsSection.vue'
import EmployeeTable from '@/components/dashboard/EmployeeTable.vue'
import DashboardTodo from '@/components/dashboard/DashboardTodo.vue'
import MonthlyCashFlow from '@/components/dashboard/MonthlyCashFlow.vue'
import PaymentReminders from '@/components/dashboard/PaymentReminders.vue'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'
import { useCasesStore } from '@/stores/cases'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useWorkLogsStore } from '@/stores/workLogs'

const router = useRouter()
const casesStore = useCasesStore()
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const logsStore = useWorkLogsStore()

function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calcVendorDueDate(endDate) {
    const d = new Date(endDate + 'T00:00:00')
    const day = d.getDate()
    const nextMonthDate = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const year = nextMonthDate.getFullYear()
    const month = nextMonthDate.getMonth()
    const targetDay = day <= 15 ? 15 : new Date(year, month + 1, 0).getDate()
    const result = new Date(year, month, targetDay)
    while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() + 1)
    return toDateStr(result)
}

function calcOwnerDueDate(startDate) {
    const d = new Date(startDate + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    return toDateStr(d)
}

function wtVendorCostTotal(wt) {
    if (wt.vendorCostFree) return 0
    const items = wt.vendorCostItems ?? (wt.vendorCost > 0 ? [{ amount: wt.vendorCost }] : [])
    return (items || []).reduce((s, i) => s + (i.amount || 0), 0)
}

function wtPaymentTotal(wt) {
    if (wt.paymentFree) return 0
    const items = wt.paymentItems ?? (wt.payment > 0 ? [{ amount: wt.payment }] : [])
    return (items || []).reduce((s, i) => s + (i.amount || 0), 0)
}

const BACKFILL_KEY = 'naiship_reminders_backfilled_v3'

async function backfillReminders() {
    if (localStorage.getItem(BACKFILL_KEY)) return
    const today = new Date().toISOString().slice(0, 10)
    for (const c of casesStore.cases) {
        for (const wt of (c.workTypes || [])) {
            if (wt.done) {
                const vendorCost = wtVendorCostTotal(wt)
                const vendorPaid = (wt.vendorPayments || []).reduce((s, vp) => s + (vp.amount || 0), 0)
                if (vendorCost > 0 && vendorPaid >= vendorCost) {
                    await remindersStore.deleteAutoReminder(`auto_vendor_${wt.id}`)
                } else {
                    const effectiveEnd = wt.endDate || today
                    await remindersStore.addAutoReminder(`auto_vendor_${wt.id}`, {
                        source: 'auto', type: 'vendor',
                        dueDate: calcVendorDueDate(effectiveEnd),
                        caseId: c.id, caseName: c.name,
                        companyId: c.companyId ?? '',
                        workTypeId: wt.id, workTypeName: wt.name,
                        vendorName: wt.vendorName || '',
                        amount: wtVendorCostTotal(wt),
                        createdBy: authStore.user?.uid ?? '',
                        createdByName: authStore.name ?? '',
                    })
                }
            }
            if (wt.startDate) {
                await remindersStore.addAutoReminder(`auto_owner_${wt.id}`, {
                    source: 'auto', type: 'owner',
                    dueDate: calcOwnerDueDate(wt.startDate),
                    caseId: c.id, caseName: c.name,
                    companyId: c.companyId ?? '',
                    workTypeId: wt.id, workTypeName: wt.name,
                    vendorName: wt.vendorName || '',
                    amount: wtPaymentTotal(wt),
                    createdBy: authStore.user?.uid ?? '',
                    createdByName: authStore.name ?? '',
                })
            }
        }
    }
    localStorage.setItem(BACKFILL_KEY, '1')
}

const backfillTriggered = ref(false)
watch(() => casesStore.cases.length, (len) => {
    if (len > 0 && !backfillTriggered.value && authStore.isManager) {
        backfillTriggered.value = true
        backfillReminders()
    }
})
const selectedYear = ref(new Date().getFullYear())
const currentMonth = new Date().getMonth() + 1
const years = Array.from({ length: 5 }, (_, i) => selectedYear.value - i)

const regionName = { north: '奈拾北區', central: '奈拾中區', south: '奈拾南區' }

function goToCase(c) {
    router.push({ name: 'cases', query: { region: c.companyId, caseId: c.id } })
}

const activeCasesByRegion = computed(() => {
    const result = {}
    casesStore.activeCases.forEach(c => {
        if (!result[c.companyId]) result[c.companyId] = []
        result[c.companyId].push(c)
    })
    Object.keys(result).forEach(r => { result[r] = result[r].slice(0, 3) })
    return result
})

const pendingCount = computed(() => logsStore.pendingLogs.length)

const remindersStore = usePaymentRemindersStore()
const pendingOwnerCount = computed(() => remindersStore.pendingOwner.length)
const pendingVendorCount = computed(() => remindersStore.pendingVendor.length)
const hasPendingPayments = computed(() => pendingOwnerCount.value > 0 || pendingVendorCount.value > 0)
const upcomingAutoCount = computed(() => remindersStore.upcomingAutoSoon.length)
const hasUpcomingAuto = computed(() => upcomingAutoCount.value > 0)

onMounted(() => {
    const regions = authStore.isAdmin
        ? ['south', 'north', 'central']
        : [authStore.companyId]
    const filtered = regions.filter(Boolean)
    casesStore.subscribe(filtered)
    clientsStore.subscribe(filtered)
    if (authStore.isManager) logsStore.subscribePending()
    remindersStore.subscribe()
})

onUnmounted(() => {
    logsStore.cleanupPending()
    remindersStore.cleanup()
})
</script>
