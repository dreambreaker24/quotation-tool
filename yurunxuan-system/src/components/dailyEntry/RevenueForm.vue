<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-4" style="border-left-color:#d98fa0">收入登記</h2>

        <div class="flex flex-col gap-3 mb-4">
            <div>
                <label class="text-xs text-gray-500 mb-1 block">日期</label>
                <input v-model="form.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1">
            </div>

            <div class="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                <label class="text-xs text-gray-500 mb-2 block">新增品項</label>
                <select v-model="draft.drinkId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white mb-2 focus:outline-none focus:ring-1">
                    <option value="">選擇飲品</option>
                    <option v-for="r in recipesStore.recipes" :key="r.id" :value="r.id">{{ r.name }}</option>
                </select>
                <div v-if="selectedRecipe" class="grid grid-cols-3 gap-2 mb-2">
                    <button v-for="tier in tiers" :key="tier.key" type="button" @click="draft.tier = tier.key"
                        class="text-xs py-2 rounded-lg border text-center leading-tight"
                        :class="draft.tier === tier.key ? 'text-white border-transparent' : 'text-gray-500 border-gray-200'"
                        :style="draft.tier === tier.key ? 'background:#4a3535' : ''">
                        {{ tier.label }}<br>{{ selectedRecipe.pricing?.[tier.key]?.price ?? 0 }} 元
                    </button>
                </div>
                <div class="flex gap-2">
                    <input v-model.number="draft.qty" type="number" min="1" placeholder="組數" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
                    <button @click="addItem" type="button" class="text-xs px-4 rounded-lg border border-gray-300 text-gray-600">加入</button>
                </div>
            </div>

            <div v-if="items.length > 0" class="flex flex-col gap-1.5">
                <div v-for="(item, idx) in items" :key="idx" class="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50/70">
                    <span>{{ item.drinkName }} {{ item.tierLabel }} × {{ item.qty }}</span>
                    <span class="flex items-center gap-2">
                        {{ item.subtotal.toLocaleString() }} 元
                        <button @click="items.splice(idx, 1)" type="button" class="text-red-400 hover:text-red-600">✕</button>
                    </span>
                </div>
                <div class="flex justify-between text-sm font-medium px-3 pt-1">
                    <span>總金額</span>
                    <span>{{ totalAmount.toLocaleString() }} 元</span>
                </div>
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

        <button @click="submitForm" :disabled="submitting || items.length === 0"
            class="w-full text-white rounded-xl py-3 text-sm font-medium disabled:opacity-60" style="background:#4a3535">
            {{ submitting ? '登記中…' : '送出銷售登記' }}
        </button>

        <div v-if="todayEntries.length > 0" class="mt-5 pt-4 border-t border-gray-100">
            <div class="text-xs text-gray-400 mb-2">本次登入已登記</div>
            <div class="flex flex-col gap-1.5">
                <div v-for="(e, idx) in todayEntries" :key="idx" class="text-xs text-gray-600 flex justify-between gap-3">
                    <span class="flex-1 truncate">{{ e.summary }}</span>
                    <span class="shrink-0">{{ e.amount.toLocaleString() }} 元</span>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRevenueLogsStore } from '@/stores/revenueLogs'
import { useRecipesStore } from '@/stores/recipes'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { todayInTaipei } from '@/utils/date'
import { buildSaleItem } from '@/utils/saleItems'

const revenueLogsStore = useRevenueLogsStore()
const recipesStore = useRecipesStore()
const auth = useAuthStore()
const { toast } = useToast()

const tiers = [
    { key: 'single', label: '單瓶' },
    { key: 'pack3', label: '3入組' },
    { key: 'pack6', label: '6入組' }
]
const paymentMethods = ['現金', '轉帳', 'LINE Pay', '其他']
const todayStr = todayInTaipei()
const blankForm = () => ({ date: todayStr, paymentMethod: '現金', note: '' })
const blankDraft = () => ({ drinkId: '', tier: 'single', qty: null })

const form = ref(blankForm())
const draft = ref(blankDraft())
const items = ref([])
const submitting = ref(false)
const todayEntries = ref([])

const selectedRecipe = computed(() => recipesStore.recipes.find(r => r.id === draft.value.drinkId))
const totalAmount = computed(() => items.value.reduce((sum, item) => sum + item.subtotal, 0))

function addItem() {
    if (!selectedRecipe.value) {
        toast('請選擇飲品', 'error')
        return
    }
    try {
        items.value.push(buildSaleItem(selectedRecipe.value, draft.value.tier, draft.value.qty))
        draft.value = blankDraft()
    } catch (e) {
        toast(e.message, 'error')
    }
}

async function submitForm() {
    if (submitting.value || items.value.length === 0) return
    submitting.value = true
    const submittedItems = items.value
    const paymentMethod = form.value.paymentMethod
    try {
        await revenueLogsStore.addRevenueLog({
            date: form.value.date,
            items: submittedItems,
            paymentMethod,
            note: form.value.note,
            recordedBy: auth.name,
            recordedByUid: auth.user.uid
        })
        const amount = submittedItems.reduce((sum, item) => sum + item.subtotal, 0)
        const summary = submittedItems.map(item => `${item.drinkName}${item.tierLabel}×${item.qty}`).join('、')
        todayEntries.value.unshift({ amount, summary })
        toast('銷售登記成功')
        form.value = blankForm()
        items.value = []
    } catch (e) {
        console.warn('銷售登記失敗:', e)
        const isKnownError = e.message === '請至少新增一個銷售品項' || e.message?.includes('庫存不足')
        toast(isKnownError ? e.message : '登記失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}
</script>
