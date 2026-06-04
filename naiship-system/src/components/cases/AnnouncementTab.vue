<template>
  <div class="flex flex-col gap-4">
    <!-- 主管：新增按鈕 -->
    <div v-if="authStore.isManager" class="flex justify-end">
      <button @click="openAdd"
        class="text-sm text-white px-4 py-2 rounded-xl" style="background:#1e2533">
        + 新增公告
      </button>
    </div>

    <!-- 空白狀態 -->
    <div v-if="announcements.length === 0" class="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400 text-sm">
      目前尚無公司佈達
    </div>

    <!-- 置頂最新公告 -->
    <div v-if="announcements.length > 0" class="bg-white rounded-2xl shadow-sm p-6">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="flex-1 min-w-0">
          <span v-if="latest.pinned" class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold mr-2">📌 置頂</span>
          <span v-else class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold mr-2">最新公告</span>
          <span class="text-base font-bold text-gray-800">{{ latest.title }}</span>
        </div>
        <div v-if="authStore.isManager" class="flex gap-2 flex-shrink-0">
          <button @click="togglePin(latest)"
            class="text-xs border rounded-lg px-2 py-1 transition-colors"
            :class="latest.pinned ? 'text-blue-500 border-blue-200 hover:text-blue-700' : 'text-gray-400 border-gray-200 hover:text-blue-500'">
            📌
          </button>
          <button @click="openEdit(latest)" class="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1">編輯</button>
          <button @click="remove(latest)" class="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2 py-1">刪除</button>
        </div>
      </div>
      <p class="text-sm text-gray-700 whitespace-pre-wrap mb-4">{{ latest.content }}</p>
      <div v-if="latest.images?.length" class="flex gap-2 flex-wrap mb-4">
        <img v-for="url in latest.images" :key="url" :src="url"
          @click="previewUrl = url"
          class="w-24 h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity">
      </div>
      <div class="text-[11px] text-gray-400">{{ latest.createdByName }} · {{ formatDate(latest.createdAt) }}</div>
    </div>

    <!-- 舊公告清單 -->
    <div v-if="older.length > 0" class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500">舊公告</div>
      <div v-for="a in older" :key="a.id" class="border-b border-gray-50 last:border-0">
        <button @click="toggleExpand(a.id)"
          class="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 text-left transition-colors">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-gray-700 truncate">{{ a.title }}</div>
            <div class="text-[11px] text-gray-400 mt-0.5">{{ a.createdByName }} · {{ formatDate(a.createdAt) }}</div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0 ml-2">
            <div v-if="authStore.isManager" class="flex gap-1">
              <span @click.stop="togglePin(a)"
                class="text-[11px] border rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                :class="a.pinned ? 'text-blue-500 border-blue-200' : 'text-gray-400 border-gray-200 hover:text-blue-500'">📌</span>
              <span @click.stop="openEdit(a)" class="text-[11px] text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 cursor-pointer">編輯</span>
              <span @click.stop="remove(a)" class="text-[11px] text-red-400 hover:text-red-600 border border-red-100 rounded px-1.5 py-0.5 cursor-pointer">刪除</span>
            </div>
            <span class="text-gray-400 text-xs">{{ expanded.has(a.id) ? '▲' : '▼' }}</span>
          </div>
        </button>
        <div v-if="expanded.has(a.id)" class="px-5 pb-4">
          <p class="text-sm text-gray-700 whitespace-pre-wrap mb-3">{{ a.content }}</p>
          <div v-if="a.images?.length" class="flex gap-2 flex-wrap">
            <img v-for="url in a.images" :key="url" :src="url"
              @click="previewUrl = url"
              class="w-20 h-20 object-cover rounded-xl cursor-pointer hover:opacity-80">
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 新增/編輯 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-gray-800">{{ editingId ? '編輯公告' : '新增公告' }}</h3>
        <button @click="closeForm" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-4">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">標題 *</label>
          <input v-model="form.title" type="text"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
            placeholder="公告標題">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">內容 *</label>
          <textarea v-model="form.content" rows="5"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="公告內容..."></textarea>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500">圖片（選填）</label>
            <button @click="imgInput.click()" class="text-xs" style="color:#c9a96e">+ 新增圖片</button>
          </div>
          <div v-if="existingImages.length" class="flex gap-2 flex-wrap mb-2">
            <div v-for="(url, i) in existingImages" :key="url" class="relative">
              <img :src="url" class="w-16 h-16 object-cover rounded-xl">
              <button @click="existingImages.splice(i, 1)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] flex items-center justify-center">✕</button>
            </div>
          </div>
          <div v-if="pendingImages.length" class="flex gap-2 flex-wrap">
            <div v-for="(f, i) in pendingImages" :key="i" class="relative">
              <img :src="f.preview" class="w-16 h-16 object-cover rounded-xl">
              <button @click="pendingImages.splice(i, 1)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] flex items-center justify-center">✕</button>
            </div>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="closeForm" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitForm" :disabled="saving"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ saving ? '儲存中…' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
  <input ref="imgInput" type="file" accept="image/*" multiple class="hidden" @change="handleImages">

  <!-- 圖片預覽 -->
  <div v-if="previewUrl" @click="previewUrl = null"
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { collection, addDoc, getDocs, deleteDoc, updateDoc, orderBy, query, serverTimestamp, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { useToast } from '@/composables/useToast'

const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const announcements = ref([])
const expanded = ref(new Set())
const showForm = ref(false)
const editingId = ref(null)
const saving = ref(false)
const previewUrl = ref(null)
const imgInput = ref(null)
const form = ref({ title: '', content: '' })
const existingImages = ref([])
const pendingImages = ref([])

const sorted = computed(() => [
    ...announcements.value.filter(a => a.pinned),
    ...announcements.value.filter(a => !a.pinned),
])
const latest = computed(() => sorted.value[0] ?? null)
const older = computed(() => sorted.value.slice(1))

onMounted(async () => {
    localStorage.setItem('announcementLastRead', Date.now().toString())
    await load()
})

async function load() {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    announcements.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

function toggleExpand(id) {
    const s = new Set(expanded.value)
    s.has(id) ? s.delete(id) : s.add(id)
    expanded.value = s
}

function openAdd() {
    editingId.value = null
    form.value = { title: '', content: '' }
    existingImages.value = []
    pendingImages.value = []
    showForm.value = true
}

function openEdit(a) {
    editingId.value = a.id
    form.value = { title: a.title, content: a.content }
    existingImages.value = [...(a.images ?? [])]
    pendingImages.value = []
    showForm.value = true
}

function closeForm() { showForm.value = false }

function handleImages(e) {
    Array.from(e.target.files).forEach(file => {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); return }
        pendingImages.value.push({ file, preview: URL.createObjectURL(file) })
    })
    e.target.value = ''
}

