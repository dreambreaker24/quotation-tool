<template>
  <nav class="text-white h-14 flex items-center px-4 sm:px-6 gap-2 sm:gap-4 fixed top-0 left-0 right-0 z-50" style="background:#1e2533;box-shadow:0 2px 12px rgba(0,0,0,0.35)">
    <div class="flex items-center gap-2 mr-1 sm:mr-4 flex-shrink-0">
      <div class="w-7 h-7 rounded flex items-center justify-center font-bold text-xs" style="background:#c9a96e;color:#1e2533">奈</div>
      <span class="hidden sm:inline font-semibold text-sm tracking-wide">奈拾設計 管理系統</span>
    </div>
    <div class="flex gap-0.5 sm:gap-1 min-w-0">
      <router-link v-for="item in navItems" :key="item.to" :to="item.to"
        class="px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm text-gray-400 hover:text-white transition-colors relative whitespace-nowrap border-b-2 border-transparent"
        active-class="text-white"
        :style="isActive(item.to) ? 'background:rgba(255,255,255,0.08);border-bottom-color:#c9a96e' : ''">
        {{ item.label }}
        <span v-if="item.to === '/clients' && hasFollowUpDue"
          class="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
      </router-link>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <NotificationBell />
      <span class="hidden sm:inline text-xs text-gray-400">{{ auth.name }}（{{ roleLabel }}）</span>
      <button @click="auth.logout()" class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style="background:#c9a96e;color:#1e2533">
        {{ auth.name?.[0] ?? '?' }}
      </button>
    </div>
  </nav>
</template>
<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { useRoute } from 'vue-router'
import NotificationBell from './NotificationBell.vue'
const auth = useAuthStore()
const clientsStore = useClientsStore()
const route = useRoute()
const roleLabel = computed(() => ({ admin: '管理者', manager: '主管', employee: '員工' }[auth.role] ?? ''))
const todayStr = new Date().toISOString().slice(0, 10)
const hasFollowUpDue = computed(() =>
    clientsStore.clients.some(c => c.followUpDate && c.followUpDate <= todayStr)
)
const navItems = computed(() => [
  ...(auth.isManager ? [{ to: '/', label: '首頁總覽' }] : []),
  { to: '/cases', label: '案件管理' },
  { to: '/clients', label: '客戶/廠商' },
  { to: '/petty-cash', label: '零用金' },
  ...(auth.isAdmin ? [{ to: '/payslip', label: '薪資單' }, { to: '/settings', label: '系統設定' }] : [])
])
function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>
