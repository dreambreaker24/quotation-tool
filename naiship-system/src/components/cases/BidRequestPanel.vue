<template>
  <div class="border-t border-gray-200 bg-white px-5 py-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(201,169,110,0.15);color:#c9a96e">廠商比價</span>
      </div>
      <button @click="openCreateForm" class="text-xs px-3 py-1.5 rounded-lg text-white" style="background:#1e2533">+ 新增比價需求</button>
    </div>

    <div v-if="bidRequests.length === 0" class="text-xs text-gray-400 py-3 text-center">
      尚無比價需求，點擊右上新增
    </div>

    <div v-else class="flex flex-col gap-3">
      <div v-for="br in bidRequests" :key="br.id" class="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-gray-800">{{ br.category }}</span>
            <span v-if="br.status === 'converted'" class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">已確認</span>
            <span v-else class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">比價中</span>
          </div>
          <button v-if="br.status !== 'converted'" @click="confirmDeleteBidRequest(br.id)" class="text-[11px] text-red-400 hover:text-red-600">刪除</button>
        </div>
        <p v-if="br.note" class="text-[11px] text-gray-400 mb-2">{{ br.note }}</p>

        <div v-if="(br.bids || []).length === 0" class="text-[11px] text-gray-300 py-2">尚無廠商報價</div>
        <div v-else class="flex flex-col gap-1.5 mb-2">
          <div v-for="bid in br.bids" :key="bid.id"
            class="border rounded-lg p-2 bg-white flex items-center flex-wrap gap-2"
            :class="br.winningBidId === bid.id ? 'border-green-300' : 'border-gray-100'">
            <span class="text-xs font-medium text-gray-700 flex-shrink-0">{{ bid.vendorName || '（未填廠商）' }}</span>
            <span class="text-xs text-gray-600">${{ (bid.quoteAmount || 0).toLocaleString() }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              :class="bid.includesTax ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'">
              {{ bid.includesTax ? '含稅' : '未稅' }}
            </span>
            <span v-if="br.winningBidId === bid.id" class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium">贏家</span>
            <button v-if="br.status !== 'converted'" @click="triggerQuoteUpload(br.id, bid.id)"
              class="ml-auto text-[10px] border border-dashed border-gray-200 rounded px-2 py-0.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
              + 報價單
            </button>
            <div v-if="quotePhotos[bid.id]?.length" class="flex gap-1.5 w-full flex-wrap">
              <div v-for="item in quotePhotos[bid.id]" :key="item.id" class="relative group flex flex-col items-center gap-0.5">
                <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                  class="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-[8px] text-red-600 font-bold">PDF</a>
                <img v-else :src="item.url" class="w-8 h-8 rounded object-cover">
                <span class="text-[7px] text-gray-400 leading-tight whitespace-nowrap">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                <button v-if="br.status !== 'converted'" @click="deleteQuotePhoto(br.id, bid.id, item)"
                  class="absolute -top-1 -right-1 w-3 h-3 bg-gray-600 text-white rounded-full text-[7px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500">✕</button>
              </div>
            </div>
            <p v-if="bid.note" class="text-[10px] text-gray-400 w-full">{{ bid.note }}</p>
          </div>
        </div>

        <template v-if="br.status !== 'converted'">
          <button v-if="addingBidFor !== br.id" @click="openAddBid(br)"
            class="text-[11px] border border-dashed border-gray-200 rounded-lg py-1.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors w-full">
            + 新增廠商報價
          </button>

          <div v-else class="border border-gray-100 rounded-lg p-2.5 bg-white flex flex-col gap-2 mt-1.5">
            <input v-model="bidForm.vendorName" type="text" placeholder="廠商名稱（選填）"
              class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
            <div class="flex gap-2">
              <input v-model.number="bidForm.quoteAmount" type="number" min="0" placeholder="報價金額"
                class="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
              <label class="flex items-center gap-1 text-xs text-gray-600 flex-shrink-0">
                <input type="checkbox" v-model="bidForm.includesTax" class="rounded">含稅
              </label>
            </div>
            <input v-model="bidForm.note" type="text" placeholder="備註（選填）"
              class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
            <div class="flex justify-end gap-2">
              <button @click="addingBidFor = null" class="text-xs text-gray-400 px-3 py-1.5">取消</button>
              <button @click="submitBid(br)" :disabled="savingBid || !bidForm.quoteAmount"
                class="text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-60" style="background:#1e2533">
                {{ savingBid ? '儲存中…' : '新增報價' }}
              </button>
            </div>
          </div>

          <template v-if="(br.bids || []).length > 0">
            <div v-if="confirmingBidRequestId !== br.id" class="mt-1.5">
              <button v-if="authStore.isManager" @click="openConfirmWinner(br)"
                class="text-[11px] px-3 py-1.5 rounded-lg text-white w-full" style="background:#c9a96e">
                確認贏家
              </button>
            </div>
            <div v-else class="border border-amber-200 rounded-lg p-2.5 bg-amber-50/50 mt-1.5 flex flex-col gap-2">
              <label v-for="bid in br.bids" :key="bid.id" class="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="radio" :value="bid.id" v-model="selectedWinnerId" class="accent-amber-600">
                {{ bid.vendorName }} — ${{ (bid.quoteAmount || 0).toLocaleString() }}{{ bid.includesTax ? '（含稅）' : '（未稅）' }}
              </label>
              <div class="flex justify-end gap-2 mt-1">
                <button @click="confirmingBidRequestId = null" class="text-xs text-gray-400 px-3 py-1.5">取消</button>
                <button @click="confirmWinner(br)" :disabled="!selectedWinnerId || confirming"
                  class="text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-60" style="background:#1e2533">
                  {{ confirming ? '確認中…' : '確認並轉為正式工種' }}
                </button>
              </div>
            </div>
          </template>
        </template>
        <p v-else class="text-[11px] text-gray-400 mt-1.5">已轉為正式工種，請至「工程安排」查看</p>
      </div>
    </div>
  </div>

  <!-- 新增比價需求 Modal -->
  <div v-if="showCreateForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">新增比價需求</h3>
        <button @click="showCreateForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">比價項目 *</label>
          <input v-model="createForm.category" type="text"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
            placeholder="例如：沙發、清運拆除">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工種（選填）</label>
          <select v-model="createForm.workCategory" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 未分類 —</option>
            <option v-for="cat in WORK_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">說明（選填）</label>
          <input v-model="createForm.note" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：浴室防水兩間">
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showCreateForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitCreateForm" :disabled="savingCreate || !createForm.category.trim()"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ savingCreate ? '儲存中…' : '建立' }}
        </button>
      </div>
    </div>
  </div>

  <input ref="quoteFileInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleQuoteFiles">
</template>
<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { filterVendorsByCategory } from '@/utils/vendorSpecialty'
import { useBidRequestsStore, buildWinningWorkType } from '@/stores/bidRequests'
import { useVendorsStore } from '@/stores/vendors'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const props = defineProps({ caseId: String, caseName: String })
const bidRequestsStore = useBidRequestsStore()
const vendorsStore = useVendorsStore()
const casesStore = useCasesStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const { toast } = useToast()

const caseData = computed(() => casesStore.cases.find(c => c.id === props.caseId))
const workTypes = computed(() => caseData.value?.workTypes ?? [])
const bidRequests = computed(() => bidRequestsStore.bidRequests)

const showCreateForm = ref(false)
const savingCreate = ref(false)
const createForm = ref({ category: '', workCategory: '', note: '' })

function openCreateForm() {
    createForm.value = { category: '', workCategory: '', note: '' }
    showCreateForm.value = true
}

async function submitCreateForm() {
    if (!createForm.value.category.trim() || savingCreate.value) return
    savingCreate.value = true
    try {
        await bidRequestsStore.addBidRequest(props.caseId, createForm.value.category.trim(), createForm.value.workCategory, createForm.value.note, authStore.name ?? '')
        showCreateForm.value = false
    } catch {
        toast('建立失敗，請重試', 'error')
    } finally {
        savingCreate.value = false
    }
}

async function confirmDeleteBidRequest(id) {
    if (!confirm('確定刪除此比價需求？已上傳的報價單將一併刪除。')) return
    try {
        await bidRequestsStore.deleteBidRequest(props.caseId, id)
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}

const addingBidFor = ref(null)
const savingBid = ref(false)
const bidForm = ref({ vendorName: '', quoteAmount: 0, includesTax: false, note: '' })
const vendorSearch = ref('')
const showVendorDropdown = ref(false)

function openAddBid(br) {
    addingBidFor.value = br.id
    bidForm.value = { vendorName: '', quoteAmount: 0, includesTax: false, note: '' }
}

function filteredVendorList(category) {
    const vendors = vendorsStore.vendors.filter(v => !v.companyId || v.companyId === caseData.value?.companyId)
    const byCategory = filterVendorsByCategory(vendors, category, WORK_CATEGORIES)
    const kw = vendorSearch.value.trim()
    if (!kw) return byCategory
    return byCategory.filter(v => v.name.includes(kw))
}

function hideVendorDropdown() {
    setTimeout(() => { showVendorDropdown.value = false }, 150)
}

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function uploaderName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? '未知'
}

async function submitBid(br) {
    if (!bidForm.value.quoteAmount || savingBid.value) return
    savingBid.value = true
    try {
        await bidRequestsStore.addBid(props.caseId, br.id, {
            vendorName: bidForm.value.vendorName.trim(),
            quoteAmount: bidForm.value.quoteAmount || 0,
            includesTax: bidForm.value.includesTax || false,
            note: bidForm.value.note || '',
            submittedBy: authStore.user?.uid ?? '',
        })
        addingBidFor.value = null
    } catch {
        toast('新增報價失敗，請重試', 'error')
    } finally {
        savingBid.value = false
    }
}

const quotePhotos = reactive({})
const quoteFileInput = ref(null)
const activeBidRequestId = ref('')
const activeBidEntryId = ref('')

function triggerQuoteUpload(bidRequestId, bidEntryId) {
    activeBidRequestId.value = bidRequestId
    activeBidEntryId.value = bidEntryId
    quoteFileInput.value?.click()
}

async function handleQuoteFiles(e) {
    const files = Array.from(e.target.files)
    e.target.value = ''
    const bidRequestId = activeBidRequestId.value
    const bidEntryId = activeBidEntryId.value
    for (const file of files) {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); continue }
        try {
            const url = await uploadPhoto(file, 'bid_quote')
            const isPdf = file.name.toLowerCase().endsWith('.pdf')
            const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            const uploadedBy = authStore.user?.uid ?? 'unknown'
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'bid_quote', bidRequestId, bidEntryId,
                url, isPdf,
                uploadedBy,
                createdAt: serverTimestamp(),
            })
            await bidRequestsStore.appendQuotePhotoId(props.caseId, bidRequestId, bidEntryId, docRef.id)
            if (!quotePhotos[bidEntryId]) quotePhotos[bidEntryId] = []
            quotePhotos[bidEntryId].push({ id: docRef.id, url, isPdf, pdfUrl, createdAt: { toDate: () => new Date() }, uploadedBy })
        } catch {
            toast('上傳失敗，請重試', 'error')
        }
    }
}

