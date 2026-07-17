<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-gray-800">{{ caseInfo?.name }}｜獎金資料</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <p class="text-sm text-gray-400">（下一個 task 補完整表單內容）</p>
    </div>
  </div>
</template>
<script setup>
defineProps({ caseId: String, caseInfo: Object })
defineEmits(['close'])
</script>
