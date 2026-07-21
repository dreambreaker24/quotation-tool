<template>
    <div class="flex-1 p-4 sm:p-6">
        <div class="bg-white rounded-2xl shadow-md p-5 mb-4">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">庫存總覽</h2>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ materialsStore.materials.length }} 項</span>
            </div>
            <div class="flex flex-col gap-1">
                <div v-for="m in materialsStore.materials" :key="m.id"
                    class="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs"
                    :class="isLowStock(m) ? 'border-red-200 bg-red-50/60' : 'border-gray-100 bg-gray-50/50'">
                    <span class="flex-1 font-medium text-gray-800">{{ m.name }}<span class="ml-1.5 text-[10px] text-gray-400">{{ m.category }}</span></span>
                    <span class="font-medium" :class="isLowStock(m) ? 'text-red-500' : 'text-gray-600'">
                        {{ m.currentStock ?? 0 }} {{ m.unit }}
                    </span>
                    <span v-if="isLowStock(m)" class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">低於安全庫存</span>
                </div>
            </div>
        </div>

        <WasteForm />
    </div>
</template>
<script setup>
import { onMounted, onUnmounted } from 'vue'
import WasteForm from '@/components/inventory/WasteForm.vue'
import { useMaterialsStore } from '@/stores/materials'
import { useRecipesStore } from '@/stores/recipes'
import { isLowStock } from '@/utils/stockTransaction'

const materialsStore = useMaterialsStore()
const recipesStore = useRecipesStore()

onMounted(() => {
    materialsStore.subscribe()
    recipesStore.subscribe()
})
onUnmounted(() => {
    materialsStore.cleanup()
    recipesStore.cleanup()
})
</script>