async function submitForm() {
    if (!form.value.title.trim() || !form.value.content.trim() || saving.value) return
    saving.value = true
    try {
        const newUrls = []
        for (const p of pendingImages.value) {
            try { newUrls.push(await uploadPhoto(p.file, 'announcement')) } catch { /* skip */ }
        }
        const images = [...existingImages.value, ...newUrls]
        if (editingId.value) {
            await updateDoc(doc(db, 'announcements', editingId.value), {
                title: form.value.title.trim(),
                content: form.value.content.trim(),
                images,
                updatedAt: serverTimestamp(),
            })
            toast('公告已更新')
        } else {
            const title = form.value.title.trim()
            await addDoc(collection(db, 'announcements'), {
                title,
                content: form.value.content.trim(),
                images,
                createdBy: authStore.user?.uid ?? '',
                createdByName: authStore.name ?? '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            })
            toast('公告已發布')
            notifStore.notifyAll(authStore.name ?? '', `發布了公司佈達「${title}」`, '', '')
        }
        closeForm()
        await load()
    } finally {
        saving.value = false
    }
}

async function togglePin(a) {
    const newPinned = !a.pinned
    await updateDoc(doc(db, 'announcements', a.id), { pinned: newPinned })
    const target = announcements.value.find(x => x.id === a.id)
    if (target) target.pinned = newPinned
    toast(newPinned ? '已置頂' : '已取消置頂')
}

async function remove(a) {
    if (!confirm(`確定刪除「${a.title}」？`)) return
    await deleteDoc(doc(db, 'announcements', a.id))
    announcements.value = announcements.value.filter(x => x.id !== a.id)
    toast('公告已刪除')
}

function formatDate(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}
</script>
