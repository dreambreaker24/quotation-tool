<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-4" style="border-left-color:#d98fa0">生產登記</h2>

        <div class="flex flex-col gap-3 mb-4">
            <div>
                <label class="text-xs text-gray-500 mb-1 block">日期</label>
                <input v-model="form.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1">
            </div>
            <div>
                <label class="text-xs text-gray-500 mb-1 block">飲品 *</label>
                <select v-model="form.drinkId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-1">
                    <option value="">選擇飲品</option>
                    <option v-for="r in recipesStore.recipes" :key="r.id" :value="r.id">{{ r.name }}</option>
                </select>
            </div>
            <div>
                <label class="text-xs text-gray-500 mb-1 block">生產杯數 *</label>
                <input v-model.number="form.qty" type="number" min="0" step="1" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1" placeholder="例：20">
            </div>
            <div v-if="selectedRecipe && form.qty" class="text-xs rounded-lg px-3 py-2" style="background:#f6e2e5;color:#4a3535">
                將扣除：{{ deductionPreview }}
            </div>
        </div>

        <button @click="submitForm" :disabled="submitting"
            class="w-full text-white rounded-xl py-3 text-sm font-medium disabled:opacity-60" style="background:#4a3535">
            {{ submitting ? '登記中…' : '送出生產登記' }}
        </button>

        <div v-if="todayEntries.length > 0" class="mt-5 pt-4 border-t border-gray-100">
            <div class="text-xs text-gray-400 mb-2">本次登入已登記</div>
            <div class="flex flex-col gap-1.5">
                <div v-for="(e, idx) in todayEntries" :key="idx" class="text-xs text-gray-600 flex justify-between">
                    <span>{{ e.drinkName }}</span>
                    <span>{{ e.qty }} 杯</span>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRecipesStore } from '@/stores/recipes'
import { useProductionLogsStore } from '@/stores/productionLogs'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { calcProductionDeductions } from '@/utils/stockTransaction'
import { todayInTaipei } from '@/utils/date'

const recipesStore = useRecipesStore()
const productionLogsStore = useProductionLogsStore()
const auth = useAuthStore()
const { toast } = useToast()

const todayStr = todayInTaipei()
const blankForm = () => ({ date: todayStr, drinkId: '', qty: null })
const form = ref(blankForm())
const submitting = ref(false)
const todayEntries = ref([])

const selectedRecipe = computed(() => recipesStore.recipes.find(r => r.id === form.value.drinkId))

const deductionPreview = computed(() => {
    if (!selectedRecipe.value || !form.value.qty) return ''
    const deductions = calcProductionDeductions(selectedRecipe.value.ingredients, form.value.qty)
    return deductions.map(d => {
        const ing = selectedRecipe.value.ingredients.find(i => i.materialId === d.materialId)
        return `${ing?.materialName || ''} ${Math.abs(d.delta)}${ing?.unit || ''}`
    }).join('、')
})

async function submitForm() {
    if (submitting.value) return
    if (!form.value.drinkId || !form.value.qty) {
        toast('請選擇飲品並填寫生產杯數', 'error')
        return
    }
    submitting.value = true
    const drinkName = selectedRecipe.value.name
    const qty = form.value.qty
    try {
        await productionLogsStore.addProductionLog({
            date: form.value.date,
            drinkId: selectedRecipe.value.id,
            drinkName,
            qty,
            recordedBy: auth.name,
            recordedByUid: auth.user.uid,
            ingredients: selectedRecipe.value.ingredients
        })
        todayEntries.value.unshift({ drinkName, qty })
        toast('生產登記成功')
        form.value = blankForm()
    } catch (e) {
        console.warn('生產登記失敗:', e)
        toast('登記失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}
</script>
