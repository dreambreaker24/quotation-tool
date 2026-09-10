<template>
  <div v-if="offline" data-test="storage-offline"
    class="fixed top-14 inset-x-0 z-40 bg-amber-500 text-white text-sm text-center py-1.5 px-4 shadow">
    ⚠️ 檔案伺服器目前連線異常，照片可能無法顯示或上傳，其他功能不受影響
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const offline = ref(false)
const backend = import.meta.env.VITE_STORAGE_BACKEND
const base = import.meta.env.VITE_NAS_BASE_URL
let failCount = 0
let timer = null

async function check() {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 5000)
    const res = await fetch(`${base}/health`, { signal: ctl.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error('bad status')
    failCount = 0
    offline.value = false
  } catch {
    failCount += 1
    if (failCount >= 2) offline.value = true
  }
}

onMounted(() => {
  if (backend !== 'nas' || !base) return
  check()
  timer = setInterval(check, 60000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