async function deleteQuotePhoto(bidRequestId, bidEntryId, item) {
    await bidRequestsStore.removeQuotePhotoId(props.caseId, bidRequestId, bidEntryId, item.id)
    quotePhotos[bidEntryId] = (quotePhotos[bidEntryId] || []).filter(p => p !== item)
}

const confirmingBidRequestId = ref(null)
const selectedWinnerId = ref('')
const confirming = ref(false)

function openConfirmWinner(br) {
    confirmingBidRequestId.value = br.id
    selectedWinnerId.value = ''
}

async function confirmWinner(br) {
    if (!selectedWinnerId.value || confirming.value) return
    confirming.value = true
    try {
        const newWorkType = buildWinningWorkType(br, selectedWinnerId.value, workTypes.value.length)
        await casesStore.updateCase(props.caseId, { workTypes: [...workTypes.value, newWorkType] })
        await bidRequestsStore.markConverted(props.caseId, br.id, selectedWinnerId.value, newWorkType.id)
        const winner = br.bids.find(b => b.id === selectedWinnerId.value)
        await bidRequestsStore.repointQuotePhotos(props.caseId, winner?.quotePhotoIds, newWorkType.id)
        confirmingBidRequestId.value = null
        selectedWinnerId.value = ''
        toast(`已確認贏家，正式工種「${br.category}」已建立`)
    } catch {
        toast('確認失敗，請重試', 'error')
    } finally {
        confirming.value = false
    }
}

onMounted(async () => {
    bidRequestsStore.subscribe(props.caseId)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, bidEntryId, createdAt, uploadedBy } = d.data()
        if (type !== 'bid_quote' || !bidEntryId) return
        const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
        const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
        if (!quotePhotos[bidEntryId]) quotePhotos[bidEntryId] = []
        quotePhotos[bidEntryId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, createdAt, uploadedBy })
    })
})

onUnmounted(() => {
    bidRequestsStore.cleanup()
})
</script>
