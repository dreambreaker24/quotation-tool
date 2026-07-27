<template>
  <nav class="text-white h-14 flex items-center px-4 sm:px-6 gap-2 sm:gap-4 fixed top-0 left-0 right-0 z-50" style="background:#4a3535;box-shadow:0 2px 12px rgba(0,0,0,0.35)">
    <div class="flex items-center gap-2 mr-1 sm:mr-4 flex-shrink-0">
      <div class="w-7 h-7 rounded flex items-center justify-center font-bold text-xs" style="background:#d98fa0">鈺</div>
      <span class="hidden sm:inline font-semibold text-sm tracking-wide">鈺潤軒 管理系統</span>
    </div>
    <div class="flex gap-0.5 sm:gap-1 overflow-x-auto flex-shrink min-w-0">
      <router-link to="/" class="px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap">首頁</router-link>
      <router-link to="/daily-entry" class="px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap">每日輸入</router-link>
      <router-link to="/inventory" class="px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap">庫存總覽</router-link>
      <router-link v-if="auth.isOwner" to="/master-data" class="px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap">主檔資料</router-link>
      <router-link v-if="auth.isOwner" to="/monthly-expenses" class="px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap">每月支出</router-link>
      <router-link v-if="auth.isOwner" to="/petty-cash" class="px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap">零用金</router-link>
      <router-link v-if="auth.isOwner" to="/bonus" class="px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap">季度獎金</router-link>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <span class="hidden sm:inline text-xs text-gray-300">{{ auth.name }}（{{ auth.isOwner ? '負責人' : '店員' }}）</span>
      <button @click="auth.logout()" class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style="background:#d98fa0">
        {{ auth.name?.[0] ?? '?' }}
      </button>
    </div>
  </nav>
</template>
<script setup>
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
</script>
