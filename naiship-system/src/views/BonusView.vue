<template>
  <main class="flex-1 overflow-y-auto px-4 py-6 max-w-5xl mx-auto w-full">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-bold text-gray-800">季度獎金統計</h1>
      <select v-model="selectedQuarter" class="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
        <option v-for="q in quarterOptions" :key="q" :value="q">{{ q }}</option>
      </select>
    </div>

    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <h2 class="text-sm font-bold text-gray-700 mb-3">本季完工案件（業務／設計師／工務）</h2>
      <div v-if="eligibleCases.length === 0" class="text-sm text-gray-400 py-4 text-center">這一季沒有完工案件</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-400 text-xs border-b border-gray-100">
            <th class="py-2 font-medium">案件</th>
            <th class="font-medium">簽約金額</th>
            <th class="font-medium">資格</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in eligibleCases" :key="c.id" class="border-b border-gray-50">
            <td class="py-2">{{ c.name }}</td>
            <td>{{ (c.signedAmount || 0).toLocaleString() }}</td>
            <td>
              <span v-if="isEligibleByAmount(c.signedAmount)" class="text-green-600">符合</span>
              <span v-else class="text-gray-400">未達 50 萬</span>
            </td>
            <td class="text-right">
              <button @click="editingCaseId = c.id" class="text-xs text-blue-600 hover:underline">編輯獎金資料</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <CaseBonusForm v-if="editingCaseId" :case-id="editingCaseId"
      :case-info="eligibleCases.find(c => c.id === editingCaseId)"
      @close="editingCaseId = null" />
  </main>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { isEligibleByAmount, dateToQuarterKey, isCompletedInQuarter } from '@/utils/bonusCalc'
import CaseBonusForm from '@/components/bonus/CaseBonusForm.vue'

const casesStore = useCasesStore()

onMounted(() => {
    casesStore.subscribe(['north', 'central', 'south'])
})

const quarterOptions = computed(() => {
    const current = dateToQuarterKey(new Date())
    const [y, qStr] = current.split('-Q')
    const year = Number(y)
    const q = Number(qStr)
    const options = []
    for (let i = 0; i < 8; i++) {
        const totalQ = year * 4 + (q - 1) - i
        const oy = Math.floor(totalQ / 4)
        const oq = (totalQ % 4) + 1
        options.push(`${oy}-Q${oq}`)
    }
    return options
})

const selectedQuarter = ref(dateToQuarterKey(new Date()))

const eligibleCases = computed(() =>
    casesStore.cases.filter(c => isCompletedInQuarter(c.completedAt, selectedQuarter.value))
)

const editingCaseId = ref(null)
</script>
