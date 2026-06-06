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
    <StatsSection :year="selectedYear" />
    <EmployeeTable :year="selectedYear" class="mt-6" />
    <MonthlyCashFlow :year="selectedYear" :month="currentMonth" class="mt-6" />
  </main>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import StatsSection from '@/components/dashboard/StatsSection.vue'
import EmployeeTable from '@/components/dashboard/EmployeeTable.vue'
import DashboardTodo from '@/components/dashboard/DashboardTodo.vue'
import MonthlyCashFlow from '@/components/dashboard/MonthlyCashFlow.vue'
import { useCasesStore } from '@/stores/cases'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useWorkLogsStore } from '@/stores/workLogs'

const router = useRouter()
const casesStore = useCasesStore()
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const logsStore = useWorkLogsStore()
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

onMounted(() => {
    const regions = authStore.isAdmin
        ? ['south', 'north', 'central']
        : [authStore.companyId]
    const filtered = regions.filter(Boolean)
    casesStore.subscribe(filtered)
    clientsStore.subscribe(filtered)
    if (authStore.isManager) logsStore.subscribePending()
})

onUnmounted(() => {
    logsStore.cleanupPending()
})
</script>
