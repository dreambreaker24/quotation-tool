<template>
    <div class="flex-1 p-4 sm:p-6 max-w-lg mx-auto w-full">
        <div class="flex gap-2 mb-4">
            <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key"
                class="flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                :class="activeTab === tab.key ? 'text-white' : 'text-gray-500 bg-white'"
                :style="activeTab === tab.key ? 'background:#4a3535' : ''">
                {{ tab.label }}
            </button>
        </div>
        <ProductionForm v-if="activeTab === 'production'" />
        <PurchaseForm v-if="activeTab === 'purchase'" />
    </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ProductionForm from '@/components/dailyEntry/ProductionForm.vue'
import PurchaseForm from '@/components/dailyEntry/PurchaseForm.vue'
import { useMaterialsStore } from '@/stores/materials'
import { useVendorsStore } from '@/stores/vendors'
import { useRecipesStore } from '@/stores/recipes'

const tabs = [
    { key: 'production', label: '生產登記' },
    { key: 'purchase', label: '進貨登記' }
]
const activeTab = ref('production')

const materialsStore = useMaterialsStore()
const vendorsStore = useVendorsStore()
const recipesStore = useRecipesStore()
onMounted(() => {
    materialsStore.subscribe()
    vendorsStore.subscribe()
    recipesStore.subscribe()
})
onUnmounted(() => {
    materialsStore.cleanup()
    vendorsStore.cleanup()
    recipesStore.cleanup()
})
</script>
