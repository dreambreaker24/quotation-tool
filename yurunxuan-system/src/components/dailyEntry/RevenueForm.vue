<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-4" style="border-left-color:#d98fa0">收入登記</h2>

        <div class="flex flex-col gap-3 mb-4">
            <div>
                <label class="text-xs text-gray-500 mb-1 block">日期</label>
                <input v-model="form.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1">
            </div>
            <div>
                <label class="text-xs text-gray-500 mb-1 block">金額 *</label>
                <input v-model.number="form.amount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1" placeholder="例：3200">
            </div>
            <div>
                <label class="text-xs text-gray-500 mb-1 block">付款方式 *</label>
                <div class="flex flex-wrap gap-2">
                    <button v-for="pm in paymentMethods" :key="pm" type="button" @click="form.paymentMethod = pm"
                        class="text-xs px-3 py-1.5 rounded-full border"
                        :class="form.paymentMethod === pm ? 'text-white border-transparent' : 'text-gray-500 border-gray-200'"
                        :style="form.paymentMethod === pm ? 'background:#4a3535' : ''">{{ pm }}</button>
                </div>
            </div>
            <div>
                <label class="text-xs text-gray-500 mb-1 block">備註</label>
                <input v-model="form.note" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1" placeholder="選填">
            </div>
        </div>

        <button @click="submitForm" :disabled="submitting"
            class="w-full text-white rounded-xl py-3 text-sm font-medium disabled:opacity-60" style="background:#4a3535">
            {{ submitting ? '登記中…' : '送出收入登記' }}
        </button>

        <div v-if="todayEntries.length > 0" class="mt-5 pt-4 border-t border-gray-100">
            <div class="text-xs text-gray-400 mb-2">本次登入已登記</div>
            <div class="flex flex-col gap-1.5">
                <div v-for="(e, idx) in todayEntries" :key="idx" class="text-xs text-gray-600 flex justify-between">
                    <span>{{ e.paymentMethod }}</span>
                    <span>{{ e.amount.toLocaleString() }} 元</span>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref } from 'vue'
import { useRevenueLogsStore } from '@/stores/revenueLogs'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { todayInTaipei } from '@/utils/date'

const revenueLogsStore = useRevenueLogsStore()
const auth = useAuthStore()
const { toast } = useToast()

const paymentMethods = ['現金', '轉帳', 'LINE Pay', '其他']
const todayStr = todayInTaipei()
const blankForm = () => ({ date: todayStr, amount: null, paymentMethod: '現金', note: '' })
const form = ref(blankForm())
const submitting = ref(false)
const todayEntries = ref([])

async function submitForm() {
    if (submitting.value) return
    if (!form.value.amount || !form.value.paymentMethod) {
        toast('請填寫金額並選擇付款方式', 'error')
        return
    }
    submitting.value = true
    const amount = form.value.amount
    const paymentMethod = form.value.paymentMethod
    try {
        await revenueLogsStore.addRevenueLog({
            date: form.value.date,
            amount,
            paymentMethod,
            note: form.value.note,
            recordedBy: auth.name,
            recordedByUid: auth.user.uid
        })
        todayEntries.value.unshift({ amount, paymentMethod })
        toast('收入登記成功')
        form.value = blankForm()
    } catch (e) {
        console.warn('收入登記失敗:', e)
        toast(e.message === '收入金額必須是正數' ? e.message : '登記失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}
</script>
