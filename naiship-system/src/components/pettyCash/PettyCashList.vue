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

    <!-- 補登支出提示：本月餘額裡含有其他月份補登記的支出 -->
    <div v-if="backfilledIntoThisMonth.total > 0"
      class="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
      ⚠ {{ filterMonth }} 的餘額包含 {{ backfilledIntoThisMonth.count }} 筆其他月份補登的支出，共 ${{ backfilledIntoThisMonth.total.toLocaleString() }}（實際發生日期不在本月，但登記當下扣的是本月額度）
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
        <div v-if="entry.linkedCaseName"><span class="text-gray-400">關聯：</span>{{ resolveCaseName(entry) }}</div>
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
        <div v-if="entry.receiptImages?.length" class="flex flex-col gap-1.5 pt-1">
          <FileSelectionBar
            :selecting="getReceiptFileSelection(entry.id).selecting.value"
            :count="getReceiptFileSelection(entry.id).selected.value.size"
            :can-share="getReceiptFileSelection(entry.id).canShare.value"
            @start="getReceiptFileSelection(entry.id).startSelecting()"
            @stop="getReceiptFileSelection(entry.id).stopSelecting()"
            @select-all="getReceiptFileSelection(entry.id).selectAll()"
            @download="handleReceiptDownloadSelected(entry)"
            @share="handleReceiptShareSelected(entry)" />
          <div class="flex gap-2 flex-wrap">
            <div v-for="url in entry.receiptImages" :key="url" class="relative">
              <div v-if="getReceiptFileSelection(entry.id).selecting.value"
                class="absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-white z-10 shadow flex items-center justify-center cursor-pointer"
                :style="getReceiptFileSelection(entry.id).selected.value.has(url) ? 'background:#c9a96e' : 'background:#fff'"
                @click.stop="getReceiptFileSelection(entry.id).toggle(url)">
                <span v-if="getReceiptFileSelection(entry.id).selected.value.has(url)" class="text-white text-[9px] leading-none">✓</span>
              </div>
              <img :src="url"
                class="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80"
                @click="handleReceiptThumbClick(entry, url)">
            </div>
          </div>
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
import { useCasesStore } from '@/stores/cases'
import { useToast } from '@/composables/useToast'
import { useFileSelection } from '@/composables/useFileSelection'
import FileSelectionBar from '@/components/ui/FileSelectionBar.vue'

defineEmits(['edit'])

const auth = useAuthStore()
const store = usePettyCashStore()
const casesStore = useCasesStore()

// 案件如果後來改名，關聯案件要顯示現在的名字，不是記帳當下存的舊名字（'naiship'/'boyan' 是公司層級固定選項，不是真的案件，維持顯示原本存的名稱）
function resolveCaseName(entry) {
    if (!entry.linkedCaseName) return ''
    if (entry.linkedCase === 'naiship' || entry.linkedCase === 'boyan') return entry.linkedCaseName
    const c = casesStore.cases.find(x => x.id === entry.linkedCase)
    return c?.name || entry.linkedCaseName
}
const { toast } = useToast()

const filterPayer = ref('')
const filterType = ref('')
const expanded = reactive({})
const previewUrl = ref(null)

const receiptFileSelections = {}
function getReceiptFileSelection(entryId) {
    if (!receiptFileSelections[entryId]) {
        receiptFileSelections[entryId] = useFileSelection(computed(() => {
            const entry = store.entries.find(e => e.id === entryId)
            return (entry?.receiptImages || []).map(url => ({ url, isPdf: false }))
        }))
    }
    return receiptFileSelections[entryId]
}

function handleReceiptThumbClick(entry, url) {
    const sel = getReceiptFileSelection(entry.id)
    if (sel.selecting.value) sel.toggle(url)
    else previewUrl.value = url
}

async function handleReceiptDownloadSelected(entry) {
    const { failCount } = await getReceiptFileSelection(entry.id).downloadSelected()
    if (failCount > 0) toast(`${failCount} 個檔案下載失敗，已略過`, 'error')
}

async function handleReceiptShareSelected(entry) {
    const { ok, failCount } = await getReceiptFileSelection(entry.id).shareSelected()
    if (failCount > 0) toast(`${failCount} 個檔案準備分享時失敗，已略過`, 'error')
    if (!ok && failCount === 0) toast('分享失敗，請重試', 'error')
}

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

// 補登支出：實際發生日期（date）不在目前篩選的月份，但登記時間（createdAt）落在目前篩選的月份——
// 因為 bunBalance/laiBalance 是不分月份的連續累計，這種補登記的支出會扣到「登記當下」那個月的額度，
// 不是扣到「實際發生」那個月，容易讓人誤會這個月怎麼突然變少。只算支出（expense），且要跟目前的
// 人員/類型篩選一致，才不會提示跟畫面上看到的清單對不起來。
const backfilledIntoThisMonth = computed(() => {
    const matches = store.entries.filter(e => {
        if (e.type !== 'expense') return false
        if (filterPayer.value && e.payerName !== filterPayer.value) return false
        if (filterType.value && filterType.value !== 'expense') return false
        const entryMonth = e.date?.slice(0, 7)
        const createdMonth = e.createdAt?.toDate?.().toISOString().slice(0, 7)
        if (!entryMonth || !createdMonth) return false
        return createdMonth === filterMonth.value && entryMonth !== filterMonth.value
    })
    return {
        count: matches.length,
        total: matches.reduce((s, e) => s + (e.amount || 0), 0),
    }
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
