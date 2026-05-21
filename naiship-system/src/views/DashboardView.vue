<template>
  <aside class="w-56 text-white flex-shrink-0 min-h-screen pt-4 pb-6 overflow-y-auto" style="background:#1e2533">
    <div class="px-4 py-2 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">進行中案件</div>
    <div v-for="(regionCases, region) in activeCasesByRegion" :key="region" class="px-3 mt-2">
      <div class="text-[11px] font-semibold px-2 py-1" style="color:#c9a96e">{{ regionName[region] }}</div>
      <div v-for="c in regionCases" :key="c.id"
        class="rounded-lg px-3 py-2 cursor-pointer hover:bg-white/5">
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
    <StatsSection />
    <EmployeeTable class="mt-6" />
  </main>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import StatsSection from '@/components/dashboard/StatsSection.vue'
import EmployeeTable from '@/components/dashboard/EmployeeTable.vue'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'

const casesStore = useCasesStore()
const authStore = useAuthStore()
const selectedYear = ref(new Date().getFullYear())
const years = [selectedYear.value, selectedYear.value - 1, selectedYear.value - 2]

const regionName = { north: '奈拾北區', central: '奈拾中區', south: '奈拾南區' }

const activeCasesByRegion = computed(() => {
    const result = {}
    casesStore.activeCases.forEach(c => {
        if (!result[c.companyId]) result[c.companyId] = []
        result[c.companyId].push(c)
    })
    return result
})

onMounted(() => {
    const regions = authStore.isAdmin
        ? ['south', 'north', 'central']
        : [authStore.companyId]
    casesStore.subscribe(regions.filter(Boolean))
})
</script>
