<template>
  <div>
    <!-- 篩選列 -->
    <div class="flex flex-wrap gap-2 mb-3">
      <select v-if="auth.isAdmin || auth.isManager" v-model="filterPayer"
        class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
        <option value="">全部人員</option>
        <option>柏</option>
        <option>蚌</option>
        <option>賴賴</option>
      </select>
      <select v-model="filterMonth"
        class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
        <option v-for="m in monthOptions" :key="m" :value="m">{{ m }}</option>
      </select>
      <select v-model="filterType"
        class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
        <option value="">全部類型</option>
        <option value="expense">支出</option>
        <option value="topup">補款</option>
        <option value="distribute">發放</option>
        <option value="return">歸還</option>
      </select>
    </div>

    <!-- 空狀態 -->
    <div v-if="filtered.length === 0" class="text-center text-sm text-gray-400 py-12">
      {{ filterMonth }} 無記錄
    </div>

    <!-- 交易列表 -->
    <div v-for="entry in filtered" :key="entry.id"
      class="bg-white rounded-2xl shadow-sm mb-2 overflow-hidden">
      <!-- 摘要列 -->
      <div class="flex items-center gap-2 sm:gap-3 px-4 py-3 cursor-pointer select-none"
        @click="expanded[entry.id] = !expanded[entry.id]">
        <span class="text-[11px] text-gray-400 w-10 flex-shrink-0">{{ shortDate(entry.date) }}</span>
        <span class="text-[11px] font-semibold text-white px-2 py-0.5 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[3rem]"
          :style="`background:${payerColor(entry.payerName)}`">{{ entry.payerName }}</span>
        <span class="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[2.5rem]"
          :class="TYPE_STYLES[entry.type]">{{ TYPE_LABELS[entry.type] }}</span>
        <span class="text-xs text-gray-500 truncate flex-1 min-w-0">{{ entry.description }}</span>
        <span class="text-sm font-bold flex-shrink-0"
          :class="entry.type === 'expense' ? 'text-red-500' : 'text-green-600'">
          {{ entry.type === 'expense' ? '-' : '+' }}${{ (entry.amount || 0).toLocaleString() }}
        </span>
        <span v-if="entry.receiptImages?.length" class="text-gray-300 text-sm flex-shrink-0">📎</span>
        <span class="text-gray-300 text-xs flex-shrink-0">{{ expanded[entry.id] ? '▲' : '▼' }}</span>
      </div>

      <!-- 展開詳細 -->
      <div v-if="expanded[entry.id]"
        class="border-t border-gray-100 px-4 py-3 bg-gray-50 text-xs text-gray-600 space-y-1.5">
        <div v-if="entry.category"><span class="text-gray-400">分類：</span>{{ entry.category }}</div>
        <div v-if="entry.linkedCaseName"><span class="text-gray-400">關聯：</span>{{ entry.linkedCaseName }}</div>
        <div v-if="entry.receiptType && entry.receiptType !== 'none'">
          <span class="text-gray-400">憑證：</span>{{ RECEIPT_LABELS[entry.receiptType] }}
        </div>
        <div v-if="entry.workerName">
          <span class="text-gray-400">工人：</span>{{ entry.workerName }}
          <span v-if="entry.workerPhone">（{{ entry.workerPhone }}）</span>
          <span v-if="entry.isTaxable" class="ml-2 text-green-600 font-medium">可報稅</span>
        </div>
        <div v-if="entry.supervisorName"><span class="text-gray-400">單位主管：</span>{{ entry.supervisorName }}</div>
        <div v-if="entry.inspectorName"><span class="text-gray-400">監工：</span>{{ entry.inspectorName }}</div>
        <div v-if="entry.receiptImages?.length" class="flex gap-2 pt-1 flex-wrap">
          <img v-for="url in entry.receiptImages" :key="url" :src="url"
            class="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80"
            @click="previewUrl = url">
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button v-if="canEdit(entry)" @click.stop="$emit('edit', entry)"
            class="text-xs border border-gray-200 rounded-lg px-3 py-1 text-gray-500 hover:border-gray-400">
            編輯
          </button>
          <button v-if="auth.isAdmin" @click.stop="doDelete(entry.id)"
            class="text-xs border border-red-200 rounded-lg px-3 py-1 text-red-400 hover:bg-red-50">
            刪除
          </button>
        </div>
      </div>
    </div>

    <!-- 篩選小計 -->
    <div v-if="filtered.length > 0"
      class="flex items-center justify-between px-4 py-2.5 rounded-xl mt-1 text-xs"
      style="background:#f8f7f4;border:1px solid #eeebe4">
      <span class="text-gray-400">{{ filterMonth }} 小計</span>
      <div class="flex items-center gap-4">
        <span v-if="filteredStats.expense > 0" class="text-red-500 font-semibold">
          支出 ${{ filteredStats.expense.toLocaleString() }}
        </span>
        <span v-if="filteredStats.topup > 0" class="text-green-600 font-semibold">
          補款 ${{ filteredStats.topup.toLocaleString() }}
        </span>
        <span class="font-bold" :class="filteredStats.net >= 0 ? 'text-gray-700' : 'text-red-600'">
          淨 {{ filteredStats.net >= 0 ? '+' : '' }}${{ filteredStats.net.toLocaleString() }}
        </span>
      </div>
    </div>

    <!-- 圖片預覽 -->
    <div v-if="previewUrl" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      @click="previewUrl = null">
      <img :src="previewUrl" class="max-w-[90vw] max-h-[90vh] rounded-xl object-contain">
    </div>
  </div>
