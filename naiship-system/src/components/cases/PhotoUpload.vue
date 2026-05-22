<template>
  <div class="px-4 py-4 border-t border-gray-100 bg-gray-50">
    <div class="text-xs text-gray-500 font-medium mb-3">{{ caseName }} — 上傳照片</div>
    <div class="flex flex-wrap gap-3">
      <div v-for="type in photoTypes" :key="type.key" class="flex flex-col items-center gap-1.5">
        <button @click="triggerUpload(type.key)"
          class="text-xs border border-dashed border-gray-300 rounded-lg px-3 py-2 text-gray-400 w-28 text-center transition-colors hover:border-gray-400 relative"
          :style="hovering === type.key ? 'border-color:#c9a96e;color:#c9a96e' : ''"
          @mouseenter="hovering = type.key" @mouseleave="hovering = ''">
          ＋ {{ type.label }}
          <span v-if="photos[type.key]?.length"
            class="absolute -top-1.5 -right-1.5 text-[9px] min-w-[16px] h-4 px-1 rounded-full bg-gray-500 text-white leading-4 text-center">
            {{ photos[type.key].length }}
          </span>
        </button>
        <div class="flex gap-1 flex-wrap max-w-[112px]">
          <template v-for="item in photos[type.key]" :key="item.url">
            <a v-if="item.isPdf" :href="item.url" target="_blank"
              class="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold hover:bg-red-200 transition-colors"
              title="開啟 PDF">PDF</a>
            <img v-else :src="item.url"
              class="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80"
              @click="previewUrl = item.url">
          </template>
        </div>
      </div>
    </div>
    <input ref="fileInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleFiles">
    <div v-if="previewUrl" @click="previewUrl = null"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
      <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted } from 'vue'
import { uploadPhoto } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ caseId: String, caseName: String })
const authStore = useAuthStore()

const photoTypes = [
    { key: 'survey', label: '場勘' },
    { key: '3d', label: '3D 模擬' },
    { key: 'floorplan', label: '平面圖' },
    { key: 'blueprint', label: '施工圖' },
    { key: 'vendor_quote', label: '廠商報價單' },
    { key: 'construction', label: '施工' },
    { key: 'completion', label: '完工' },
    { key: 'commercial', label: '商業攝影' },
]

const allKeys = photoTypes.map(t => t.key)
const photos = reactive(Object.fromEntries(allKeys.map(k => [k, []])))
const fileInput = ref(null)
const activeType = ref('')
const previewUrl = ref(null)
const hovering = ref('')

onMounted(async () => {
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url } = d.data()
        if (photos[type]) {
            photos[type].push({ url, isPdf: url.toLowerCase().endsWith('.pdf') })
        }
    })
})

function triggerUpload(type) {
    activeType.value = type
    fileInput.value.click()
}

async function handleFiles(e) {
    for (const file of e.target.files) {
        const url = await uploadPhoto(file, activeType.value)
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        photos[activeType.value].push({ url, isPdf })
        if (props.caseId) {
            await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: activeType.value, url,
                uploadedBy: authStore.user?.uid ?? 'unknown',
                createdAt: serverTimestamp()
            })
        }
    }
    e.target.value = ''
}
</script>
