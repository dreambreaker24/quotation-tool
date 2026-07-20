<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">原料/包材主檔</h2>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ store.materials.length }} 項</span>
            </div>
            <button v-if="auth.isOwner" @click="openAdd" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#4a3535">+ 新增品項</button>
        </div>

        <div v-if="store.materials.length === 0" class="text-sm text-gray-400 text-center py-8">尚無原料/包材資料</div>
        <div v-else class="flex flex-col gap-1">
            <div v-for="m in store.materials" :key="m.id"
                class="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
                <span class="flex-1 font-medium text-gray-800">{{ m.name }}<span class="ml-1.5 text-[10px] text-gray-400">{{ m.category }}</span></span>
                <span class="text-gray-600">庫存 {{ m.currentStock ?? 0 }} {{ m.unit }}</span>
                <span v-if="auth.isOwner" class="flex items-center gap-2">
                    <button @click="openEdit(m)" class="text-gray-400 hover:text-gray-700">編輯</button>
                    <button @click="confirmDelete(m)" class="text-red-400 hover:text-red-600">刪除</button>
                </span>
            </div>
        </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
        <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#d98fa0">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-bold text-gray-800">{{ editingId ? '編輯品項' : '新增品項' }}</h3>
                <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">品項名稱 *</label>
                    <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：白木耳">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">分類 *</label>
                    <select v-model="form.category" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                        <option value="原料">原料</option>
                        <option value="包材">包材</option>
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-500 mb-1 block">單位 *</label>
                        <input v-model="form.unit" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：kg / 個">
                    </div>
                    <div>
                        <label class="text-xs text-gray-500 mb-1 block">目前庫存量</label>
                        <input v-model.number="form.currentStock" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                    </div>
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">安全庫存量（低於此量之後版本會提醒補貨）</label>
                    <input v-model.number="form.safetyStock" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
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
import { useMaterialsStore } from '@/stores/materials'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const store = useMaterialsStore()
const auth = useAuthStore()
const { toast } = useToast()

const showForm = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const blankForm = () => ({ name: '', category: '原料', unit: '', currentStock: 0, safetyStock: 0 })
const form = ref(blankForm())

function openAdd() {
    editingId.value = null
    form.value = blankForm()
    showForm.value = true
}

function openEdit(m) {
    editingId.value = m.id
    form.value = { name: m.name, category: m.category, unit: m.unit, currentStock: m.currentStock ?? 0, safetyStock: m.safetyStock ?? 0 }
    showForm.value = true
}

async function submitForm() {
    if (submitting.value) return
    if (!form.value.name || !form.value.unit) {
        toast('請填寫品項名稱與單位', 'error')
        return
    }
    submitting.value = true
    const data = {
        ...form.value,
        currentStock: Number(form.value.currentStock) || 0,
        safetyStock: Number(form.value.safetyStock) || 0
    }
    try {
        if (editingId.value) {
            await store.updateMaterial(editingId.value, data)
            toast('品項已更新')
        } else {
            await store.addMaterial(data)
            toast('品項已新增')
        }
        showForm.value = false
    } catch (e) {
        console.warn('儲存品項失敗:', e)
        toast('儲存失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

async function confirmDelete(m) {
    if (!confirm(`確定要刪除「${m.name}」？`)) return
    try {
        await store.deleteMaterial(m.id)
        toast('已刪除')
    } catch (e) {
        console.warn('刪除品項失敗:', e)
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
