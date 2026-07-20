<template>
  <div class="flex-1 p-6">
    <div v-if="auth.isOwner" class="text-sm text-gray-500">
      請從上方導覽列選擇「主檔資料」開始設定。
    </div>
    <div v-else class="text-sm text-gray-500">
      每日輸入功能還在開發中，尚未上線。
    </div>
  </div>
</template>
<script setup>
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
</script>
