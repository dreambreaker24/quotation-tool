<template>
  <div class="bg-white rounded-2xl shadow-sm p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">員工績效</h2>
      <select v-model="selectedRegion" class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
        <option value="">全部分區</option>
        <option value="north">奈拾北區</option>
        <option value="central">奈拾中區</option>
        <option value="south">奈拾南區</option>
      </select>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="bg-gray-50">
            <th class="text-left px-3 py-2 text-gray-500 font-semibold sticky left-0 bg-gray-50 min-w-[90px]">員工</th>
            <th class="text-center px-2 py-2 text-gray-500 font-semibold min-w-[60px]">未成案</th>
            <th v-for="m in months" :key="m" class="text-center px-2 py-2 text-gray-500 font-semibold min-w-[70px]">
              {{ String(m).padStart(2,'0') }}
            </th>
            <th class="text-center px-2 py-2 text-gray-500 font-semibold bg-amber-50 min-w-[90px]">年度合計</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in employeeRows" :key="emp.userId" class="border-t border-gray-100 hover:bg-gray-50">
            <td class="px-3 py-2.5 font-semibold text-gray-700 sticky left-0 bg-white">{{ emp.name }}</td>
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
import { ref, computed } from 'vue'
import { useCasesStore } from '@/stores/cases'

const casesStore = useCasesStore()
const selectedRegion = ref('')
const months = [1,2,3,4,5,6,7,8,9,10,11,12]

function formatAmount(n) {
  if (n >= 10000) return `$${(n/10000).toFixed(0)}萬`
  if (n > 0) return `$${n}`
  return '—'
}

const employeeRows = computed(() => {
  const filtered = casesStore.cases.filter(c =>
    !selectedRegion.value || c.companyId === selectedRegion.value
  )
  const map = {}
  filtered.forEach(c => {
    if (!c.assignedTo) return
    if (!map[c.assignedTo]) {
      map[c.assignedTo] = { userId: c.assignedTo, name: c.assigneeName, lostCount: 0, monthly: {}, totalAmount: 0, totalCount: 0 }
    }
    const emp = map[c.assignedTo]
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
  return Object.values(map)
})
</script>
