<template>
  <template v-if="route.meta.public">
    <router-view />
  </template>
  <template v-else>
    <NavBar />
    <div class="flex pt-14 min-h-screen bg-gray-100">
      <router-view />
    </div>
  </template>

  <!-- Toast 通知 -->
  <div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
    <transition-group name="toast">
      <div v-for="t in toasts" :key="t.id"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm text-white pointer-events-auto"
        :style="t.type === 'error' ? 'background:#ef4444' : t.type === 'warning' ? 'background:#f59e0b' : 'background:#1e2533'">
        <span>{{ t.type === 'error' ? '✕' : '✓' }}</span>
        <span>{{ t.message }}</span>
      </div>
    </transition-group>
  </div>
</template>
<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/layout/NavBar.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useVendorsStore } from '@/stores/vendors'
import { useUsersStore } from '@/stores/users'

const route = useRoute()
const { toasts } = useToast()
const authStore = useAuthStore()
const vendorsStore = useVendorsStore()
const usersStore = useUsersStore()

watch(() => authStore.user, (u) => {
    if (u) {
        vendorsStore.subscribe()
        usersStore.subscribe()
    } else {
        vendorsStore.cleanup()
        usersStore.cleanup()
    }
}, { immediate: true })
</script>
<style>
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
</style>
