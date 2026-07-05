<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-80 mx-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">月底結算</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
      </div>
      <p class="text-xs text-gray-400 mb-4">輸入各人實際繳回金額，系統自動建立歸還紀錄。</p>

      <!-- 蚌 -->
      <div class="mb-4">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-gray-700">蚌</span>
          <span class="text-xs text-gray-400">目前餘額 ${{ store.bunBalance.toLocaleString() }}</span>
        </div>
        <input v-model.number="bunReturn" type="number" min="0"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>

      <!-- 賴賴 -->
      <div class="mb-6">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-gray-700">賴賴</span>
          <span class="text-xs text-gray-400">目前餘額 ${{ store.laiBalance.toLocaleString() }}</span>
        </div>
        <input v-model.number="laiReturn" type="number" min="0"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>

      <div class="flex justify-end gap-2">
        <button @click="$emit('close')" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="settle" :disabled="saving"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-50" style="background:#1e2533">
          {{ saving ? '處理中...' : '確認結算' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { usePettyCashStore } from '@/stores/pettyCash'
import { useToast } from '@/composables/useToast'

const emit = defineEmits(['close'])
const store = usePettyCashStore()
const { toast } = useToast()

const today = new Date().toISOString().slice(0, 10)
const bunReturn = ref(store.bunBalance)
const laiReturn = ref(store.laiBalance)
const saving = ref(false)

const EMPTY_FIELDS = { workerName: '', workerPhone: '', isTaxable: false, supervisorName: '', inspectorName: '' }

async function settle() {
    saving.value = true
    try {
        const jobs = []
        if (bunReturn.value > 0) {
            jobs.push(store.addEntry({
                date: today, payerName: '蚌', payerId: '', type: 'return',
                amount: bunReturn.value, category: '', description: '月底結算歸還',
                linkedCase: '', linkedCaseName: '', receiptType: 'none', receiptImages: [],
                ...EMPTY_FIELDS,
            }))
        }
        if (laiReturn.value > 0) {
            jobs.push(store.addEntry({
                date: today, payerName: '賴賴', payerId: '', type: 'return',
                amount: laiReturn.value, category: '', description: '月底結算歸還',
                linkedCase: '', linkedCaseName: '', receiptType: 'none', receiptImages: [],
                ...EMPTY_FIELDS,
            }))
        }
        await Promise.all(jobs)
        toast('結算完成')
        emit('close')
    } catch {
        toast('結算失敗，請重試', 'error')
    } finally {
        saving.value = false
    }
}
</script>
