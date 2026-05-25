<template>
  <div class="bg-white rounded-2xl shadow-sm p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">員工績效</h2>
      <div class="flex items-center gap-2">
        <button @click="refreshData" :disabled="refreshing"
          class="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-500 hover:border-gray-400 disabled:opacity-40">
          {{ refreshing ? '更新中…' : '↻ 更新里程' }}
        </button>
        <select v-model="selectedRegion" class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option value="">全部分區</option>
          <option value="north">奈拾北區</option>
          <option value="central">奈拾中區</option>
          <option value="south">奈拾南區</option>
        </select>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="bg-gray-50">
            <th class="text-left px-3 py-2 text-gray-500 font-semibold sticky left-0 bg-gray-50 min-w-[110px]">員工</th>
            <th class="text-center px-2 py-2 text-gray-500 font-semibold min-w-[80px]">本月加班</th>
            <th class="text-center px-2 py-2 text-gray-500 font-semibold min-w-[90px]">本月油資</th>
            <th class="text-center px-2 py-2 text-gray-500 font-semibold min-w-[90px]">本月出勤</th>
            <th class="text-center px-2 py-2 text-gray-500 font-semibold min-w-[60px]">未成案</th>
            <th v-for="m in months" :key="m" class="text-center px-2 py-2 text-gray-500 font-semibold min-w-[70px]">
              {{ String(m).padStart(2, '0') }}
            </th>
            <th class="text-center px-2 py-2 text-gray-500 font-semibold bg-amber-50 min-w-[90px]">年度合計</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in employeeRows" :key="emp.userId" class="border-t border-gray-100 hover:bg-gray-50">
            <td class="px-3 py-2.5 sticky left-0 bg-white">
              <div class="font-semibold text-gray-700">{{ emp.name }}</div>
            </td>
            <td class="text-center px-2 py-2.5">
              <template v-if="monthlyOvertime[emp.name]">
                <div class="text-purple-600 font-medium">{{ monthlyOvertime[emp.name] }} h</div>
              </template>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="text-center px-2 py-2.5">
              <template v-if="monthlyKm[emp.name]">
                <div class="text-amber-600 font-medium">{{ monthlyKm[emp.name] }} km</div>
                <div class="text-[10px] text-amber-500">${{ fuelAmount(monthlyKm[emp.name]) }}</div>
              </template>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="text-center px-2 py-2.5">
              <span class="text-gray-700 font-medium">{{ attendanceMap[emp.name] ?? 0 }}</span>
              <span class="text-gray-400 text-[10px]"> 天</span>
              <template v-if="monthlyLeave[emp.name]">
                <br>
                <span class="text-[10px] font-semibold text-red-500">
                  請假 {{ Math.ceil(monthlyLeave[emp.name] / 8) }} 日
                </span>
              </template>
            </td>
            <td class="text-center px-2 py-2.5 text-gray-500">{{ emp.lostCount }}</td>
            <td v-for="m in months" :key="m" class="text-center px-2 py-2.5">
              <template v-if="emp.monthly[m]?.count">
                <div class="font-medium" style="color:#c9a96e">{{ formatAmount(emp.monthly[m].amount) }}</div>
                <div class="text-gray-400">{{ emp.monthly[m].count }}件</div>
              </template>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="text-center px-2 py-2.5 bg-amber-50">
              <div class="font-bold text-gray-800">{{ formatAmount(emp.totalAmount) }}</div>
              <div class="text-gray-500">{{ emp.totalCount }}件</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useCalendarEventsStore } from '@/stores/calendarEvents'

const props = defineProps({ year: Number })
const casesStore = useCasesStore()
const logsStore = useWorkLogsStore()
const eventsStore = useCalendarEventsStore()
const selectedRegion = ref('')
const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const monthlyKm = ref({})
const monthlyOvertime = ref({})
const monthlyLeave = ref({})
const attendanceMap = ref({})
const refreshing = ref(false)

onMounted(async () => {
    await loadAll()
})

async function loadAll() {
    const [km, overtime, attendance, leave] = await Promise.all([
        logsStore.fetchMonthlyKm(),
        logsStore.fetchMonthlyOvertimeHours(),
        logsStore.fetchMonthlyAttendance(),
        eventsStore.fetchMonthlyLeave(),
    ])
    monthlyKm.value = km
    monthlyOvertime.value = overtime
    attendanceMap.value = attendance
    monthlyLeave.value = leave
}

async function refreshData() {
    refreshing.value = true
    await loadAll()
    refreshing.value = false
}

function fuelAmount(km) {
    return Math.ceil(km * 6 * 10) / 10
}

function formatAmount(n) {
    if (n >= 10000) return `$${(n / 10000).toFixed(0)}萬`
    if (n > 0) return `$${n}`
    return '—'
}

const employeeRows = computed(() => {
    const filtered = casesStore.cases.filter(c => {
        if (selectedRegion.value && c.companyId !== selectedRegion.value) return false
        if (props.year && c.signedDate) {
            const y = c.signedDate.toDate?.().getFullYear()
            if (y !== props.year) return false
        }
        return true
    })
    const map = {}
    filtered.forEach(c => {
        const names = c.assignees?.filter(Boolean) ?? (c.assigneeName ? [c.assigneeName] : [])
        if (names.length === 0) return
        names.forEach(name => {
            if (!map[name]) map[name] = { userId: name, name, lostCount: 0, monthly: {}, totalAmount: 0, totalCount: 0 }
            const emp = map[name]
            if (c.status === 'lost') { emp.lostCount++; return }
            if (!c.signedDate) return
            const month = c.signedDate.toDate?.().getMonth() + 1
            if (!month) return
            if (!emp.monthly[month]) emp.monthly[month] = { count: 0, amount: 0 }
            emp.monthly[month].count++
            emp.monthly[month].amount += c.signedAmount || 0
            emp.totalCount++
            emp.totalAmount += c.signedAmount || 0
        })
    })
    return Object.values(map)
})
</script>
