<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-80 mx-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ title }}</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
      </div>

      <div class="mb-4">
        <label class="text-xs text-gray-500 mb-1 block">金額</label>
        <input v-if="!fixedAmount" v-model.number="amount" type="number" min="0"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        <div v-else class="text-lg font-bold" style="color:#c9a96e">{{ defaultAmount.toLocaleString() }}</div>
      </div>

      <div class="mb-6">
        <label class="text-xs text-gray-500 mb-1 block">日期</label>
        <input v-model="paidDate" type="date"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>

      <div class="flex justify-end gap-2">
        <button data-test="cancel-btn" @click="$emit('close')" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button data-test="confirm-btn" @click="confirm" :disabled="saving"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-50" style="background:#1e2533">
          {{ saving ? '處理中...' : '確認完成' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
    title: { type: String, required: true },
    defaultAmount: { type: Number, required: true },
    fixedAmount: { type: Boolean, default: false },
    saving: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm', 'close'])

const amount = ref(props.defaultAmount)
const today = new Date().toISOString().slice(0, 10)
const paidDate = ref(today)

function confirm() {
    emit('confirm', { amount: props.fixedAmount ? props.defaultAmount : amount.value, paidDate: paidDate.value })
}
</script>
