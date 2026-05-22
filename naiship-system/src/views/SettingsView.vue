<template>
  <div class="flex-1 p-6 overflow-auto">
    <h1 class="text-xl font-bold text-gray-800 mb-5">系統設定</h1>
    <div class="flex gap-1 mb-5 border-b border-gray-200">
      <button v-for="tab in tabs" :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-2.5 text-sm transition-colors"
        :class="activeTab === tab.id ? 'border-b-2 font-semibold' : 'text-gray-500 hover:text-gray-700'"
        :style="activeTab === tab.id ? 'border-color:#c9a96e;color:#c9a96e;margin-bottom:-1px' : ''">
        {{ tab.label }}
      </button>
    </div>
    <UserManager v-if="activeTab === 'users'" />
    <VendorManager v-else-if="activeTab === 'vendors'" />
  </div>
</template>
<script setup>
import { ref } from 'vue'
import UserManager from '@/components/settings/UserManager.vue'
import VendorManager from '@/components/settings/VendorManager.vue'

const activeTab = ref('users')
const tabs = [
    { id: 'users', label: '使用者管理' },
    { id: 'vendors', label: '廠商管理' },
]
</script>
