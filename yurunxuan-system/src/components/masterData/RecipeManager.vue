<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">配方表</h2>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ store.recipes.length }} 款</span>
            </div>
            <button v-if="auth.isOwner" @click="openAdd" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#4a3535">+ 新增配方</button>
        </div>

        <div v-if="store.recipes.length === 0" class="text-sm text-gray-400 text-center py-8">尚無配方，先到「原料/包材」分頁建好品項再回來設定配方</div>
        <div v-else class="flex flex-col gap-2">
            <div v-for="r in store.recipes" :key="r.id" class="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
                <div class="flex items-center gap-3 mb-1">
                    <span class="flex-1 font-medium text-gray-800">{{ r.name }}</span>
                    <span v-if="auth.isOwner" class="flex items-center gap-2">
                        <button @click="openEdit(r)" class="text-gray-400 hover:text-gray-700">編輯</button>
                        <button @click="confirmDelete(r)" class="text-red-400 hover:text-red-600">刪除</button>
                    </span>
                </div>
                <div class="text-gray-500">
                    {{ (r.ingredients || []).map(i => `${i.materialName} ${i.qtyPerUnit}${i.unit}`).join('、') || '（尚未設定用料）' }}
                </div>
            </div>
        </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
        <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#d98fa0">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-bold text-gray-800">{{ editingId ? '編輯配方' : '新增配方' }}</h3>
                <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">飲品名稱 *</label>
                    <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：潤雪飲">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-2 block">用料（每份用量）</label>
                    <div v-for="(ing, idx) in form.ingredients" :key="idx" class="flex items-center gap-2 mb-2">
                        <select v-model="ing.materialId" @change="onMaterialSelect(ing)" class="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1">
                            <option value="">選擇原料/包材</option>
                            <option v-for="m in materialsStore.materials" :key="m.id" :value="m.id">{{ m.name }}</option>
                        </select>
                        <input v-model.number="ing.qtyPerUnit" type="number" min="0" step="0.01" class="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1" placeholder="用量">
                        <span class="text-xs text-gray-400 w-8">{{ ing.unit }}</span>
                        <button @click="removeIngredient(idx)" class="text-red-400 hover:text-red-600 text-xs">移除</button>
                    </div>
                    <button @click="addIngredient" class="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400">+ 加一項用料</button>
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-5">
                <button @click="showForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
                <button @click="submitForm" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#4a3535">
                    {{ submitting ? '儲存中…' : '儲存' }}
                </button>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref } from 'vue'
import { useRecipesStore } from '@/stores/recipes'
import { useMaterialsStore } from '@/stores/materials'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const store = useRecipesStore()
const materialsStore = useMaterialsStore()
const auth = useAuthStore()
const { toast } = useToast()

const showForm = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const blankForm = () => ({ name: '', ingredients: [] })
const form = ref(blankForm())

function openAdd() {
    editingId.value = null
    form.value = blankForm()
    showForm.value = true
}

function openEdit(r) {
    editingId.value = r.id
    form.value = { name: r.name, ingredients: (r.ingredients || []).map(i => ({ ...i })) }
    showForm.value = true
}

function addIngredient() {
    form.value.ingredients.push({ materialId: '', materialName: '', qtyPerUnit: 0, unit: '' })
}

function removeIngredient(idx) {
    form.value.ingredients.splice(idx, 1)
}

function onMaterialSelect(ing) {
    const m = materialsStore.materials.find(m => m.id === ing.materialId)
    if (m) { ing.materialName = m.name; ing.unit = m.unit }
}

async function submitForm() {
    if (submitting.value) return
    if (!form.value.name) {
        toast('請填寫飲品名稱', 'error')
        return
    }
    submitting.value = true
    const data = {
        name: form.value.name,
        ingredients: form.value.ingredients.map(ing => ({ ...ing, qtyPerUnit: Number(ing.qtyPerUnit) || 0 }))
    }
    try {
        if (editingId.value) {
            await store.updateRecipe(editingId.value, data)
            toast('配方已更新')
        } else {
            await store.addRecipe(data)
            toast('配方已新增')
        }
        showForm.value = false
    } catch (e) {
        console.warn('儲存配方失敗:', e)
        toast('儲存失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

async function confirmDelete(r) {
    if (!confirm(`確定要刪除「${r.name}」配方？`)) return
    try {
        await store.deleteRecipe(r.id)
        toast('已刪除')
    } catch (e) {
        console.warn('刪除配方失敗:', e)
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
