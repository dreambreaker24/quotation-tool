<template>
    <div class="flex-1 p-4 sm:p-6">
        <div class="flex gap-2 mb-4 overflow-x-auto">
            <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key"
                class="px-3 py-1.5 rounded-lg text-xs sm:text-sm whitespace-nowrap"
                :class="activeTab === tab.key ? 'text-white' : 'text-gray-500 bg-white'"
                :style="activeTab === tab.key ? 'background:#4a3535' : ''">
                {{ tab.label }}
            </button>
        </div>
        <ExpenseItemManager v-if="activeTab === 'expense'" />
        <MaterialManager v-if="activeTab === 'material'" />
        <VendorManager v-if="activeTab === 'vendor'" />
        <RecipeManager v-if="activeTab === 'recipe'" />
    </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ExpenseItemManager from '@/components/masterData/ExpenseItemManager.vue'
import MaterialManager from '@/components/masterData/MaterialManager.vue'
import VendorManager from '@/components/masterData/VendorManager.vue'
import RecipeManager from '@/components/masterData/RecipeManager.vue'
import { useExpenseItemsStore } from '@/stores/expenseItems'
import { useMaterialsStore } from '@/stores/materials'
import { useVendorsStore } from '@/stores/vendors'
import { useRecipesStore } from '@/stores/recipes'

const tabs = [
    { key: 'expense', label: '開店支出攤提' },
    { key: 'material', label: '原料/包材' },
    { key: 'vendor', label: '廠商資料' },
    { key: 'recipe', label: '配方表' }
]
const activeTab = ref('expense')

const expenseItemsStore = useExpenseItemsStore()
const materialsStore = useMaterialsStore()
const vendorsStore = useVendorsStore()
const recipesStore = useRecipesStore()
onMounted(() => {
    expenseItemsStore.subscribe()
    materialsStore.subscribe()
    vendorsStore.subscribe()
    recipesStore.subscribe()
})
onUnmounted(() => {
    expenseItemsStore.cleanup()
    materialsStore.cleanup()
    vendorsStore.cleanup()
    recipesStore.cleanup()
})
</script>
