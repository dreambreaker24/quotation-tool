<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">洽談紀錄</span>
      <button @click="showForm = true" class="text-xs text-white px-2 py-1 rounded-lg" style="background:#1e2533">+ 新增</button>
    </div>
    <div v-if="showForm" class="bg-gray-50 rounded-xl p-3 mb-3">
      <textarea v-model="newContent" rows="3" placeholder="記錄洽談內容..."
        class="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"></textarea>
      <div class="flex justify-end gap-2 mt-2">
        <button @click="showForm = false; newContent = ''" class="text-xs text-gray-400 px-3 py-1">取消</button>
        <button @click="submit" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">儲存</button>
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <div v-for="note in notes" :key="note.id" class="border border-gray-100 rounded-xl p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-700">{{ note.creatorName ?? '—' }}</span>
          <span class="text-[10px] text-gray-400">{{ formatDate(note.createdAt) }}</span>
        </div>
        <p class="text-xs text-gray-600 leading-relaxed">{{ note.content }}</p>
      </div>
    </div>
    <div v-if="notes.length === 0 && !showForm" class="text-center text-gray-400 text-xs py-4">
      尚無洽談紀錄
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ clientId: String, notes: { type: Array, default: () => [] } })
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const showForm = ref(false)
const newContent = ref('')

async function submit() {
    if (!newContent.value.trim()) return
    await clientsStore.addNote(props.clientId, newContent.value, [], authStore.user?.uid ?? 'unknown')
    newContent.value = ''
    showForm.value = false
}

function formatDate(ts) {
    const d = ts?.toDate?.() ?? new Date()
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
</script>
