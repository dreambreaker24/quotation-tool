<template>
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <h3 class="text-sm font-bold text-gray-800">{{ isEdit ? '編輯記錄' : '新增記錄' }}</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
      </div>

      <div class="px-5 py-4 space-y-4">
        <!-- 日期 -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">日期</label>
          <input v-model="form.date" type="date"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300">
        </div>

        <!-- 付款人 -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">付款人</label>
          <div class="flex gap-2">
            <button v-for="p in payerOptions" :key="p"
              @click="form.payerName = p"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              :style="form.payerName === p
                ? `background:${payerColor(p)};color:white;border-color:${payerColor(p)}`
                : 'border-color:#e5e7eb;color:#6b7280'">
              {{ p }}
            </button>
          </div>
        </div>

        <!-- 類型 -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">類型</label>
          <div class="flex gap-2 flex-wrap">
            <button v-for="t in typeOptions" :key="t.value"
              @click="form.type = t.value"
              class="px-3 py-1.5 rounded-lg text-xs border transition-colors"
              :class="form.type === t.value ? 'text-white' : 'text-gray-500 border-gray-200'"
              :style="form.type === t.value ? 'background:#1e2533;border-color:#1e2533' : ''">
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- 金額 -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">金額（元）</label>
          <input v-model.number="form.amount" type="number" min="0" step="1" placeholder="0"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300">
        </div>

        <!-- 用途說明 -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">用途說明</label>
          <input v-model="form.description" type="text" placeholder="簡短說明"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300">
        </div>

        <!-- 支出分類（type=expense 才顯示） -->
        <div v-if="form.type === 'expense'">
          <label class="text-xs text-gray-500 mb-1 block">支出分類</label>
          <select v-model="categorySelect"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 mb-2">
            <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
          <input v-if="categorySelect === '其他'" v-model="form.category"
            type="text" placeholder="輸入自訂分類"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300">
        </div>

        <!-- 關聯案件 -->
        <div style="position:relative">
          <label class="text-xs text-gray-500 mb-1 block">關聯案件（選填）</label>
          <input v-model="caseSearchText" type="text" placeholder="搜尋案件名稱，或選下方固定選項"
            @focus="showCaseDropdown = true"
            @blur="setTimeout(() => showCaseDropdown = false, 150)"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300">
          <div v-if="showCaseDropdown"
            class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            <div @mousedown.prevent="selectFixedOption('naiship', '奈拾設計')"
              class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer border-b border-gray-50">奈拾設計</div>
            <div @mousedown.prevent="selectFixedOption('boyan', '柏延')"
              class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer border-b border-gray-50">柏延</div>
            <div v-for="c in filteredCaseOptions" :key="c.id"
              @mousedown.prevent="selectCase(c.id, c.name)"
              class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">{{ c.name }}</div>
            <div v-if="!filteredCaseOptions.length" class="px-3 py-2 text-xs text-gray-400">沒有符合的案件</div>
            <div @mousedown.prevent="selectFixedOption('manual', '手動輸入')"
              class="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer border-t border-gray-100 text-gray-500">手動輸入</div>
          </div>
          <input v-if="caseSelect === 'manual'" v-model="form.linkedCaseName"
            type="text" placeholder="輸入案件名稱"
            class="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300">
        </div>

        <!-- 憑證類型 -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">憑證類型</label>
          <div class="flex gap-2">
            <button v-for="r in RECEIPT_OPTIONS" :key="r.value"
              @click="form.receiptType = r.value"
              class="px-3 py-1.5 rounded-lg text-xs border transition-colors"
              :class="form.receiptType === r.value ? 'text-white' : 'text-gray-500 border-gray-200'"
              :style="form.receiptType === r.value ? 'background:#1e2533;border-color:#1e2533' : ''">
              {{ r.label }}
            </button>
          </div>
        </div>

        <!-- 上傳圖片 -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">上傳圖片（最多 6 張）</label>
          <div class="flex gap-2 flex-wrap">
            <div v-for="(url, i) in form.receiptImages" :key="url" class="relative">
              <img :src="url" class="w-16 h-16 rounded-lg object-cover">
              <button @click="form.receiptImages.splice(i, 1)"
                class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center leading-none">✕</button>
            </div>
            <label v-if="form.receiptImages.length < 6"
              class="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-gray-400 text-gray-400 text-2xl">
              +
              <input type="file" accept="image/*" class="hidden" @change="uploadImage">
            </label>
          </div>
          <div v-if="uploading" class="text-xs text-gray-400 mt-1">上傳中...</div>
        </div>

        <!-- 點工單欄位 -->
        <div v-if="form.receiptType === 'workorder'"
          class="border border-amber-100 rounded-xl p-4 bg-amber-50 space-y-3">
          <div class="text-xs font-semibold text-amber-700">點工單資訊</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">工人姓名</label>
              <input v-model="form.workerName" type="text"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none bg-white">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">聯繫電話</label>
              <input v-model="form.workerPhone" type="tel"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none bg-white">
            </div>
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.isTaxable" type="checkbox" class="rounded">
            <span class="text-xs text-gray-600">可報稅</span>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">單位主管</label>
              <input v-model="form.supervisorName" type="text"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none bg-white">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">監工人員</label>
              <input v-model="form.inspectorName" type="text"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none bg-white">
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
        <button @click="$emit('close')" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="save" :disabled="saving"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-50"
          style="background:#1e2533">
          {{ saving ? '儲存中...' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePettyCashStore } from '@/stores/pettyCash'
import { useCasesStore } from '@/stores/cases'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'

const props = defineProps({ entry: Object })
const emit = defineEmits(['close'])

const auth = useAuthStore()
const store = usePettyCashStore()
const casesStore = useCasesStore()
const { toast } = useToast()

const isEdit = computed(() => !!props.entry)
const saving = ref(false)
const uploading = ref(false)

const CATEGORIES = ['材料費', '工資／點工', '交通費', '停車費', '工具／五金', '餐飲費', '清潔／廢棄物', '影印／文具', '雜費', '其他']
const RECEIPT_OPTIONS = [
    { value: 'none', label: '無憑證' },
    { value: 'invoice', label: '發票' },
    { value: 'workorder', label: '點工單' },
]

const today = new Date().toISOString().slice(0, 10)

const form = ref({
    date: today,
    payerName: auth.isAdmin ? '柏' : (auth.name || ''),
    type: 'expense',
    amount: 0,
    description: '',
    category: '材料費',
    linkedCase: 'naiship',
    linkedCaseName: '奈拾設計',
    receiptType: 'none',
    receiptImages: [],
    workerName: '',
    workerPhone: '',
    isTaxable: false,
    supervisorName: '',
    inspectorName: '',
})

const categorySelect = ref('材料費')
const caseSelect = ref('naiship')
const caseSearchText = ref('奈拾設計')
const ACTIVE_CASE_STATUSES = ['drafting', 'construction', 'pending_settlement', 'aftercare']
const activeCaseOptions = computed(() => casesStore.cases.filter(c => ACTIVE_CASE_STATUSES.includes(c.status)))

const showCaseDropdown = ref(false)

const filteredCaseOptions = computed(() => {
    const q = caseSearchText.value.trim()
    if (!q) return activeCaseOptions.value
    return activeCaseOptions.value.filter(c => c.name.includes(q))
})

function selectCase(id, name) {
    caseSelect.value = id
    caseSearchText.value = name
    showCaseDropdown.value = false
}

function selectFixedOption(value, label) {
    caseSelect.value = value
    caseSearchText.value = label
    showCaseDropdown.value = false
}

watch(() => props.entry, (e) => {
    if (!e) return
    const copy = { ...e, receiptImages: Array.isArray(e.receiptImages) ? [...e.receiptImages] : [] }
    form.value = { ...form.value, ...copy }
    categorySelect.value = CATEGORIES.includes(e.category) ? e.category : '其他'
    if (e.linkedCase === 'naiship') {
        caseSelect.value = 'naiship'
        caseSearchText.value = '奈拾設計'
    } else if (e.linkedCase === 'boyan') {
        caseSelect.value = 'boyan'
        caseSearchText.value = '柏延'
    } else if (e.linkedCase) {
        const found = casesStore.cases.find(c => c.id === e.linkedCase)
        caseSelect.value = found ? e.linkedCase : 'manual'
        caseSearchText.value = found ? found.name : '手動輸入'
    }
}, { immediate: true })

watch(categorySelect, v => {
    if (v !== '其他') form.value.category = v
})

watch(caseSelect, v => {
    if (v === 'naiship') {
        form.value.linkedCase = 'naiship'; form.value.linkedCaseName = '奈拾設計'
    } else if (v === 'boyan') {
        form.value.linkedCase = 'boyan'; form.value.linkedCaseName = '柏延'
    } else if (v === 'manual') {
        form.value.linkedCase = ''
    } else {
        const c = casesStore.cases.find(x => x.id === v)
        if (c) { form.value.linkedCase = c.id; form.value.linkedCaseName = c.name }
    }
})

const payerOptions = computed(() => auth.isAdmin ? ['柏', '蚌', '賴賴'] : [auth.name])

const typeOptions = computed(() => {
    if (auth.isAdmin) return [
        { value: 'expense', label: '支出' },
        { value: 'topup', label: '補款' },
        { value: 'distribute', label: '發放' },
        { value: 'return', label: '歸還' },
    ]
    return [{ value: 'expense', label: '支出' }]
})

async function uploadImage(e) {
    const file = e.target.files[0]
    if (!file) return
    const err = validateUploadFile(file)
    if (err) { toast(err, 'error'); return }
    uploading.value = true
    try {
        const url = await uploadPhoto(file, 'petty-cash')
        form.value.receiptImages.push(url)
    } catch {
        toast('圖片上傳失敗', 'error')
    } finally {
        uploading.value = false
        e.target.value = ''
    }
}

async function save() {
    if (!form.value.payerName) { toast('請選擇付款人', 'error'); return }
    if (!form.value.amount || form.value.amount <= 0) { toast('請輸入金額', 'error'); return }
    if (!form.value.description.trim()) { toast('請填寫用途說明', 'error'); return }
    saving.value = true
    try {
        if (isEdit.value) {
            await store.updateEntry(props.entry.id, { ...form.value })
        } else {
            await store.addEntry({ ...form.value })
        }
        toast(isEdit.value ? '已更新' : '已新增')
        emit('close')
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        saving.value = false
    }
}

function payerColor(name) {
    return { '柏': '#c9a96e', '蚌': '#ef4444', '賴賴': '#a855f7' }[name] ?? '#6b7280'
}
</script>
