<template>
  <div class="px-4 py-4 border-t border-gray-100 bg-gray-50">
    <div class="text-xs text-gray-500 font-medium mb-3">{{ caseName }} — 上傳照片</div>
    <div class="flex flex-wrap gap-3">
      <div v-for="type in photoTypes" :key="type.key" class="flex flex-col items-center gap-1.5">
        <button @click="triggerUpload(type.key)"
          class="text-xs border border-dashed border-gray-300 rounded-lg px-3 py-2 text-gray-400 w-24 text-center transition-colors hover:border-gray-400"
          :style="hovering === type.key ? 'border-color:#c9a96e;color:#c9a96e' : ''">
          ＋ {{ type.label }}
        </button>
        <div class="flex gap-1 flex-wrap max-w-[96px]">
          <img v-for="url in photos[type.key]" :key="url"
            :src="url" class="w-8 h-8 rounded object-cover cursor-pointer"
            @click="previewUrl = url">
        </div>
      </div>
    </div>
    <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="handleFiles">
    <div v-if="previewUrl" @click="previewUrl = null"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
      <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
    </div>
  </div>
</template>
<script setup>
import { ref, reactive } from 'vue'
import { uploadPhoto } from '@/composables/useStorage'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ caseId: String, caseName: String })
const authStore = useAuthStore()

const photoTypes = [
  { key: 'survey', label: '場勘' },
  { key: '3d', label: '3D 模擬' },
  { key: 'construction', label: '施工' },
  { key: 'completion', label: '完工' },
  { key: 'commercial', label: '商業攝影' }
]

const photos = reactive({ survey: [], '3d': [], construction: [], completion: [], commercial: [] })
const fileInput = ref(null)
const activeType = ref('')
const previewUrl = ref(null)
const hovering = ref('')

function triggerUpload(type) { activeType.value = type; fileInput.value.click() }

async function handleFiles(e) {
  for (const file of e.target.files) {
    const url = await uploadPhoto(file, activeType.value)
    photos[activeType.value].push(url)
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
