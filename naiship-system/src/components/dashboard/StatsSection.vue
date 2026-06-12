<template>
  <div class="grid grid-cols-3 gap-4">
    <div class="col-span-2 bg-white rounded-2xl shadow-md p-5">
      <h2 class="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide pl-3 border-l-2" style="border-left-color:#c9a96e">案件統計</h2>
      <div class="grid grid-cols-3 gap-3">
        <StatCard label="進件總數" :value="String(stats.totalCount)" />
        <StatCard label="洽談案件" :value="String(stats.negotiatingCount)" />
        <StatCard label="簽約案件" :value="String(stats.signedCount)" />
        <StatCard label="進件金額" :value="formatAmount(stats.totalAmount)" />
        <StatCard label="洽談金額" :value="formatAmount(stats.negotiatingAmount)" />
        <StatCard label="簽約金額" :value="formatAmount(stats.signedAmount)" />
      </div>
    </div>
    <PieChart :data="pieData" />
  </div>
</template>
<script setup>
import { computed } from 'vue'
import StatCard from '@/components/ui/StatCard.vue'
import PieChart from './PieChart.vue'
import { useCasesStore } from '@/stores/cases'

const props = defineProps({ year: Number })
const casesStore = useCasesStore()

function formatAmount(n) {
    if (n >= 10000) return `$${(n / 10000).toFixed(0)}萬`
    return `$${n}`
}

const stats = computed(() => {
    const all = casesStore.cases.filter(c => {
        if (!props.year) return true
        const d = c.createdAt?.toDate?.()
        return !d || d.getFullYear() === props.year
    })
    return {
        totalCount: all.length,
        negotiatingCount: all.filter(c => c.status === 'negotiating').length,
        signedCount: all.filter(c => ['construction', 'pending_settlement', 'aftercare', 'completed'].includes(c.status)).length,
        totalAmount: all.reduce((s, c) => s + (c.estimatedAmount || 0), 0),
        negotiatingAmount: all.filter(c => c.status === 'negotiating').reduce((s, c) => s + (c.estimatedAmount || 0), 0),
        signedAmount: all.filter(c => c.signedAmount).reduce((s, c) => s + (c.signedAmount || 0), 0)
    }
})

const pieData = computed(() => [
    { name: '進行中', value: casesStore.statusCount('construction', null), color: '#c9a96e' },
    { name: '洽談中', value: casesStore.statusCount('negotiating', null), color: '#5b9bd5' },
    { name: '已完工', value: casesStore.statusCount('completed', null), color: '#70ad47' }
])
</script>
