<template>
  <template v-if="route.meta.public">
    <router-view />
  </template>
  <template v-else-if="!authStore.authReady">
    <div class="min-h-screen flex items-center justify-center text-gray-400 text-sm">載入中…</div>
  </template>
  <template v-else>
    <NavBar />
    <div class="flex flex-col w-full pt-14 min-h-screen" style="background:#f5f4f1">
      <router-view />
    </div>
  </template>

  <div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
    <transition-group name="toast">
      <div v-for="t in toasts" :key="t.id"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm text-white pointer-events-auto"
        :style="t.type === 'error' ? 'background:#ef4444' : 'background:#4a3535'">
        <span>{{ t.type === 'error' ? '✕' : '✓' }}</span>
        <span>{{ t.message }}</span>
      </div>
    </transition-group>
  </div>
</template>
<script setup>
import { useRoute } from 'vue-router'
import NavBar from '@/components/layout/NavBar.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const { toasts } = useToast()
const authStore = useAuthStore()
</script>
<style>
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
</style>
