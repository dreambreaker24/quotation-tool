<template>
  <div class="bg-white rounded-2xl shadow-sm p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">月度現金流</h2>
      <div class="flex items-center gap-2">
        <select v-model="localMonth" class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl p-4" style="background:#faf7f2">
        <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">本月應收</div>
        <div class="text-lg font-bold" style="color:#c9a96e">{{ formatAmount(stats.receivable) }}</div>
      </div>
      <div class="rounded-xl p-4" style="background:#f0faf4">
        <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">本月已收</div>
        <div class="text-lg font-bold text-green-600">{{ formatAmount(stats.received) }}</div>
      </div>
      <div class="rounded-xl p-4" style="background:#fdf2f2">
        <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">本月應付</div>
        <div class="text-lg font-bold text-red-500">{{ formatAmount(stats.payable) }}</div>
      </div>
      <div class="rounded-xl p-4 bg-gray-50">
        <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">本月已付</div>
        <div class="text-lg font-bold text-gray-600">{{ formatAmount(stats.paid) }}</div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/stores/cases'

const props = defineProps({
    year: Number,
    month: Number,
})

const now = new Date()
const localMonth = ref(props.month ?? now.getMonth() + 1)

const monthOptions = computed(() => {
    const opts = []
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        opts.push({ value: d.getMonth() + 1, label: `${d.getFullYear()}年 ${d.getMonth() + 1}月` })
    }
    return opts
})

const casesStore = useCasesStore()

const stats = computed(() => {
    const y = props.year ?? now.getFullYear()
    const m = localMonth.value

    let receivable = 0
    let received = 0
    let payable = 0
    let paid = 0

    casesStore.cases.forEach(c => {
        // 應收：paymentMilestones dueDate in this month
        if (Array.isArray(c.paymentMilestones)) {
            c.paymentMilestones.forEach(p => {
                const due = p.dueDate?.toDate?.()
                if (due && due.getFullYear() === y && due.getMonth() + 1 === m) {
                    receivable += p.amount || 0
                }
                const paid_ = p.paidDate?.toDate?.()
                if (paid_ && paid_.getFullYear() === y && paid_.getMonth() + 1 === m) {
                    received += p.paidAmount || p.amount || 0
                }
            })
        }
        // 應付：workType.vendorCost for construction cases
        if (c.status === 'construction') {
            const startD = c.startDate?.toDate?.()
            const endD = c.endDate?.toDate?.()
            const inMonth = (startD && startD.getFullYear() === y && startD.getMonth() + 1 === m)
                || (endD && endD.getFullYear() === y && endD.getMonth() + 1 === m)
                || (startD && endD && startD <= new Date(y, m - 1, 1) && endD >= new Date(y, m - 1, 28))
            if (inMonth) {
                payable += c.workType?.vendorCost || 0
            }
        }
        // 已付：vendorPayments paidDate in this month
        if (Array.isArray(c.vendorPayments)) {
            c.vendorPayments.forEach(vp => {
                const vpDate = vp.paidDate?.toDate?.()
                if (vpDate && vpDate.getFullYear() === y && vpDate.getMonth() + 1 === m) {
                    paid += vp.amount || 0
                }
            })
        }
    })

    return { receivable, received, payable, paid }
})

function formatAmount(n) {
    if (!n) return '—'
    if (n >= 10000) return `$${(n / 10000).toFixed(1)}萬`
    return `$${n.toLocaleString()}`
}
</script>
