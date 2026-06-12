<template>
  <div class="px-4 py-4 border-t border-gray-100 bg-gray-50">
    <div class="text-xs font-semibold text-gray-600 mb-3 pl-2 border-l-2" style="border-left-color:#c9a96e">{{ caseName }} — 檔案管理</div>

    <div class="flex flex-col gap-1">
      <div v-for="type in photoTypes" :key="type.key"
        class="rounded-xl overflow-hidden transition-colors"
        :class="hovering === type.key ? 'ring-1 ring-amber-300' : ''">
        <!-- Category header -->
        <div class="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-xl transition-colors"
          :class="expanded[type.key] ? 'bg-white shadow-sm' : (photos[type.key]?.length ? 'bg-white/60 hover:bg-white' : 'hover:bg-white/50')"
          @click="toggle(type.key)"
          @dragover.prevent="hovering = type.key"
          @dragleave="hovering = ''"
          @drop.prevent="handleDrop($event, type.key)">
          <span class="text-sm">{{ type.icon }}</span>
          <span class="text-xs font-medium text-gray-700">{{ type.label }}</span>
          <span v-if="photos[type.key]?.length"
            class="text-[9px] min-w-[18px] h-[18px] px-1 rounded-full text-white leading-[18px] text-center font-bold" style="background:#c9a96e">
            {{ photos[type.key].length }}
          </span>
          <span class="text-[10px] text-gray-300 ml-1">{{ expanded[type.key] ? '▼' : '▶' }}</span>
          <button @click.stop="triggerUpload(type.key)"
            class="ml-auto text-[10px] px-2.5 py-1 rounded-lg border transition-colors font-medium"
            :style="hovering === type.key ? 'border-color:#c9a96e;color:#c9a96e;background:rgba(201,169,110,0.08)' : 'border-color:#e5e7eb;color:#9ca3af'">
            + 上傳
          </button>
        </div>

        <!-- Photo strip -->
        <div v-if="expanded[type.key]" class="px-3 pb-3 pt-1 bg-white rounded-b-xl">
          <div v-if="!photos[type.key]?.length" class="text-[11px] text-gray-300 py-2 text-center">尚無檔案，拖曳或點擊上傳</div>
          <div v-else class="flex gap-2.5 overflow-x-auto pb-1">
            <div v-for="(item, idx) in photos[type.key]" :key="item.url"
              class="flex-shrink-0 flex flex-col items-center gap-1 relative group">
              <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                class="w-20 h-20 rounded-xl bg-red-100 flex items-center justify-center text-xs text-red-600 font-bold hover:bg-red-200 transition-colors shadow-sm">PDF</a>
              <img v-else :src="item.url"
                class="w-20 h-20 rounded-xl object-cover cursor-pointer hover:opacity-90 shadow-sm transition-all hover:shadow-md"
                @click="openPreview(type.key, idx)">
              <span class="text-[9px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }}</span>
              <button @click="deletePhoto(type.key, item)"
                class="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 text-white rounded-full text-[9px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10 shadow">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleFiles">

    <div v-if="uploadError" class="mt-2 text-xs text-red-500 flex items-center gap-1">
      <span>{{ uploadError }}</span>
      <button @click="uploadError = ''" class="ml-1 text-red-400 hover:text-red-600 leading-none">✕</button>
    </div>

    <div v-if="previewUrl" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      @click.self="previewUrl = null">
      <button v-if="previewIndex > 0" @click="navigatePhoto(-1)"
        class="absolute left-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">‹</button>
      <img :src="previewUrl" class="max-h-[80vh] max-w-[80vw] rounded-xl cursor-default">
      <button v-if="previewIndex < (photos[previewType]?.length ?? 0) - 1" @click="navigatePhoto(1)"
        class="absolute right-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">›</button>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const props = defineProps({ caseId: String, caseName: String, companyId: { type: String, default: '' } })
const authStore = useAuthStore()
const notifStore = useNotificationsStore()

const photoTypes = [
    { key: 'survey',       label: '場勘',    icon: '📷' },
    { key: 'contract',     label: '合約',    icon: '📄' },
    { key: '3d',           label: '3D 模擬', icon: '🎨' },
    { key: 'floorplan',    label: '平面圖',  icon: '📐' },
    { key: 'blueprint',    label: '施工圖',  icon: '📋' },
    { key: 'construction', label: '施工',    icon: '🏗️' },
    { key: 'completion',   label: '完工',    icon: '✅' },
    { key: 'commercial',   label: '商業攝影', icon: '🌟' },
]

const allKeys = photoTypes.map(t => t.key)
const photos   = reactive(Object.fromEntries(allKeys.map(k => [k, []])))
const expanded = reactive(Object.fromEntries(allKeys.map(k => [k, false])))
const fileInput  = ref(null)
const activeType = ref('')
const previewUrl = ref(null)
const previewType = ref('')
const previewIndex = ref(-1)
const hovering   = ref('')
const uploadError = ref('')

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toggle(key) {
    expanded[key] = !expanded[key]
}

function openPreview(type, idx) {
    previewType.value = type
    previewIndex.value = idx
    previewUrl.value = photos[type][idx].url
}

function navigatePhoto(dir) {
    const list = photos[previewType.value] || []
    const next = previewIndex.value + dir
    if (next >= 0 && next < list.length) {
        previewIndex.value = next
        previewUrl.value = list[next].url
    }
}

function handleKeydown(e) {
    if (!previewUrl.value) return
    if (e.key === 'Escape') { previewUrl.value = null; return }
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        navigatePhoto(1)
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigatePhoto(-1)
    }
}

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
})

onMounted(async () => {
    window.addEventListener('keydown', handleKeydown)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, createdAt } = d.data()
        if (photos[type] !== undefined) {
            const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
            const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            photos[type].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, createdAt })
            expanded[type] = true
        }
    })
})

function triggerUpload(type) {
    activeType.value = type
    fileInput.value.click()
}

async function uploadFiles(files, type) {
    uploadError.value = ''
    for (const file of files) {
        const err = validateUploadFile(file)
        if (err) { uploadError.value = err; continue }
        try {
            const url = await uploadPhoto(file, type)
            const isPdf = file.name.toLowerCase().endsWith('.pdf')
            const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            if (props.caseId) {
                const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                    type, url, isPdf,
                    uploadedBy: authStore.user?.uid ?? 'unknown',
                    createdAt: serverTimestamp()
                })
                photos[type].push({ id: docRef.id, url, isPdf, pdfUrl, createdAt: { toDate: () => new Date() } })
            } else {
                photos[type].push({ id: null, url, isPdf, pdfUrl, createdAt: { toDate: () => new Date() } })
            }
            expanded[type] = true
        } catch (err) {
            uploadError.value = `「${file.name}」上傳失敗：${err.message}`
        }
    }
}

async function handleFiles(e) {
    await uploadFiles(Array.from(e.target.files), activeType.value)
    notifStore.notifyAll(authStore.name ?? '', `在「${props.caseName}」上傳了照片`, props.caseId, props.caseName, props.companyId)
    e.target.value = ''
}

async function handleDrop(e, type) {
    hovering.value = ''
    await uploadFiles(Array.from(e.dataTransfer.files), type)
}

async function deletePhoto(type, item) {
    if (item.id && props.caseId) {
        await deleteDoc(doc(db, 'cases', props.caseId, 'photos', item.id))
    }
    photos[type] = photos[type].filter(p => p !== item)
}
</script>
