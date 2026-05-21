<template>
  <nav class="text-white h-14 flex items-center px-6 gap-4 fixed top-0 left-0 right-0 z-50" style="background:#1e2533">
    <div class="flex items-center gap-3 mr-4">
      <div class="w-7 h-7 rounded flex items-center justify-center font-bold text-xs" style="background:#c9a96e;color:#1e2533">奈</div>
      <span class="font-semibold text-sm tracking-wide">奈拾設計 管理系統</span>
    </div>
    <div class="flex gap-1">
      <router-link v-for="item in navItems" :key="item.to" :to="item.to"
        class="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
        style=""
        active-class="text-white"
        :style="isActive(item.to) ? 'background:rgba(255,255,255,0.1)' : ''">
        {{ item.label }}
      </router-link>
    </div>
    <div class="ml-auto flex items-center gap-3">
      <span class="text-xs text-gray-400">{{ auth.name }}（{{ roleLabel }}）</span>
      <button @click="auth.logout()" class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style="background:#c9a96e;color:#1e2533">
        {{ auth.name?.[0] ?? '?' }}
      </button>
    </div>
  </nav>
</template>
<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
const auth = useAuthStore()
const route = useRoute()
const roleLabel = computed(() => ({ admin: '管理者', manager: '主管', employee: '員工' }[auth.role] ?? ''))
const navItems = [
  { to: '/', label: '首頁總覽' },
  { to: '/cases', label: '案件管理' },
  { to: '/clients', label: '客戶管理' },
  { to: '/settings', label: '系統設定' }
]
function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>
