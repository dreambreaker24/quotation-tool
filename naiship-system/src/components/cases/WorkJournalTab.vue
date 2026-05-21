<template>
  <div class="flex gap-4">
    <!-- Left: employee selector (200px) -->
    <div class="bg-white rounded-2xl shadow-sm flex-shrink-0 overflow-hidden" style="width:200px">
      <div class="px-4 py-3 border-b border-gray-100">
        <div class="text-xs font-semibold text-gray-500 mb-2">選擇員工</div>
        <input v-model="search" type="text" placeholder="搜尋..."
          class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1"
          style="focus-ring-color:#c9a96e">
      </div>
      <div class="py-1">
        <div @click="selectedEmployee = null"
          class="px-4 py-2.5 cursor-pointer flex items-center gap-2"
          :style="!selectedEmployee ? 'background:rgba(201,169,110,0.1);border-left:2px solid #c9a96e' : ''"
          :class="!selectedEmployee ? '' : 'hover:bg-gray-50'">
          <span class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">全</span>
          <span class="text-xs text-gray-500">全部員工</span>
        </div>
        <div v-for="emp in filteredEmployees" :key="emp.id"
          @click="selectedEmployee = emp"
          class="px-4 py-2.5 cursor-pointer flex items-center gap-2"
          :style="selectedEmployee?.id === emp.id ? 'background:rgba(201,169,110,0.1);border-left:2px solid #c9a96e' : ''"
          :class="selectedEmployee?.id !== emp.id ? 'hover:bg-gray-50' : ''">
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            :style="`background:${empColor(emp.id)}`">{{ emp.name[0] }}</span>
          <div>
            <div class="text-xs font-semibold text-gray-800">{{ emp.name }}</div>
            <div class="text-[10px]" :class="emp.hasLog ? 'text-gray-400' : 'text-amber-500'">
              {{ emp.hasLog ? '今日已填寫' : '⚠ 未填寫' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: log entries -->
    <div class="flex-1 flex flex-col gap-4">
      <!-- Header -->
      <div class="bg-white rounded-2xl shadow-sm px-5 py-3 flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold text-gray-800">
            {{ selectedEmployee ? `${selectedEmployee.name} 的工作日誌` : '全部員工工作日誌' }}
          </div>
          <div class="text-[11px] text-gray-400 mt-0.5">{{ todayLabel }}</div>
        </div>
        <button class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 填寫今日日誌</button>
      </div>

      <!-- Log cards -->
      <div v-for="log in displayedLogs" :key="log.id" class="bg-white rounded-2xl shadow-sm p-5">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] text-white font-bold"
              :style="`background:${empColor(log.userId)}`">
              {{ log.userName?.[0] ?? '?' }}
            </span>
            <div>
              <div class="text-sm font-semibold text-gray-800">{{ log.userName }}</div>
              <div class="text-[10px] text-gray-400">{{ formatTime(log.createdAt) }}</div>
            </div>
          </div>
        </div>

        <!-- Case report entries -->
        <div class="mb-3 bg-gray-50 rounded-xl p-3">
          <div class="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">負責案件回報</div>
          <div v-for="entry in log.caseEntries" :key="entry.caseId"
            class="bg-white rounded-lg p-2.5 border border-gray-100 mb-2 last:mb-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">{{ entry.caseName }}</span>
            </div>
            <div class="text-xs text-gray-600">{{ entry.content }}</div>
          </div>
        </div>

        <!-- Replies section -->
        <div class="border-t border-gray-100 pt-3">
          <div v-for="reply in (log.replies || [])" :key="reply.id" class="flex items-start gap-2 mb-2">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0" style="background:#1e2533">
              {{ reply.creatorName?.[0] ?? '管' }}
            </span>
            <div class="bg-blue-50 rounded-xl px-3 py-2 text-xs text-gray-700 flex-1">
              {{ reply.content }}
              <div class="text-[10px] text-gray-400 mt-1">{{ reply.creatorName }} · {{ formatTime(reply.createdAt) }}</div>
            </div>
          </div>
          <button v-if="authStore.isManager" @click="replyTarget = log.id"
            class="text-[11px] hover:underline ml-8" style="color:#c9a96e">
            {{ (log.replies?.length) ? '回覆…' : '＋ 主管回覆' }}
          </button>
          <div v-if="replyTarget === log.id" class="mt-2 flex gap-2 ml-8">
            <input v-model="replyContent" type="text" placeholder="輸入回覆..."
              class="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1">
            <button @click="submitReply(log.id)"
              class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">送出</button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="displayedLogs.length === 0" class="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
        今日尚無工作日誌
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ region: String })
const logsStore = useWorkLogsStore()
const authStore = useAuthStore()

const selectedEmployee = ref(null)
const search = ref('')
const replyTarget = ref(null)
const replyContent = ref('')

onMounted(() => {
  if (props.region) {
    logsStore.subscribe(props.region, new Date())
  }
})

const todayLabel = computed(() => {
  const d = new Date()
  return `${d.getFullYear()} / ${String(d.getMonth()+1).padStart(2,'0')} / ${String(d.getDate()).padStart(2,'0')}（今日）`
})

const empColors = ['#c9a96e','#a855f7','#3b82f6','#22c55e','#f59e0b','#ef4444']
function empColor(uid) { return empColors[(uid?.charCodeAt(0) ?? 0) % empColors.length] }

function formatTime(ts) {
  if (!ts) return ''
  const d = ts.toDate?.() ?? new Date(ts)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const filteredEmployees = computed(() => {
  const seen = new Set()
  return logsStore.logs
    .filter(l => { if (seen.has(l.userId)) return false; seen.add(l.userId); return true })
    .map(l => ({ id: l.userId, name: l.userName, hasLog: true, color: empColor(l.userId) }))
    .filter(e => !search.value || e.name.includes(search.value))
})

const displayedLogs = computed(() =>
  selectedEmployee.value
    ? logsStore.logs.filter(l => l.userId === selectedEmployee.value.id)
    : logsStore.logs
)

async function submitReply(logId) {
  if (!replyContent.value.trim()) return
  await logsStore.addReply(logId, replyContent.value, authStore.user?.uid ?? 'unknown')
  replyContent.value = ''
  replyTarget.value = null
}
</script>
