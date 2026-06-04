<template>
  <div class="min-h-screen flex items-center justify-center" style="background:#1e2533">
    <div class="bg-white rounded-2xl shadow-xl p-10 w-80 text-center">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4" style="background:#c9a96e;color:#1e2533">奈</div>
      <h1 class="font-bold text-gray-800 text-lg mb-1">奈拾設計管理系統</h1>
      <p class="text-xs text-gray-400 mb-6">請使用公司 Google 帳號登入</p>

      <!-- WebView 警告 -->
      <template v-if="isWebView">
        <div class="text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mb-4 text-left leading-relaxed">
          目前在 LINE / App 內開啟，<br>Google 登入需使用外部瀏覽器。
        </div>
        <a :href="currentUrl"
          target="_blank"
          class="block w-full text-white rounded-xl py-2.5 text-sm font-medium text-center"
          style="background:#c9a96e;color:#1e2533">
          在 Safari / Chrome 開啟
        </a>
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
const currentUrl = window.location.href

watch(() => auth.user, (u) => {
  if (u) router.replace('/cases')
}, { immediate: true })

async function login() {
  await auth.loginWithGoogle()
}
</script>