</template>
<script setup>
import { ref, computed, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePettyCashStore } from '@/stores/pettyCash'
import { useToast } from '@/composables/useToast'

defineEmits(['edit'])

const auth = useAuthStore()
const store = usePettyCashStore()
const { toast } = useToast()

const filterPayer = ref('')
const filterType = ref('')
const expanded = reactive({})
const previewUrl = ref(null)

const today = new Date()
const filterMonth = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)

defineExpose({ filterMonth })

const monthOptions = computed(() => {
    const months = new Set()
    store.entries.forEach(e => { if (e.date) months.add(e.date.slice(0, 7)) })
    months.add(filterMonth.value)
    return [...months].sort().reverse()
})

const filtered = computed(() => {
    let list = [...store.entries]
    if (auth.role === 'employee' && !auth.isManager) {
        list = list.filter(e => e.payerName === auth.name)
    }
    if (filterPayer.value) list = list.filter(e => e.payerName === filterPayer.value)
    if (filterMonth.value) list = list.filter(e => e.date?.startsWith(filterMonth.value))
    if (filterType.value) list = list.filter(e => e.type === filterType.value)
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
})

const filteredStats = computed(() => {
    const expense = filtered.value.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0)
    const topup = filtered.value.filter(e => e.type === 'topup').reduce((s, e) => s + (e.amount || 0), 0)
    return { expense, topup, net: topup - expense }
})

function shortDate(dateStr) {
    if (!dateStr) return ''
    const [, m, d] = dateStr.split('-')
    return `${parseInt(m)}/${parseInt(d)}`
}

function canEdit(entry) {
    if (auth.isAdmin) return true
    if (entry.payerName !== auth.name) return false
    const currentMonth = new Date().toISOString().slice(0, 7)
    return (entry.date?.slice(0, 7) ?? '') === currentMonth
}

async function doDelete(id) {
    if (!confirm('確定要刪除這筆記錄？')) return
    try {
        await store.deleteEntry(id)
        toast('已刪除')
    } catch {
        toast('刪除失敗', 'error')
    }
}

const TYPE_LABELS = { expense: '支出', topup: '補款', distribute: '發放', return: '歸還' }
const TYPE_STYLES = {
    expense: 'bg-red-50 text-red-600',
    topup: 'bg-green-50 text-green-600',
    distribute: 'bg-blue-50 text-blue-600',
    return: 'bg-gray-100 text-gray-500',
}
const RECEIPT_LABELS = { invoice: '發票', workorder: '點工單', none: '無憑證' }

function payerColor(name) {
    return { '柏': '#c9a96e', '蚌': '#ef4444', '賴賴': '#a855f7' }[name] ?? '#6b7280'
}
</script>
