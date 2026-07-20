<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">廠商資料</h2>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ store.vendors.length }} 家</span>
            </div>
            <button @click="openAdd" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#4a3535">+ 新增廠商</button>
        </div>

        <div v-if="store.vendors.length === 0" class="text-sm text-gray-400 text-center py-8">尚無廠商資料</div>
        <div v-else class="flex flex-col gap-1">
            <div v-for="v in store.vendors" :key="v.id"
                class="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
                <span class="flex-1 font-medium text-gray-800">{{ v.name }}<span class="ml-1.5 text-[10px] text-gray-400">{{ v.category }}</span></span>
                <span class="text-gray-500">{{ v.contact }}<span v-if="v.contact && v.phone" class="mx-1 text-gray-300">·</span>{{ v.phone }}</span>
                <span class="flex items-center gap-2">
                    <button @click="openEdit(v)" class="text-gray-400 hover:text-gray-700">編輯</button>
                    <button @click="confirmDelete(v)" class="text-red-400 hover:text-red-600">刪除</button>
                </span>
            </div>
        </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
        <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#d98fa0">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-bold text-gray-800">{{ editingId ? '編輯廠商' : '新增廠商' }}</h3>
                <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">廠商名稱 *</label>
                    <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">分類</label>
                    <input v-model="form.category" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：原料供應商 / 包材供應商">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs text-gray-500 mb-1 block">聯絡人</label>
                        <input v-model="form.contact" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                    </div>
                    <div>
                        <label class="text-xs text-gray-500 mb-1 block">電話</label>
                        <input v-model="form.phone" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                    </div>
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">備註</label>
                    <textarea v-model="form.note" rows="2" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"></textarea>
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
import { useVendorsStore } from '@/stores/vendors'
import { useToast } from '@/composables/useToast'

const store = useVendorsStore()
const { toast } = useToast()

const showForm = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const blankForm = () => ({ name: '', category: '', contact: '', phone: '', note: '' })
const form = ref(blankForm())

function openAdd() {
    editingId.value = null
    form.value = blankForm()
    showForm.value = true
}

function openEdit(v) {
    editingId.value = v.id
    form.value = { name: v.name, category: v.category || '', contact: v.contact || '', phone: v.phone || '', note: v.note || '' }
    showForm.value = true
}

async function submitForm() {
    if (submitting.value) return
    if (!form.value.name) {
        toast('請填寫廠商名稱', 'error')
        return
    }
    submitting.value = true
    try {
        if (editingId.value) {
            await store.updateVendor(editingId.value, form.value)
            toast('廠商已更新')
        } else {
            await store.addVendor(form.value)
            toast('廠商已新增')
        }
        showForm.value = false
    } catch (e) {
        console.warn('儲存廠商失敗:', e)
        toast('儲存失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

async function confirmDelete(v) {
    if (!confirm(`確定要刪除「${v.name}」？`)) return
    try {
        await store.deleteVendor(v.id)
        toast('已刪除')
    } catch (e) {
        console.warn('刪除廠商失敗:', e)
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
