<template>
    <div class="flex-1 p-4 sm:p-6">
        <template v-if="auth.isOwner">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div class="bg-white rounded-2xl shadow-md p-5">
                    <div class="text-xs text-gray-400 mb-1">本月營收</div>
                    <div class="text-2xl font-bold" style="color:#4a3535">{{ revenueTotal.toLocaleString() }}</div>
                </div>
                <div class="bg-white rounded-2xl shadow-md p-5">
                    <div class="text-xs text-gray-400 mb-1">本月支出（含攤提）</div>
                    <div class="text-2xl font-bold" style="color:#4a3535">{{ expenseTotal.toLocaleString() }}</div>
                </div>
                <div class="bg-white rounded-2xl shadow-md p-5">
                    <div class="text-xs text-gray-400 mb-1">本月毛估損益</div>
                    <div class="text-2xl font-bold" :style="profit >= 0 ? 'color:#7c9473' : 'color:#ef4444'">
                        {{ profit >= 0 ? '+' : '' }}{{ profit.toLocaleString() }}
                    </div>
                </div>
            </div>

            <div v-if="lowStockMaterials.length > 0" class="bg-white rounded-2xl shadow-md p-5 mb-4">
                <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-3" style="border-left-color:#ef4444">低庫存警示</h2>
                <div class="flex flex-col gap-1">
                    <div v-for="m in lowStockMaterials" :key="m.id"
                        class="flex items-center gap-3 px-3 py-2 rounded-lg border border-red-200 bg-red-50/60 text-xs">
                        <span class="flex-1 font-medium text-gray-800">{{ m.name }}</span>
                        <span class="text-red-500 font-medium">{{ m.currentStock ?? 0 }} {{ m.unit }}</span>
                        <span class="text-[10px] text-gray-400">安全庫存 {{ m.safetyStock }}</span>
                    </div>
                </div>
            </div>

            <ExpiringBatchesCard />
        </template>
        <div v-else class="text-sm text-gray-500">
            每日輸入功能還在開發中，尚未上線。
        </div>
    </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useExpenseItemsStore } from '@/stores/expenseItems'
import { useMonthlyExpensesStore } from '@/stores/monthlyExpenses'
import { useMaterialsStore } from '@/stores/materials'
import { useRevenueLogsStore } from '@/stores/revenueLogs'
import { useProductionBatchesStore } from '@/stores/productionBatches'
import { calcMonthlyAmortization } from '@/utils/amortization'
import { calcMonthlyProfit } from '@/utils/dashboardSummary'
import { isLowStock } from '@/utils/stockTransaction'
import { currentMonthInTaipei } from '@/utils/date'
import ExpiringBatchesCard from '@/components/inventory/ExpiringBatchesCard.vue'

const auth = useAuthStore()
const expenseItemsStore = useExpenseItemsStore()
const monthlyExpensesStore = useMonthlyExpensesStore()
const materialsStore = useMaterialsStore()
const revenueLogsStore = useRevenueLogsStore()
const productionBatchesStore = useProductionBatchesStore()

const currentMonth = currentMonthInTaipei()
const revenueTotal = ref(0)

const amortizationTotal = computed(() =>
    expenseItemsStore.expenseItems.reduce((sum, item) => sum + calcMonthlyAmortization(item.amount, item.amortizeMonths), 0)
)
const monthlyExpenseTotal = computed(() =>
    monthlyExpensesStore.monthlyExpenses
        .filter(e => e.date === currentMonth)
        .reduce((sum, e) => sum + (e.amount || 0), 0)
)
const expenseTotal = computed(() => monthlyExpenseTotal.value + amortizationTotal.value)
const profit = computed(() => calcMonthlyProfit(revenueTotal.value, monthlyExpenseTotal.value, amortizationTotal.value))
const lowStockMaterials = computed(() => materialsStore.materials.filter(isLowStock))

onMounted(async () => {
    if (!auth.isOwner) return
    expenseItemsStore.subscribe()
    monthlyExpensesStore.subscribe()
    materialsStore.subscribe()
    productionBatchesStore.subscribe()
    try {
        revenueTotal.value = await revenueLogsStore.getMonthlyTotal(currentMonth)
    } catch (e) {
        console.warn('取得本月營收失敗:', e)
    }
})
onUnmounted(() => {
    if (!auth.isOwner) return
    expenseItemsStore.cleanup()
    monthlyExpensesStore.cleanup()
    materialsStore.cleanup()
    productionBatchesStore.cleanup()
})
</script>
