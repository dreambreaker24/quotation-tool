<template>
  <div class="border-t border-gray-200 bg-white">
    <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
      <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
      <span class="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500">案件檢討</span>
      <button @click="openAdd"
        class="ml-auto text-[11px] text-red-500 hover:text-red-700">+ 新增檢討</button>
    </div>

    <div class="px-5 py-4 flex flex-col gap-3">
      <div v-if="reviews.length === 0" class="text-[11px] text-gray-300 text-center py-3">尚無檢討紀錄</div>

      <div v-for="r in reviews" :key="r.id"
        class="border rounded-xl overflow-hidden border-l-4"
        :class="r.resolved ? 'border-green-100' : 'border-red-100'"
        :style="r.resolved ? 'border-left-color:#22c55e' : 'border-left-color:#ef4444'">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2.5"
          :class="r.resolved ? 'bg-green-50' : 'bg-red-50'">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-semibold text-gray-700">📋 {{ r.reportDate }}</span>
            <span v-if="r.resolved"
              class="text-[10px] px-2.5 py-0.5 rounded-full bg-green-500 text-white font-semibold">
              ✓ 已解決 {{ r.resolvedDate }}
            </span>
            <span v-else class="text-[10px] px-2.5 py-0.5 rounded-full bg-red-500 text-white font-bold animate-pulse">
              ● 待處理
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="authStore.isManager && !r.resolved" @click="markResolved(r)"
              class="text-[10px] text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-0.5">
              ✓ 標記已解決
            </button>
            <button @click="openEdit(r)" class="text-[10px] text-gray-400 hover:text-gray-600">編輯</button>
            <button v-if="authStore.isManager" @click="deleteReview(r)"
              class="text-[10px] text-red-400 hover:text-red-600">刪除</button>
          </div>
        </div>

        <!-- Content body -->
        <div class="px-4 py-3">
        <!-- Issues -->
        <div v-if="r.issues?.length" class="mb-3">
          <div class="text-[10px] text-red-500 font-semibold mb-2 uppercase tracking-wide pl-1 border-l-2 border-red-300">缺失列舉</div>
          <ol class="flex flex-col gap-1.5">
            <li v-for="(issue, i) in r.issues" :key="i"
              class="text-xs text-gray-700 flex gap-2.5 whitespace-pre-wrap items-start bg-red-50/50 rounded-lg px-3 py-2">
              <span class="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{{ i + 1 }}</span>
              <span>{{ issue }}</span>
            </li>
          </ol>
        </div>

        <!-- Improvements -->
        <div v-if="r.improvements">
          <div class="text-[10px] text-green-600 font-semibold mb-2 uppercase tracking-wide pl-1 border-l-2 border-green-400">改善措施</div>
          <p class="text-xs text-gray-700 whitespace-pre-wrap bg-green-50/60 rounded-lg px-3 py-2">{{ r.improvements }}</p>
        </div>

        <!-- Attachments -->
        <div v-if="r.attachments?.length" class="mt-2">
          <div class="text-[10px] text-gray-400 font-semibold mb-1.5 uppercase tracking-wide">附件</div>
          <div class="flex gap-2 flex-wrap">
            <a v-for="att in r.attachments" :key="att.url"
              :href="att.isPdf ? (att.pdfUrl ?? att.url) : undefined" :target="att.isPdf ? '_blank' : undefined">
              <div v-if="att.isPdf" class="w-12 h-12 rounded bg-red-100 flex items-center justify-center text-[10px] text-red-600 font-bold hover:bg-red-200">PDF</div>
              <img v-else :src="att.url" @click.prevent="previewUrl = att.url" class="w-12 h-12 rounded object-cover cursor-pointer hover:opacity-80">
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
          {{ r.creatorName }} · {{ formatTime(r.createdAt) }}
        </div>
        </div><!-- end content body -->
      </div>
    </div>
  </div>

  <!-- 新增檢討 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ editingId ? '編輯案件檢討' : '新增案件檢討' }}</h3>
        <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <div class="flex flex-col gap-4">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">報告時間 *</label>
          <input :value="form.reportDate" type="date"
            @input="form.reportDate = $event.target.value"
            @change="form.reportDate = $event.target.value"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500">缺失列舉</label>
            <button @click="form.issues.push('')" class="text-[11px]" style="color:#c9a96e">+ 新增缺失</button>
          </div>
          <div class="flex flex-col gap-2">
            <div v-if="form.issues.length === 0" class="text-[11px] text-gray-300 py-1">點右上新增缺失項目</div>
            <div v-for="(_, idx) in form.issues" :key="idx" class="flex items-start gap-2">
              <span class="text-red-400 font-semibold text-sm mt-2 flex-shrink-0">{{ idx + 1 }}.</span>
              <textarea v-model="form.issues[idx]" rows="2"
                class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
                :placeholder="`缺失 ${idx + 1}`"></textarea>
              <button @click="form.issues.splice(idx, 1)"
                class="text-red-400 hover:text-red-600 mt-2 text-xs">✕</button>
            </div>
          </div>
        </div>

        <div>
          <label class="text-xs text-gray-500 mb-1 block">改善措施（選填）</label>
          <textarea v-model="form.improvements" rows="3"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="針對上述缺失的改善方向或行動…"></textarea>
        </div>

        <!-- 附件 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500">附件</label>
            <button @click="attachInput.click()" class="text-[11px]" style="color:#c9a96e">+ 新增檔案</button>
          </div>
          <!-- 已儲存的附件（編輯模式） -->
          <div v-if="existingAttachments.length" class="flex gap-2 flex-wrap mb-2">
            <a v-for="att in existingAttachments" :key="att.url"
              :href="att.isPdf ? (att.pdfUrl ?? att.url) : undefined" :target="att.isPdf ? '_blank' : undefined">
              <div v-if="att.isPdf" class="w-12 h-12 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
              <img v-else :src="att.url" @click.prevent="previewUrl = att.url" class="w-12 h-12 rounded object-cover cursor-pointer hover:opacity-80">
            </a>
          </div>
          <div v-if="pendingFiles.length" class="flex gap-2 flex-wrap">
            <div v-for="(f, i) in pendingFiles" :key="i" class="relative">
              <img v-if="f.preview" :src="f.preview" class="w-12 h-12 rounded object-cover">
              <div v-else class="w-12 h-12 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
              <button @click="removePending(i)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-5">
        <button @click="showForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitReview" :disabled="saving"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ saving ? '儲存中…' : '儲存' }}
        </button>
      </div>
    </div>
  </div>

  <input ref="attachInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleAttachFiles">
  <div v-if="previewUrl" @click="previewUrl = null" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { collection, addDoc, getDocs, deleteDoc, updateDoc, orderBy, query, serverTimestamp, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { useToast } from '@/composables/useToast'

const props = defineProps({ caseId: String, caseName: String, companyId: { type: String, default: '' } })
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const reviews = ref([])
const showForm = ref(false)
const saving = ref(false)
const editingId = ref(null)
const form = ref({ reportDate: today(), issues: [], improvements: '' })
const pendingFiles = ref([])
const existingAttachments = ref([])
const attachInput = ref(null)
const previewUrl = ref(null)

function today() {
    return new Date().toISOString().slice(0, 10)
}

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(async () => {
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'reviews'), orderBy('reportDate', 'desc'))
    const snap = await getDocs(q)
    reviews.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
})

