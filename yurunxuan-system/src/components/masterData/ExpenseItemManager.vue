<template>
  <div class="bg-white rounded-2xl shadow-md p-5">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">開店支出攤提</h2>
        <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ store.expenseItems.length }} 項</span>
      </div>
      <button @click="openAdd" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#4a3535">+ 新增項目</button>
    </div>

    <div v-if="store.expenseItems.length === 0" class="text-sm text-gray-400 text-center py-8">尚無支出項目，點擊右上新增</div>
    <div v-else class="flex flex-col gap-1">
      <div class="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-1.5 text-[11px] text-gray-400">
        <span>項目名稱</span><span class="text-right">金額</span><span class="text-right">攤提年限</span><span class="text-right">每月攤提</span><span></span>
      </div>
      <div v-for="item in store.expenseItems" :key="item.id"
        class="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
        <span class="font-medium text-gray-800">{{ item.name }}<span class="ml-1.5 text-[10px] text-gray-400">{{ item.category }}</span></span>
        <span class="text-right text-gray-600">{{ item.amount?.toLocaleString() }}</span>
        <span class="text-right text-gray-600">{{ item.amortizeMonths }} 個月</span>
        <span class="text-right font-medium" style="color:#d98fa0">{{ calcMonthlyAmortization(item.amount, item.amortizeMonths).toLocaleString() }}</span>
        <span class="flex items-center gap-2 justify-end">
          <button @click="openEdit(item)" class="text-gray-400 hover:text-gray-700">編輯</button>
          <button @click="confirmDelete(item)" class="text-red-400 hover:text-red-600">刪除</button>
        </span>
      </div>
      <div class="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 mt-1 border-t border-gray-100 text-xs font-semibold">
        <span>合計每月攤提</span><span></span><span></span>
        <span class="text-right" style="color:#d98fa0">{{ totalMonthlyAmortization.toLocaleString() }}</span><span></span>
      </div>
    </div>
  </div>

  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#d98fa0">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ editingId ? '編輯支出項目' : '新增支出項目' }}</h3>
        <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">項目名稱 *</label>
          <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：裝潢工程">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">分類</label>
          <input v-model="form.category" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：裝潢 / 設備 / 押金">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">金額 *</label>
            <input v-model.number="form.amount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">攤提年限（月）*</label>
            <input v-model.number="form.amortizeMonths" type="number" min="1" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="預設 60">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">開始攤提日期</label>
          <input v-model="form.startDate" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div v-if="form.amount && form.amortizeMonths" class="text-xs rounded-lg px-3 py-2" style="background:#f6e2e5;color:#4a3535">
          每月攤提：{{ calcMonthlyAmortization(form.amount, form.amortizeMonths).toLocaleString() }} 元
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
import { ref, computed } from 'vue'
import { useExpenseItemsStore } from '@/stores/expenseItems'
import { useToast } from '@/composables/useToast'
import { calcMonthlyAmortization } from '@/utils/amortization'

const store = useExpenseItemsStore()
const { toast } = useToast()

const totalMonthlyAmortization = computed(() =>
  store.expenseItems.reduce((sum, item) => sum + calcMonthlyAmortization(item.amount, item.amortizeMonths), 0)
)

const showForm = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const blankForm = () => ({ name: '', category: '', amount: null, amortizeMonths: 60, startDate: '' })
const form = ref(blankForm())

function openAdd() {
    editingId.value = null
    form.value = blankForm()
    showForm.value = true
}

function openEdit(item) {
    editingId.value = item.id
    form.value = { name: item.name, category: item.category || '', amount: item.amount, amortizeMonths: item.amortizeMonths, startDate: item.startDate || '' }
    showForm.value = true
}

async function submitForm() {
    if (!form.value.name || !form.value.amount || !form.value.amortizeMonths || submitting.value) return
    submitting.value = true
    try {
        if (editingId.value) {
            await store.updateExpenseItem(editingId.value, form.value)
            toast('支出項目已更新')
        } else {
            await store.addExpenseItem(form.value)
            toast('支出項目已新增')
        }
        showForm.value = false
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

async function confirmDelete(item) {
    if (!confirm(`確定要刪除「${item.name}」？`)) return
    try {
        await store.deleteExpenseItem(item.id)
        toast('已刪除')
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
