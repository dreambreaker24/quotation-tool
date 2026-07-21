<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-4" style="border-left-color:#d98fa0">進貨登記</h2>

        <div class="flex flex-col gap-3 mb-4">
            <div>
                <label class="text-xs text-gray-500 mb-1 block">日期</label>
                <input v-model="form.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1">
            </div>
            <div>
                <label class="text-xs text-gray-500 mb-1 block">原料/包材 *</label>
                <select v-model="form.materialId" @change="onMaterialSelect" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-1">
                    <option value="">選擇品項</option>
                    <option v-for="m in materialsStore.materials" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">進貨數量 * {{ selectedUnit ? `(${selectedUnit})` : '' }}</label>
                    <input v-model.number="form.qty" type="number" min="0" step="0.01" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">單價（元）</label>
                    <input v-model.number="form.unitCost" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1">
                </div>
            </div>
            <div>
                <label class="text-xs text-gray-500 mb-1 block">廠商</label>
                <select v-model="form.vendorId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-1">
                    <option value="">未指定</option>
                    <option v-for="v in vendorsStore.vendors" :key="v.id" :value="v.id">{{ v.name }}</option>
                </select>
            </div>
        </div>

        <button @click="submitForm" :disabled="submitting"
            class="w-full text-white rounded-xl py-3 text-sm font-medium disabled:opacity-60" style="background:#4a3535">
            {{ submitting ? '登記中…' : '送出進貨登記' }}
        </button>

        <div v-if="todayEntries.length > 0" class="mt-5 pt-4 border-t border-gray-100">
            <div class="text-xs text-gray-400 mb-2">本次登入已登記</div>
            <div class="flex flex-col gap-1.5">
                <div v-for="(e, idx) in todayEntries" :key="idx" class="text-xs text-gray-600 flex justify-between">
                    <span>{{ e.materialName }}</span>
                    <span>+{{ e.qty }} {{ e.unit }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useMaterialsStore } from '@/stores/materials'
import { useVendorsStore } from '@/stores/vendors'
import { usePurchaseLogsStore } from '@/stores/purchaseLogs'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { todayInTaipei } from '@/utils/date'

const materialsStore = useMaterialsStore()
const vendorsStore = useVendorsStore()
const purchaseLogsStore = usePurchaseLogsStore()
const auth = useAuthStore()
const { toast } = useToast()

const todayStr = todayInTaipei()
const blankForm = () => ({ date: todayStr, materialId: '', qty: null, unitCost: null, vendorId: '' })
const form = ref(blankForm())
const submitting = ref(false)
const todayEntries = ref([])

const selectedMaterial = computed(() => materialsStore.materials.find(m => m.id === form.value.materialId))
const selectedUnit = computed(() => selectedMaterial.value?.unit || '')

function onMaterialSelect() {
    if (selectedMaterial.value?.vendorId) form.value.vendorId = selectedMaterial.value.vendorId
}

async function submitForm() {
    if (submitting.value) return
    if (!form.value.materialId || !form.value.qty) {
        toast('請選擇品項並填寫進貨數量', 'error')
        return
    }
    submitting.value = true
    try {
        if (!selectedMaterial.value) {
            toast('該品項已被移除，請重新選擇', 'error')
            return
        }
        const materialName = selectedMaterial.value.name
        const qty = form.value.qty
        const unit = selectedUnit.value
        await purchaseLogsStore.addPurchaseLog({
            date: form.value.date,
            materialId: form.value.materialId,
            qty,
            unitCost: Number(form.value.unitCost) || 0,
            vendorId: form.value.vendorId,
            recordedBy: auth.name,
            recordedByUid: auth.user.uid
        })
        todayEntries.value.unshift({ materialName, qty, unit })
        toast('進貨登記成功')
        form.value = blankForm()
    } catch (e) {
        console.warn('進貨登記失敗:', e)
        toast(e.message === '進貨數量必須是正數' ? e.message : '登記失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}
</script>
