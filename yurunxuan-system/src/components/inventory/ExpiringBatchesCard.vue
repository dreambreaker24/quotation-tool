<template>
    <div v-if="expiring.length > 0" class="bg-white rounded-2xl shadow-md p-5">
        <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-3" style="border-left-color:#ef4444">即將到期成品</h2>
        <div class="flex flex-col gap-1">
            <div v-for="b in expiring" :key="b.id"
                class="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs"
                :class="b.daysUntilExpiry < 0 ? 'border-red-200 bg-red-50/60' : 'border-yellow-200 bg-yellow-50/60'">
                <span class="flex-1 font-medium text-gray-800">{{ b.drinkName }}</span>
                <span class="font-medium" :class="b.daysUntilExpiry < 0 ? 'text-red-500' : 'text-yellow-600'">
                    {{ expiryLabel(b.daysUntilExpiry) }}
                </span>
                <span class="text-gray-500">剩 {{ b.remainingQty }} 瓶</span>
            </div>
        </div>
    </div>
</template>
<script setup>
import { computed } from 'vue'
import { useProductionBatchesStore } from '@/stores/productionBatches'
import { filterExpiringBatches } from '@/utils/expiringBatches'
import { todayInTaipei } from '@/utils/date'

const productionBatchesStore = useProductionBatchesStore()

const expiring = computed(() => filterExpiringBatches(productionBatchesStore.batches, todayInTaipei()))

function expiryLabel(days) {
    if (days < 0) return `已過期 ${-days} 天，請盡快報廢`
    if (days === 0) return '今天到期'
    if (days === 1) return '明天到期'
    return `${days} 天後到期`
}
</script>
