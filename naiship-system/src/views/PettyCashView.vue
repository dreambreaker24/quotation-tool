<template>
  <main class="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-bold text-gray-800">零用金記帳</h1>
      <div class="flex gap-2">
        <button v-if="auth.isAdmin || auth.isManager"
          @click="doExport"
          class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">
          匯出 Excel
        </button>
        <button v-if="auth.isAdmin"
          @click="showSettlement = true"
          class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">
          月底結算
        </button>
        <button v-if="canAdd"
          @click="openAdd"
          class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">
          + 新增
        </button>
      </div>
    </div>

    <PettyCashOverview />
    <PettyCashList @edit="openEdit" />

    <PettyCashForm v-if="showForm" :entry="editingEntry" @close="closeForm" />
    <PettyCashSettlement v-if="showSettlement" @close="showSettlement = false" />
  </main>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePettyCashStore } from '@/stores/pettyCash'
import { useExport } from '@/composables/useExport'
import PettyCashOverview from '@/components/pettyCash/PettyCashOverview.vue'
import PettyCashList from '@/components/pettyCash/PettyCashList.vue'
import PettyCashForm from '@/components/pettyCash/PettyCashForm.vue'
import PettyCashSettlement from '@/components/pettyCash/PettyCashSettlement.vue'

const auth = useAuthStore()
const store = usePettyCashStore()
const { exportPettyCash } = useExport()

const showForm = ref(false)
const showSettlement = ref(false)
const editingEntry = ref(null)

const canAdd = computed(() => auth.isAdmin || auth.name === '蚌' || auth.name === '賴賴')

function openAdd() { editingEntry.value = null; showForm.value = true }
function openEdit(entry) { editingEntry.value = entry; showForm.value = true }
function closeForm() { showForm.value = false; editingEntry.value = null }

function doExport() {
    const ym = new Date().toISOString().slice(0, 7)
    exportPettyCash(store.entries, ym)
}

onMounted(() => store.subscribe())
onUnmounted(() => store.cleanup())
</script>
