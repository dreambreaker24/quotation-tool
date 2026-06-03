<template>
  <div class="px-4 py-4 border-t border-gray-100 bg-gray-50">
    <div class="text-xs text-gray-500 font-medium mb-3">{{ caseName }} — 上傳照片</div>

    <div class="flex flex-col divide-y divide-gray-100">
      <div v-for="type in photoTypes" :key="type.key" class="py-2">
        <!-- Category header -->
        <div class="flex items-center gap-2 cursor-pointer select-none"
          @click="toggle(type.key)"
          @dragover.prevent="hovering = type.key"
          @dragleave="hovering = ''"
          @drop.prevent="handleDrop($event, type.key)">
          <span class="text-[10px] text-gray-300 w-3 leading-none">{{ expanded[type.key] ? '▼' : '▶' }}</span>
          <span class="text-xs font-medium text-gray-600">{{ type.label }}</span>
          <span v-if="photos[type.key]?.length"
            class="text-[9px] min-w-[16px] h-4 px-1 rounded-full bg-gray-400 text-white leading-4 text-center">
            {{ photos[type.key].length }}
          </span>
          <button @click.stop="triggerUpload(type.key)"
            class="ml-auto text-[10px] border border-dashed rounded px-2 py-0.5 transition-colors"
            :style="hovering === type.key ? 'border-color:#c9a96e;color:#c9a96e' : 'border-color:#d1d5db;color:#9ca3af'">
            + 上傳
          </button>
        </div>

        <!-- Photo strip -->
        <div v-if="expanded[type.key]" class="mt-2 ml-5">
          <div v-if="!photos[type.key]?.length" class="text-[10px] text-gray-300 py-1">尚無檔案</div>
          <div v-else class="flex gap-2 overflow-x-auto pb-1">
            <div v-for="item in photos[type.key]" :key="item.url"
              class="flex-shrink-0 flex flex-col items-center gap-0.5 relative group">
              <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                class="w-16 h-16 rounded bg-red-100 flex items-center justify-center text-[10px] text-red-600 font-bold hover:bg-red-200 transition-colors">PDF</a>
              <img v-else :src="item.url"
                class="w-16 h-16 rounded object-cover cursor-pointer hover:opacity-80"
                @click="previewUrl = item.url">
              <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }}</span>
              <button @click="deletePhoto(type.key, item)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10">✕</button>
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

    <div v-if="previewUrl" @click="previewUrl = null"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
      <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted } from 'vue'
import { uploadPhoto } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const props = defineProps({ caseId: String, caseName: String })
const authStore = useAuthStore()
const notifStore = useNotificationsStore()

const photoTypes = [
    { key: 'survey',       label: '場勘' },
    { key: 'contract',     label: '合約' },
    { key: '3d',           label: '3D 模擬' },
    { key: 'floorplan',    label: '平面圖' },
    { key: 'blueprint',    label: '施工圖' },
    { key: 'construction', label: '施工' },
    { key: 'completion',   label: '完工' },
    { key: 'commercial',   label: '商業攝影' },
]

const allKeys = photoTypes.map(t => t.key)
const photos   = reactive(Object.fromEntries(allKeys.map(k => [k, []])))
const expanded = reactive(Object.fromEntries(allKeys.map(k => [k, false])))
const fileInput  = ref(null)
const activeType = ref('')
const previewUrl = ref(null)
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

onMounted(async () => {
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
    notifStore.notifyAll(authStore.name ?? '', `在「${props.caseName}」上傳了照片`, props.caseId, props.caseName)
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
