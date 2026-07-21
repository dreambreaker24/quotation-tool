<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">報廢登記</h2>
            <button @click="showForm = true" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#4a3535">+ 新增報廢</button>
        </div>
        <div v-if="todayEntries.length > 0" class="flex flex-col gap-1.5">
            <div v-for="(e, idx) in todayEntries" :key="idx" class="text-xs text-gray-600 flex justify-between px-1">
                <span>{{ e.name }}</span>
                <span>-{{ e.qty }} {{ e.unit }}</span>
            </div>
        </div>
        <div v-else class="text-xs text-gray-400">本次登入尚無報廢紀錄</div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
        <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#d98fa0">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-bold text-gray-800">新增報廢紀錄</h3>
                <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">報廢類型 *</label>
                    <div class="flex gap-2">
                        <button type="button" @click="form.type = 'material'"
                            class="flex-1 text-sm py-2 rounded-lg border"
                            :class="form.type === 'material' ? 'text-white border-transparent' : 'text-gray-500 border-gray-200'"
                            :style="form.type === 'material' ? 'background:#4a3535' : ''">原料/包材</button>
                        <button type="button" @click="form.type = 'drink'"
                            class="flex-1 text-sm py-2 rounded-lg border"
                            :class="form.type === 'drink' ? 'text-white border-transparent' : 'text-gray-500 border-gray-200'"
                            :style="form.type === 'drink' ? 'background:#4a3535' : ''">成品飲品</button>
                    </div>
                </div>
                <div v-if="form.type === 'material'">
                    <label class="text-xs text-gray-500 mb-1 block">品項 *</label>
                    <select v-model="form.materialId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                        <option value="">選擇品項</option>
                        <option v-for="m in materialsStore.materials" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </div>
                <div v-else>
                    <label class="text-xs text-gray-500 mb-1 block">飲品 *</label>
                    <select v-model="form.drinkId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                        <option value="">選擇飲品</option>
                        <option v-for="r in recipesStore.recipes" :key="r.id" :value="r.id">{{ r.name }}</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">數量 * {{ form.type === 'material' ? unitLabel : '(杯)' }}</label>
                    <input v-model.number="form.qty" type="number" min="0" step="0.01" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">原因</label>
                    <input v-model="form.reason" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：過期、打翻、客訴退貨">
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-5">
                <button @click="showForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
                <button @click="submitForm" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#4a3535">
                    {{ submitting ? '送出中…' : '送出' }}
                </button>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useMaterialsStore } from '@/stores/materials'
import { useRecipesStore } from '@/stores/recipes'
import { useWasteLogsStore } from '@/stores/wasteLogs'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { todayInTaipei } from '@/utils/date'

const materialsStore = useMaterialsStore()
const recipesStore = useRecipesStore()
const wasteLogsStore = useWasteLogsStore()
const auth = useAuthStore()
const { toast } = useToast()

const todayStr = todayInTaipei()
const blankForm = () => ({ type: 'material', materialId: '', drinkId: '', qty: null, reason: '' })
const form = ref(blankForm())
const showForm = ref(false)
const submitting = ref(false)
const todayEntries = ref([])

const selectedMaterial = computed(() => materialsStore.materials.find(m => m.id === form.value.materialId))
const unitLabel = computed(() => selectedMaterial.value ? `(${selectedMaterial.value.unit})` : '')

async function submitForm() {
    if (submitting.value) return
    const targetId = form.value.type === 'material' ? form.value.materialId : form.value.drinkId
    if (!targetId || !form.value.qty) {
        toast('請選擇品項並填寫數量', 'error')
        return
    }
    submitting.value = true
    try {
        const target = form.value.type === 'material'
            ? materialsStore.materials.find(m => m.id === form.value.materialId)
            : recipesStore.recipes.find(r => r.id === form.value.drinkId)
        if (!target) {
            toast('該品項已被移除，請重新選擇', 'error')
            return
        }
        const name = target.name
        const unit = form.value.type === 'material' ? target.unit : '杯'
        const qty = form.value.qty
        await wasteLogsStore.addWasteLog({
            date: todayStr,
            type: form.value.type,
            materialId: form.value.type === 'material' ? form.value.materialId : null,
            drinkId: form.value.type === 'drink' ? form.value.drinkId : null,
            qty,
            reason: form.value.reason,
            recordedBy: auth.name,
            recordedByUid: auth.user.uid
        })
        todayEntries.value.unshift({ name, qty, unit })
        toast('報廢已登記')
        form.value = blankForm()
        showForm.value = false
    } catch (e) {
        console.warn('報廢登記失敗:', e)
        toast(e.message === '報廢數量必須是正數' ? e.message : '登記失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}
</script>
