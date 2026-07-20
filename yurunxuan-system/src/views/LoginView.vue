<template>
  <div class="min-h-screen flex items-center justify-center" style="background:#4a3535">
    <div class="bg-white rounded-2xl shadow-xl p-10 w-80 text-center">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4" style="background:#d98fa0">鈺</div>
      <h1 class="font-bold text-gray-800 text-lg mb-1">鈺潤軒管理系統</h1>
      <p class="text-xs text-gray-400 mb-6">請使用 Google 帳號登入</p>
      <button @click="login"
        class="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90"
        style="background:#4a3535">
        使用 Google 登入
      </button>
    </div>
  </div>
</template>
<script setup>
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

watch(() => auth.user, (u) => {
  if (u) router.replace('/')
}, { immediate: true })

async function login() {
  await auth.loginWithGoogle()
}
</script>
