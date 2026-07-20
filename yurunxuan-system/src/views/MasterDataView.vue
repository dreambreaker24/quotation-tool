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
    </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ExpenseItemManager from '@/components/masterData/ExpenseItemManager.vue'
import MaterialManager from '@/components/masterData/MaterialManager.vue'
import { useExpenseItemsStore } from '@/stores/expenseItems'
import { useMaterialsStore } from '@/stores/materials'

const tabs = [
    { key: 'expense', label: '開店支出攤提' },
    { key: 'material', label: '原料/包材' }
]
const activeTab = ref('expense')

const expenseItemsStore = useExpenseItemsStore()
const materialsStore = useMaterialsStore()
onMounted(() => {
    expenseItemsStore.subscribe()
    materialsStore.subscribe()
})
onUnmounted(() => {
    expenseItemsStore.cleanup()
    materialsStore.cleanup()
})
</script>
