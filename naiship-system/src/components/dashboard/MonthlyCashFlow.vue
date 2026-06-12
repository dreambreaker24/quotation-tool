<template>
  <div class="bg-white rounded-2xl shadow-md p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide pl-3 border-l-2" style="border-left-color:#c9a96e">月度現金流</h2>
      <select v-model="localMonth" class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
        <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl p-4 cursor-pointer transition-colors border-l-4 overflow-hidden"
        :style="expandedStat === 'receivable' ? 'background:#f0e8d5;border-left-color:#c9a96e' : 'background:#faf7f2;border-left-color:#c9a96e'"
        @click="toggle('receivable')">
        <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">本月應收</div>
        <div class="text-lg font-bold" style="color:#c9a96e">{{ formatAmount(stats.receivable) }}</div>
      </div>
      <div class="rounded-xl p-4 cursor-pointer transition-colors border-l-4 overflow-hidden"
        :style="expandedStat === 'received' ? 'background:#d6f5e3;border-left-color:#22c55e' : 'background:#f0faf4;border-left-color:#22c55e'"
        @click="toggle('received')">
        <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">本月已收</div>
        <div class="text-lg font-bold text-green-600">{{ formatAmount(stats.received) }}</div>
      </div>
      <div class="rounded-xl p-4 cursor-pointer transition-colors border-l-4 overflow-hidden"
        :style="expandedStat === 'payable' ? 'background:#fcd9d9;border-left-color:#ef4444' : 'background:#fdf2f2;border-left-color:#ef4444'"
        @click="toggle('payable')">
        <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">本月應付</div>
        <div class="text-lg font-bold text-red-500">{{ formatAmount(stats.payable) }}</div>
      </div>
      <div class="rounded-xl p-4 cursor-pointer transition-colors border-l-4 overflow-hidden"
        :style="expandedStat === 'paid' ? 'background:#e5e7eb;border-left-color:#9ca3af' : 'background:#f9fafb;border-left-color:#9ca3af'"
        @click="toggle('paid')">
        <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">本月已付</div>
        <div class="text-lg font-bold text-gray-600">{{ formatAmount(stats.paid) }}</div>
      </div>
    </div>

    <!-- 展開明細 -->
    <div v-if="expandedStat" class="mt-3 border-t border-gray-100 pt-3">
      <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{{ detailTitle }}</div>
      <div v-if="currentDetails.length === 0" class="text-xs text-gray-400 py-1">無資料</div>
      <div v-for="(item, i) in currentDetails" :key="i"
        class="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
        <div>
          <span class="font-medium text-gray-700">{{ item.caseName }}</span>
          <span class="text-gray-400 ml-2">{{ item.label }}</span>
        </div>
        <span class="font-semibold text-gray-800">${{ (item.amount || 0).toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/stores/cases'

const props = defineProps({ year: Number, month: Number })

const now = new Date()
const localMonth = ref(props.month ?? now.getMonth() + 1)
const expandedStat = ref(null)

const monthOptions = computed(() => {
    const opts = []
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        opts.push({ value: d.getMonth() + 1, label: `${d.getFullYear()}年 ${d.getMonth() + 1}月` })
    }
    return opts
})

const casesStore = useCasesStore()

function toggle(stat) {
    expandedStat.value = expandedStat.value === stat ? null : stat
}

const detailTitles = {
    receivable: '應收明細（到期日在本月的期款）',
    received: '已收明細（收款日期在本月的期款）',
    payable: '應付明細（施工中案件廠商工程款）',
    paid: '已付明細（本月廠商付款記錄）',
}
const detailTitle = computed(() => detailTitles[expandedStat.value] ?? '')

const computed_data = computed(() => {
    const y = props.year ?? now.getFullYear()
    const m = localMonth.value

    let receivable = 0, received = 0, payable = 0, paid = 0
    const receivableItems = [], receivedItems = [], payableItems = [], paidItems = []

    casesStore.cases.forEach(c => {
        if (Array.isArray(c.paymentMilestones)) {
            c.paymentMilestones.forEach(p => {
                if (p.dueDate) {
                    const [py, pm] = p.dueDate.split('-').map(Number)
                    if (py === y && pm === m) {
                        receivable += p.amount || 0
                        receivableItems.push({ caseName: c.name, label: p.label, amount: p.amount || 0 })
                    }
                }
                if (p.paidDate) {
                    const [py, pm] = p.paidDate.split('-').map(Number)
                    if (py === y && pm === m) {
                        const amt = p.paidAmount || p.amount || 0
                        received += amt
                        receivedItems.push({ caseName: c.name, label: p.label, amount: amt })
                    }
                }
            })
        }

        if (Array.isArray(c.workTypes)) {
            if (c.status === 'construction') {
                const startD = c.startDate?.toDate?.()
                const endD = c.endDate?.toDate?.()
                const inMonth = (startD && startD.getFullYear() === y && startD.getMonth() + 1 === m)
                    || (endD && endD.getFullYear() === y && endD.getMonth() + 1 === m)
                    || (startD && endD && startD <= new Date(y, m - 1, 1) && endD >= new Date(y, m - 1, 28))
                if (inMonth) {
                    c.workTypes.forEach(wt => {
                        if (wt.vendorCost > 0) {
                            payable += wt.vendorCost
                            payableItems.push({ caseName: c.name, label: wt.vendorName || wt.name, amount: wt.vendorCost })
                        }
                    })
                }
            }

            c.workTypes.forEach(wt => {
                if (Array.isArray(wt.vendorPayments)) {
                    wt.vendorPayments.forEach(vp => {
                        if (!vp.paidDate) return
                        const [py, pm] = vp.paidDate.split('-').map(Number)
                        if (py === y && pm === m) {
                            paid += vp.amount || 0
                            paidItems.push({ caseName: c.name, label: wt.vendorName || wt.name, amount: vp.amount || 0 })
                        }
                    })
                }
            })
        }
    })

    return { stats: { receivable, received, payable, paid }, details: { receivableItems, receivedItems, payableItems, paidItems } }
})

const stats = computed(() => computed_data.value.stats)
const currentDetails = computed(() => {
    const map = {
        receivable: computed_data.value.details.receivableItems,
        received: computed_data.value.details.receivedItems,
        payable: computed_data.value.details.payableItems,
        paid: computed_data.value.details.paidItems,
    }
    return map[expandedStat.value] ?? []
})

function formatAmount(n) {
    if (!n) return '—'
    if (n >= 10000) return `$${(n / 10000).toFixed(1)}萬`
    return `$${n.toLocaleString()}`
}
</script>