function openAdd() {
    editingId.value = null
    form.value = { reportDate: today(), issues: [], improvements: '' }
    pendingFiles.value = []
    existingAttachments.value = []
    showForm.value = true
}

function openEdit(r) {
    editingId.value = r.id
    form.value = {
        reportDate: r.reportDate,
        issues: [...(r.issues ?? [])],
        improvements: r.improvements ?? '',
    }
    pendingFiles.value = []
    existingAttachments.value = [...(r.attachments ?? [])]
    showForm.value = true
}

function handleAttachFiles(e) {
    Array.from(e.target.files).forEach(file => {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); return }
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        pendingFiles.value.push({ file, preview: isPdf ? null : URL.createObjectURL(file) })
    })
    e.target.value = ''
}

function removePending(i) { pendingFiles.value.splice(i, 1) }

async function submitReview() {
    if (!form.value.reportDate || saving.value) return
    saving.value = true
    try {
        const newAttachments = []
        for (const pf of pendingFiles.value) {
            try {
                const url = await uploadPhoto(pf.file, 'review')
                const isPdf = pf.file.name.toLowerCase().endsWith('.pdf')
                const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
                newAttachments.push({ url, isPdf, pdfUrl })
            } catch { /* skip failed */ }
        }
        const allAttachments = [...existingAttachments.value, ...newAttachments]

        if (editingId.value) {
            const updateData = {
                reportDate: form.value.reportDate,
                issues: form.value.issues.filter(s => s.trim()),
                improvements: form.value.improvements.trim(),
                attachments: allAttachments,
            }
            await updateDoc(doc(db, 'cases', props.caseId, 'reviews', editingId.value), updateData)
            const target = reviews.value.find(x => x.id === editingId.value)
            if (target) Object.assign(target, updateData)
        } else {
            const data = {
                reportDate: form.value.reportDate,
                issues: form.value.issues.filter(s => s.trim()),
                improvements: form.value.improvements.trim(),
                attachments: allAttachments,
                resolved: false,
                resolvedDate: '',
                creatorName: authStore.name ?? '—',
                createdBy: authStore.user?.uid ?? '',
                createdAt: serverTimestamp(),
            }
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'reviews'), data)
            reviews.value.unshift({ id: docRef.id, ...data, createdAt: { toDate: () => new Date() } })
        }
        if (!editingId.value) {
            notifStore.notifyAll(authStore.name ?? '', `在「${props.caseName}」新增了案件檢討`, props.caseId, props.caseName, props.companyId, '', 'review')
        }
        pendingFiles.value = []
        showForm.value = false
    } finally {
        saving.value = false
    }
}

async function markResolved(r) {
    const resolved = today()
    await updateDoc(doc(db, 'cases', props.caseId, 'reviews', r.id), { resolved: true, resolvedDate: resolved })
    const target = reviews.value.find(x => x.id === r.id)
    if (target) { target.resolved = true; target.resolvedDate = resolved }
}

async function deleteReview(r) {
    if (!confirm('確定要刪除此檢討紀錄？')) return
    await deleteDoc(doc(db, 'cases', props.caseId, 'reviews', r.id))
    reviews.value = reviews.value.filter(x => x.id !== r.id)
}
</script>
