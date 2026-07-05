<template>
  <div class="bg-white rounded-2xl shadow-sm px-4 py-3 mb-4">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-sm font-semibold text-gray-700">補休／特休餘額</span>
      <span class="text-[11px] text-gray-400">（已審核加班累積）</span>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div v-for="name in TRACKED" :key="name" class="bg-white rounded-xl px-3 py-3 shadow-sm border border-gray-100 border-t-4" style="border-top-color:#c9a96e">
        <div class="text-[11px] text-gray-400 mb-2">{{ name }}</div>

        <!-- 平日補休 -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">平日補休</span>
            <span class="text-base font-bold text-red-500">{{ getHours(name, 'compensatoryHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">H</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openEdit(name, 'compensatoryHours', '平日補休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'compensatoryHours', '平日補休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>
        <!-- 休息日補休 -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">休息日補休</span>
            <span class="text-base font-bold text-red-500">{{ getHours(name, 'compensatoryHolidayHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">H</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openEdit(name, 'compensatoryHolidayHours', '休息日補休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'compensatoryHolidayHours', '休息日補休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>

        <!-- 特休 -->
        <div class="flex items-center justify-between">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">特休</span>
            <span class="text-base font-bold text-amber-500">{{ getHours(name, 'annualLeaveHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">天</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openEdit(name, 'annualLeaveHours', '特休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'annualLeaveHours', '特休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 調整 Modal -->
  <div v-if="editingName" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-72 mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">調整{{ editingLabel }}時數 — {{ editingName }}</h3>
        <button @click="editingName = null" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="mb-4">
        <label class="text-xs text-gray-500 mb-1 block">{{ editingLabel === '特休' ? '天數（天）' : '時數（小時）' }}</label>
        <input v-model.number="editHours" type="number" min="0" step="0.5"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>
      <div class="flex justify-end gap-2">
        <button @click="editingName = null" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="saveEdit" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">儲存</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const TRACKED = ['蚌', 'Ramy', '昆霖', '賴賴']

const usersStore = useUsersStore()
const authStore = useAuthStore()
const { toast } = useToast()

const editingName = ref(null)
const editingField = ref(null)
const editingLabel = ref('')
const editHours = ref(0)

function getHours(name, field) {
    const user = usersStore.users.find(u => u.name === name)
    const val = user?.[field] ?? 0
    return field === 'compensatoryHours' ? +val.toFixed(1) : val
}

function openEdit(name, field, label) {
    editingName.value = name
    editingField.value = field
    editingLabel.value = label
    editHours.value = getHours(name, field)
}

async function saveEdit() {
    const user = usersStore.users.find(u => u.name === editingName.value)
    if (!user) { toast('找不到此員工', 'error'); return }
    try {
        await usersStore.updateUser(user.id, { [editingField.value]: editHours.value })
        toast(`${editingLabel.value}時數已更新`)
        editingName.value = null
    } catch {
        toast('更新失敗，請重試', 'error')
    }
}

async function confirmReset(name, field, label) {
    if (!confirm(`確定要將 ${name} 的${label}時數歸零？`)) return
    const user = usersStore.users.find(u => u.name === name)
    if (!user) { toast('找不到此員工', 'error'); return }
    try {
        await usersStore.updateUser(user.id, { [field]: 0 })
        toast(`${name} ${label}時數已歸零`)
    } catch {
        toast('歸零失敗，請重試', 'error')
    }
}
</script>
