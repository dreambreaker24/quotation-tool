<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-3" style="border-left-color:#d98fa0">毛利分析</h2>

        <div v-if="loading" class="text-sm text-gray-400 text-center py-8">載入中…</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div v-for="r in recipesStore.recipes" :key="r.id" class="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
                <div class="font-medium text-gray-800 text-sm mb-2">{{ r.name }}</div>

                <div v-if="costs[r.id]?.hasUnknownCost" class="text-xs text-gray-400">尚無進貨資料，成本未知</div>
                <template v-else>
                    <div class="text-xs text-gray-500 mb-2">單瓶成本：{{ costs[r.id]?.cost?.toFixed(1) }} 元</div>
                    <div class="flex flex-col gap-1 text-xs">
                        <div v-for="tier in tiers" :key="tier.key" class="flex justify-between">
                            <span class="text-gray-500">{{ tier.label }}</span>
                            <span class="font-medium" :class="marginColor(margins[r.id]?.[tier.key])">
                                {{ formatMargin(margins[r.id]?.[tier.key]) }}
                            </span>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRecipesStore } from '@/stores/recipes'
import { usePurchaseLogsStore } from '@/stores/purchaseLogs'
import { calcDrinkCost, calcTierMargins } from '@/utils/marginAnalysis'

const recipesStore = useRecipesStore()
const purchaseLogsStore = usePurchaseLogsStore()

const tiers = [
    { key: 'single', label: '單瓶' },
    { key: 'pack3', label: '3入組' },
    { key: 'pack6', label: '6入組' }
]

const loading = ref(true)
const unitCostMap = ref({})

onMounted(async () => {
    try {
        unitCostMap.value = await purchaseLogsStore.getLatestUnitCosts()
    } catch (e) {
        console.warn('取得進貨單價失敗:', e)
    } finally {
        loading.value = false
    }
})

const costs = computed(() => {
    const result = {}
    for (const r of recipesStore.recipes) {
        result[r.id] = calcDrinkCost(r.ingredients, unitCostMap.value)
    }
    return result
})

const margins = computed(() => {
    const result = {}
    for (const r of recipesStore.recipes) {
        const cost = costs.value[r.id]
        result[r.id] = calcTierMargins(r.pricing, cost.hasUnknownCost ? null : cost.cost)
    }
    return result
})

function formatMargin(rate) {
    if (rate === null || rate === undefined) return '—'
    return `${(rate * 100).toFixed(0)}%`
}
function marginColor(rate) {
    if (rate === null || rate === undefined) return 'text-gray-400'
    return rate >= 0 ? 'text-green-600' : 'text-red-500'
}
</script>
