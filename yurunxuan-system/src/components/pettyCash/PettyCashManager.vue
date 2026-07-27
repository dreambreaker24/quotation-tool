<template>
    <div class="flex flex-col gap-4">
        <div class="bg-white rounded-2xl shadow-md p-5">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">零用金餘額</h2>
                </div>
                <span class="text-lg font-bold" :class="balance < (store.settings.lowBalanceThreshold ?? -Infinity) ? 'text-red-500' : 'text-gray-800'">
                    ${{ balance.toLocaleString() }}
                </span>
            </div>
            <div class="flex items-center gap-2 mt-3">
                <label class="text-xs text-gray-500">低餘額門檻</label>
                <input v-model.number="thresholdDraft" type="number" min="0" placeholder="留空表示不啟用低餘額推播"
                    class="w-40 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1">
                <button @click="saveThreshold" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#4a3535">儲存門檻</button>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-md p-5">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">零用金記帳</h2>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ store.entries.length }} 筆</span>
                </div>
                <button @click="openAdd" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#4a3535">+ 新增記帳</button>
            </div>

            <div v-if="store.entries.length === 0" class="text-sm text-gray-400 text-center py-8">尚無記帳紀錄，點擊右上新增</div>
            <div v-else class="flex flex-col gap-1">
                <div v-for="item in store.entries" :key="item.id"
                    class="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
                    <span class="text-gray-500 w-20 flex-shrink-0">{{ item.date }}</span>
                    <span class="w-12 flex-shrink-0" :class="item.type === 'expense' ? 'text-red-500' : 'text-green-600'">{{ item.type === 'expense' ? '支出' : '撥入' }}</span>
                    <span class="flex-1 font-medium text-gray-800">{{ item.description }}<span v-if="item.category" class="ml-1.5 text-[10px] text-gray-400">{{ item.category }}</span></span>
                    <span class="text-gray-600">{{ item.amount?.toLocaleString() }} 元</span>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-md p-5">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">月報表</h2>
                <div class="flex items-center gap-2">
                    <input v-model="reportMonth" type="month" class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1">
                    <button @click="doExport" class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">匯出 Excel</button>
                </div>
            </div>
            <div class="text-xs text-gray-600">
                本月撥入 {{ monthSummary.totalTopup.toLocaleString() }} 元／支出 {{ monthSummary.totalExpense.toLocaleString() }} 元
            </div>
        </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
        <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#d98fa0">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-bold text-gray-800">新增記帳</h3>
                <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">類型 *</label>
                    <div class="flex gap-2">
                        <button type="button" @click="form.type = 'topup'"
                            class="text-xs px-3 py-1.5 rounded-full border"
                            :class="form.type === 'topup' ? 'text-white border-transparent' : 'text-gray-500 border-gray-200'"
                            :style="form.type === 'topup' ? 'background:#4a3535' : ''">撥入</button>
                        <button type="button" @click="form.type = 'expense'"
                            class="text-xs px-3 py-1.5 rounded-full border"
                            :class="form.type === 'expense' ? 'text-white border-transparent' : 'text-gray-500 border-gray-200'"
                            :style="form.type === 'expense' ? 'background:#4a3535' : ''">支出</button>
                    </div>
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">日期 *</label>
                    <input v-model="form.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">金額 *</label>
                    <input v-model.number="form.amount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">分類</label>
                    <input v-model="form.category" type="text" placeholder="例：原料採購" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-xs text-gray-500 mb-1 block">用途說明</label>
                    <input v-model="form.description" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                </div>
                <label class="flex items-center gap-1.5 text-xs text-gray-600">
                    <input v-model="form.hasReceipt" type="checkbox">
                    有發票／收據
                </label>
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
import { ref, computed, watch } from 'vue'
import { usePettyCashStore } from '@/stores/pettyCash'
import { useExport } from '@/composables/useExport'
import { useToast } from '@/composables/useToast'
import { calcBalance, summarizeMonth } from '@/utils/pettyCashSummary'
import { todayInTaipei, currentMonthInTaipei } from '@/utils/date'

const store = usePettyCashStore()
const { exportPettyCash } = useExport()
const { toast } = useToast()

const showForm = ref(false)
const submitting = ref(false)
const reportMonth = ref(currentMonthInTaipei())
const thresholdDraft = ref(null)

watch(() => store.settings.lowBalanceThreshold, (v) => { thresholdDraft.value = v }, { immediate: true })

const blankForm = () => ({ type: 'topup', date: todayInTaipei(), amount: null, category: '', description: '', hasReceipt: false })
const form = ref(blankForm())

const balance = computed(() => calcBalance(store.entries))
const monthSummary = computed(() => summarizeMonth(store.entries, reportMonth.value))

function openAdd() {
    form.value = blankForm()
    showForm.value = true
}

async function submitForm() {
    if (submitting.value) return
    if (!form.value.date || !form.value.amount) {
        toast('請填寫日期與金額', 'error')
        return
    }
    submitting.value = true
    try {
        await store.addEntry(form.value)
        toast('記帳已新增')
        showForm.value = false
    } catch (e) {
        console.warn('新增零用金記帳失敗:', e)
        toast('儲存失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

async function saveThreshold() {
    try {
        await store.updateSettings({ lowBalanceThreshold: thresholdDraft.value === '' || thresholdDraft.value == null ? null : Number(thresholdDraft.value) })
        toast('門檻已更新')
    } catch (e) {
        console.warn('更新門檻失敗:', e)
        toast('更新失敗，請重試', 'error')
    }
}

function doExport() {
    exportPettyCash(store.entries, reportMonth.value)
}
</script>
