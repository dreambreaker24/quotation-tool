<template>
  <div class="min-h-screen flex items-center justify-center" style="background:#1e2533">
    <div class="bg-white rounded-2xl shadow-xl p-10 w-80 text-center">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4" style="background:#c9a96e;color:#1e2533">奈</div>
      <h1 class="font-bold text-gray-800 text-lg mb-1">奈拾設計管理系統</h1>
      <p class="text-xs text-gray-400 mb-6">請使用公司 Google 帳號登入</p>

      <!-- WebView 警告 -->
      <template v-if="isWebView">
        <div class="text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mb-4 text-left leading-relaxed">
          ⚠️ 目前在 LINE 內開啟，無法直接登入。<br><br>
          請複製下方網址，貼到 <strong>Safari</strong> 或 <strong>Chrome</strong> 開啟：
        </div>
        <div class="flex items-center gap-2 mb-4">
          <div class="flex-1 text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2 text-left truncate select-all">
            {{ siteUrl }}
          </div>
          <button @click="copyUrl"
            class="flex-shrink-0 text-xs px-3 py-2 rounded-lg text-white"
            :style="copied ? 'background:#22c55e' : 'background:#1e2533'">
            {{ copied ? '已複製' : '複製' }}
          </button>
        </div>
        <p class="text-[11px] text-gray-400">或在 LINE 瀏覽器右上角選「在瀏覽器開啟」</p>
      </template>

      <button v-else @click="login"
        class="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90"
        style="background:#1e2533">
        使用 Google 登入
      </button>
    </div>
  </div>
</template>
<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const ua = navigator.userAgent || ''
const isWebView = /Line\/|FBAN|FBAV|MicroMessenger|Instagram/.test(ua)
const siteUrl = 'https://quotation-system-ddc5c.web.app'
const copied = ref(false)

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(siteUrl)
  } catch {
    const el = document.createElement('textarea')
    el.value = siteUrl
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

watch(() => auth.user, (u) => {
  if (u) router.replace('/cases')
}, { immediate: true })

async function login() {
  await auth.loginWithGoogle()
}
</script>
