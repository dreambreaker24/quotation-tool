<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">每月固定支出</h2>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ store.monthlyExpenses.length }} 筆</span>
            </div>
            <button @click="openAdd" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#4a3535">+ 新增支出</button>
        </div>

        <div v-if="store.monthlyExpenses.length === 0" class="text-sm text-gray-400 text-center py-8">尚無支出紀錄，點擊右上新增</div>
        <div v-else class="flex flex-col gap-1">
            <div v-for="item in store.monthlyExpenses" :key="item.id"
                class="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
                <span class="text-gray-500 w-20 flex-shrink-0">{{ item.date }}</span>
                <span class="flex-1 font-medium text-gray-800">{{ item.item }}<span class="ml-1.5 text-[10px] text-gray-400">{{ item.category }}</span></span>
                <span class="text-gray-600">{{ item.amount?.toLocaleString() }} 元</span>
                <span class="flex items-center gap-2">
                    <button @click="openEdit(item)" class="text-gray-400 hover:text-gray-700">編輯</button>
                    <button @click="confirmDelete(item)" class="text-red-400 hover:text-red-600">刪除</button>
                </span>
            </div>
        </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
        <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#d98fa0">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-bold text-gray-800">{{ editingId ? '編輯支出' : '新增支出' }}</h3>
                <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">月份 *</label>
                    <input v-model="form.date" type="month" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">分類 *</label>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="cat in categories" :key="cat" type="button" @click="form.category = cat"
                            class="text-xs px-2.5 py-1 rounded-full border"
                            :class="form.category === cat ? 'text-white border-transparent' : 'text-gray-500 border-gray-200'"
                            :style="form.category === cat ? 'background:#4a3535' : ''">{{ cat }}</button>
                    </div>
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">項目名稱 *</label>
                    <input v-model="form.item" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：店面租金">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">金額 *</label>
                    <input v-model.number="form.amount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
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
import { useMonthlyExpensesStore } from '@/stores/monthlyExpenses'
import { useToast } from '@/composables/useToast'
import { currentMonthInTaipei } from '@/utils/date'

const store = useMonthlyExpensesStore()
const { toast } = useToast()

const categories = ['房租水電', '人事', '行銷廣告', '其他']
const showForm = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const blankForm = () => ({ date: currentMonthInTaipei(), category: '房租水電', item: '', amount: null })
const form = ref(blankForm())

function openAdd() {
    editingId.value = null
    form.value = blankForm()
    showForm.value = true
}

function openEdit(item) {
    editingId.value = item.id
    form.value = { date: item.date, category: item.category, item: item.item, amount: item.amount }
    showForm.value = true
}

async function submitForm() {
    if (submitting.value) return
    if (!form.value.date || !form.value.item || !form.value.amount) {
        toast('請填寫月份、項目名稱與金額', 'error')
        return
    }
    submitting.value = true
    try {
        if (editingId.value) {
            await store.updateMonthlyExpense(editingId.value, form.value)
            toast('支出已更新')
        } else {
            await store.addMonthlyExpense(form.value)
            toast('支出已新增')
        }
        showForm.value = false
    } catch (e) {
        console.warn('儲存每月支出失敗:', e)
        toast('儲存失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

async function confirmDelete(item) {
    if (!confirm(`確定要刪除「${item.item}」這筆支出？`)) return
    try {
        await store.deleteMonthlyExpense(item.id)
        toast('已刪除')
    } catch (e) {
        console.warn('刪除每月支出失敗:', e)
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
