<template>
  <div class="w-full sm:w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 sm:min-h-screen">
    <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
      <span class="text-sm font-semibold pl-2 border-l-2" style="color:#1e2533;border-left-color:#c9a96e">客戶列表</span>
      <button @click="emit('add')" class="text-xs text-white px-2 py-1 rounded-lg" style="background:#1e2533">+ 新增</button>
    </div>
    <div class="px-4 py-2 border-b border-gray-100 flex flex-col gap-1.5">
      <input v-model="search" type="text" placeholder="搜尋客戶..."
        class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
      <select v-model="statusFilter" class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1">
        <option value="">全部狀態</option>
        <option value="contacted">初次接觸</option>
        <option value="negotiating">洽談中</option>
        <option value="signed">已簽約</option>
        <option value="completed">已完工</option>
        <option value="returning">回頭客</option>
        <option value="lost">已流失</option>
      </select>
      <select v-model="regionFilter" class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1">
        <option value="">全部分區</option>
        <option value="south">奈拾南區</option>
        <option value="north">奈拾北區</option>
        <option value="central">奈拾中區</option>
      </select>
      <select v-model="gradeFilter" data-test="grade-filter" class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1">
        <option value="">全部等級</option>
        <option value="S">S</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="none">未分級</option>
      </select>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-for="c in filteredClients" :key="c.id"
        @click="selectClient($event, c)"
        class="px-4 py-3 cursor-pointer border-b border-gray-100 transition-all border-l-4"
        :style="selected?.id === c.id ? 'background:rgba(201,169,110,0.1);border-left-color:#c9a96e' : 'border-left-color:transparent'"
        :class="selected?.id !== c.id ? 'hover:bg-amber-50/40 hover:border-l-amber-200 hover:-translate-y-px' : ''">
        <div class="flex items-center justify-between gap-2">
          <div class="text-sm font-medium text-gray-800 truncate">{{ c.name }}</div>
          <div v-if="c.grade || canEditGrade" class="relative flex-shrink-0"
            :ref="el => setMenuRef(c.id, el)">
            <button :data-test="`grade-badge-${c.id}`" @click="toggleGradeMenu(c.id)"
              class="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
              :class="!c.grade ? 'border border-dashed border-gray-300 text-gray-300' : ''"
              :style="c.grade ? gradeStyle(c.grade) : ''">{{ c.grade || '+' }}</button>
            <div v-if="openGradeMenuId === c.id" :data-test="`grade-menu-${c.id}`"
              class="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-16">
              <button v-for="g in GRADES" :key="g" :data-test="`grade-option-${c.id}-${g}`"
                @click="setGrade(c, g)"
                class="w-full text-center py-1 text-xs font-semibold hover:bg-gray-50" :style="gradeStyle(g)">{{ g }}</button>
              <button v-if="c.grade" :data-test="`grade-clear-${c.id}`" @click="setGrade(c, null)"
                class="w-full text-center py-1 text-[10px] text-gray-400 hover:bg-gray-50 border-t border-gray-100">清除</button>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="text-[10px] px-2 py-0.5 rounded-full" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
          <span v-if="isDueFollowUp(c)" class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">跟進</span>
          <span class="text-[10px] text-gray-400">{{ c.phone }}</span>
        </div>
      </div>
      <div v-if="filteredClients.length === 0" class="px-4 py-6 text-center text-gray-400 text-xs">
        尚無客戶資料
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { deleteField } from 'firebase/firestore'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const props = defineProps({ selected: Object })
const emit = defineEmits(['select', 'add'])
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const { toast } = useToast()
const search = ref('')
const statusFilter = ref('')
const regionFilter = ref('')
const gradeFilter = ref('')

const filteredClients = computed(() =>
    clientsStore.clients.filter(c => {
        if (search.value && !c.name?.includes(search.value) && !c.phone?.includes(search.value)) return false
        if (statusFilter.value && c.status !== statusFilter.value) return false
        if (regionFilter.value && c.companyId !== regionFilter.value) return false
        if (gradeFilter.value === 'none' && c.grade) return false
        if (gradeFilter.value && gradeFilter.value !== 'none' && c.grade !== gradeFilter.value) return false
        return true
    })
)

const statusMap = { contacted: '初次接觸', negotiating: '洽談中', signed: '已簽約', completed: '已完工', returning: '回頭客', lost: '已流失' }
const statusClassMap = {
    contacted: 'bg-gray-100 text-gray-500',
    negotiating: 'bg-amber-100 text-amber-700',
    signed: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    returning: 'bg-purple-100 text-purple-700',
    lost: 'bg-red-100 text-red-500'
}
function statusLabel(s) { return statusMap[s] ?? s }
function statusClass(s) { return statusClassMap[s] ?? 'bg-gray-100 text-gray-500' }
function isDueFollowUp(c) {
    if (!c.followUpDate) return false
    return c.followUpDate <= new Date().toISOString().slice(0, 10)
}

// 客戶分級標籤
const GRADES = ['S', 'A', 'B', 'C']
const GRADE_STYLE = {
    S: 'background:rgba(201,169,110,0.18);color:#8a6d33',
    A: 'background:#dbeafe;color:#1d4ed8',
    B: 'background:#f1f5f9;color:#64748b',
    C: 'background:#f3f4f6;color:#9ca3af',
}
const canEditGrade = computed(() => authStore.isAdmin || authStore.isManager)
const openGradeMenuId = ref(null)

function gradeStyle(g) { return GRADE_STYLE[g] ?? '' }
function toggleGradeMenu(clientId) {
    if (!canEditGrade.value) return
    openGradeMenuId.value = openGradeMenuId.value === clientId ? null : clientId
}
async function setGrade(client, grade) {
    openGradeMenuId.value = null
    try {
        await clientsStore.updateClient(client.id, { grade: grade ?? deleteField() })
    } catch {
        toast('更新等級失敗，請重試', 'error')
    }
}
// 每列徽章／選單的容器元素，用來判斷點擊是否落在目前開啟的那個選單「內部」
const menuRefs = new Map()
function setMenuRef(clientId, el) {
    if (el) menuRefs.set(clientId, el)
    else menuRefs.delete(clientId)
}
function selectClient(e, c) {
    if (menuRefs.get(c.id)?.contains(e.target)) return
    emit('select', c)
}
function closeGradeMenuOnOutsideClick(e) {
    if (!openGradeMenuId.value) return
    const el = menuRefs.get(openGradeMenuId.value)
    if (el && !el.contains(e.target)) {
        openGradeMenuId.value = null
    }
}
onMounted(() => document.addEventListener('click', closeGradeMenuOnOutsideClick))
onUnmounted(() => document.removeEventListener('click', closeGradeMenuOnOutsideClick))
</script>
