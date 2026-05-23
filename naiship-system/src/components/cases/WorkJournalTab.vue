<template>
  <div class="flex gap-4">
    <!-- Left: employee selector (desktop only) -->
    <div class="hidden lg:block bg-white rounded-2xl shadow-sm flex-shrink-0 overflow-hidden" style="width:200px">
      <div class="px-4 py-3 border-b border-gray-100">
        <div class="text-xs font-semibold text-gray-500 mb-2">選擇員工</div>
        <input v-model="search" type="text" placeholder="搜尋..."
          class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
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
            :style="`background:${empColor(emp.id)}`">{{ emp.name?.[0] ?? '?' }}</span>
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
      <div class="bg-white rounded-2xl shadow-sm px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <!-- Mobile employee select -->
          <select v-model="mobileSelectedEmployee" class="lg:hidden text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white mb-2 w-full">
            <option :value="null">全部員工</option>
            <option v-for="emp in filteredEmployees" :key="emp.id" :value="emp">{{ emp.name }}</option>
          </select>
          <div class="text-sm font-semibold text-gray-800">
            {{ selectedEmployee ? `${selectedEmployee.name} 的工作日誌` : '全部員工工作日誌' }}
          </div>
          <div class="flex items-center gap-2 mt-1">
            <button @click="shiftDate(-1)" class="text-gray-400 hover:text-gray-700 text-xs leading-none px-1">◀</button>
            <span class="text-[11px] text-gray-500">{{ dateLabel }}</span>
            <button @click="shiftDate(1)" :disabled="isAtEnd" class="text-gray-400 hover:text-gray-700 text-xs leading-none px-1 disabled:opacity-30">▶</button>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button @click="viewMode = 'day'"
              class="px-2.5 py-1.5 transition-colors"
              :class="viewMode === 'day' ? 'text-white' : 'text-gray-500 hover:bg-gray-50'"
              :style="viewMode === 'day' ? 'background:#1e2533' : ''">單日</button>
            <button @click="viewMode = 'week'"
              class="px-2.5 py-1.5 transition-colors border-l border-gray-200"
              :class="viewMode === 'week' ? 'text-white' : 'text-gray-500 hover:bg-gray-50'"
              :style="viewMode === 'week' ? 'background:#1e2533' : ''">週檢視</button>
          </div>
          <button v-if="viewMode === 'week'" @click="exportWeekLogs"
            class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">匯出本週</button>
          <button v-if="isToday" @click="openLogForm" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 填寫今日日誌</button>
        </div>
      </div>

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

        <!-- Case entries -->
        <div v-if="log.caseEntries?.length || log.content" class="mb-3 bg-gray-50 rounded-xl p-3">
          <div class="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">負責案件回報</div>
          <template v-if="log.caseEntries?.length">
            <div v-for="entry in log.caseEntries" :key="entry.caseId"
              class="bg-white rounded-lg p-2.5 border border-gray-100 mb-2 last:mb-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">{{ entry.caseName }}</span>
              </div>
              <div class="text-xs text-gray-600">{{ entry.content }}</div>
            </div>
          </template>
          <div v-else class="bg-white rounded-lg p-2.5 border border-gray-100">
            <div class="text-xs text-gray-600">{{ log.content }}</div>
          </div>
        </div>

        <!-- Other items -->
        <div v-if="log.otherItems?.length" class="mb-3 bg-gray-50 rounded-xl p-3">
          <div class="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">其他工作項目</div>
          <div v-for="(item, i) in log.otherItems" :key="i"
            class="bg-white rounded-lg p-2.5 border border-gray-100 mb-2 last:mb-0 text-xs text-gray-600">
            {{ item.content }}
          </div>
        </div>

        <!-- Fuel expenses (new multi format) -->
        <div v-if="log.fuelExpenses?.length" class="mb-3 bg-amber-50 rounded-xl p-3">
          <div class="text-[10px] text-amber-600 font-semibold mb-2 uppercase tracking-wide">
            申請油資（共 {{ log.fuelExpenses.length }} 筆）
          </div>
          <div v-for="(f, i) in log.fuelExpenses" :key="i"
            class="flex gap-3 items-start mb-2 last:mb-0 pb-2 last:pb-0 border-b last:border-0 border-amber-100">
            <img v-if="f.photoUrl" :src="f.photoUrl"
              class="w-14 h-14 rounded-lg object-cover cursor-pointer flex-shrink-0"
              @click="previewUrl = f.photoUrl">
            <div>
              <div class="text-xs text-gray-700 mb-1"><span class="text-gray-400">原因：</span>{{ f.reason }}</div>
              <div class="text-xs text-gray-700"><span class="text-gray-400">路程：</span>{{ f.distance }} 公里</div>
              <div class="text-xs text-amber-600 font-semibold mt-0.5">補貼金額：{{ f.distance * 6 }} 元</div>
            </div>
          </div>
        </div>
        <!-- Fuel expense (old single format - backward compat) -->
        <div v-else-if="log.fuelExpense" class="mb-3 bg-amber-50 rounded-xl p-3">
          <div class="text-[10px] text-amber-600 font-semibold mb-2 uppercase tracking-wide">申請油資</div>
          <div class="flex gap-3 items-start">
            <img v-if="log.fuelExpense.photoUrl" :src="log.fuelExpense.photoUrl"
              class="w-16 h-16 rounded-lg object-cover cursor-pointer flex-shrink-0"
              @click="previewUrl = log.fuelExpense.photoUrl">
            <div>
              <div class="text-xs text-gray-700 mb-1"><span class="text-gray-400">原因：</span>{{ log.fuelExpense.reason }}</div>
              <div class="text-xs text-gray-700"><span class="text-gray-400">路程：</span>{{ log.fuelExpense.distance }} 公里</div>
              <div class="text-xs text-amber-600 font-semibold mt-0.5">補貼金額：{{ log.fuelExpense.distance * 6 }} 元</div>
            </div>
          </div>
        </div>

        <!-- Replies -->
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

      <div v-if="weekSummary" class="bg-white rounded-2xl shadow-sm px-5 py-4 flex items-center gap-6 text-sm">
        <span class="text-xs text-gray-400 font-semibold">本週合計</span>
        <div class="flex items-center gap-1">
          <span class="text-gray-500 text-xs">出勤</span>
          <span class="font-semibold text-gray-800">{{ weekSummary.count }} 筆</span>
        </div>
        <div v-if="weekSummary.fuelKm > 0" class="flex items-center gap-1">
          <span class="text-gray-500 text-xs">油資</span>
          <span class="font-semibold text-amber-600">{{ weekSummary.fuelKm }} km</span>
          <span class="text-gray-400 text-xs">/ ${{ weekSummary.fuelAmount.toLocaleString() }}</span>
        </div>
      </div>

      <div v-if="displayedLogs.length === 0" class="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
        {{ viewMode === 'week' ? '本週尚無工作日誌' : '今日尚無工作日誌' }}
      </div>
    </div>
  </div>

  <!-- 照片預覽 -->
  <div v-if="previewUrl" @click="previewUrl = null"
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
  </div>

  <!-- 填寫今日日誌 Modal -->
  <div v-if="showLogForm" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white sm:rounded-2xl rounded-t-2xl shadow-xl p-6 w-full sm:max-w-lg sm:mx-4 max-h-[100vh] sm:max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-gray-800">填寫今日工作日誌</h3>
        <button @click="showLogForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="text-xs text-gray-400 mb-4">{{ todayLabel }}</div>

      <!-- 負責案件 -->
      <div v-if="myCases.length > 0" class="mb-4">
        <div class="text-xs font-semibold text-gray-600 mb-2">負責案件回報</div>
        <div v-for="c in myCases" :key="c.id" class="border border-gray-100 rounded-xl p-3 mb-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 mb-2 inline-block">{{ c.name }}</span>
          <textarea v-model="logEntries[c.id]" rows="2"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="今日工作回報..."></textarea>
        </div>
      </div>

      <!-- 其他工作項目 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600">其他工作項目</div>
          <button @click="addOtherItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <div v-if="otherItems.length === 0" class="text-xs text-gray-400 py-1">無其他工作（可點右上新增）</div>
        <div v-for="(item, idx) in otherItems" :key="idx" class="flex items-start gap-2 mb-2">
          <textarea v-model="otherItems[idx].content" rows="2"
            class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="描述工作內容..."></textarea>
          <button @click="otherItems.splice(idx, 1)" class="text-red-400 hover:text-red-600 mt-2">✕</button>
        </div>
      </div>

      <!-- 申請油資 -->
      <div class="border border-amber-200 rounded-xl p-4 bg-amber-50/50">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-semibold text-amber-700">申請油資（選填）</div>
          <button v-if="!isAfter21" @click="addFuelItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <div v-if="isAfter21" class="text-xs text-center text-red-500 py-2 bg-red-50 rounded-lg">
          今日油資申請已截止（每日 21:00 截止）
        </div>
        <template v-else>
          <div v-if="fuelItems.length === 0" class="text-xs text-gray-400 py-1">無油資申請（可點右上新增）</div>
          <div v-for="(item, idx) in fuelItems" :key="idx"
            class="border border-amber-200 rounded-xl p-3 mb-2 last:mb-0 bg-white">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] text-amber-600 font-semibold">第 {{ idx + 1 }} 筆</span>
              <button @click="fuelItems.splice(idx, 1)" class="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
            <textarea v-model="item.reason" rows="2"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none bg-white mb-2"
              placeholder="申請原因（例：前往台南東區工地勘查）"></textarea>
            <div class="flex items-end gap-3">
              <div class="flex-1">
                <label class="text-xs text-gray-500 mb-1 block">路程（公里）</label>
                <input v-model.number="item.distance" type="number" min="0"
                  class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 bg-white"
                  placeholder="0">
                <div v-if="item.distance > 0" class="text-xs text-amber-600 font-semibold mt-1">
                  補貼金額：${{ item.distance * 6 }} 元（$6/公里）
                </div>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">憑證照片</label>
                <div class="flex items-center gap-2">
                  <button @click="triggerFuelPhoto(idx)"
                    class="text-xs border border-dashed border-amber-300 rounded-lg px-3 py-2 text-amber-600 hover:border-amber-500 transition-colors">
                    {{ item.photoFile ? '重新選擇' : '選擇照片' }}
                  </button>
                  <img v-if="item.previewUrl" :src="item.previewUrl" class="w-10 h-10 rounded-lg object-cover">
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="flex justify-end gap-2 mt-5">
        <button @click="showLogForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitLog" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">{{ submitting ? '送出中…' : '送出日誌' }}</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { Timestamp } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useAuthStore } from '@/stores/auth'
import { useCasesStore } from '@/stores/cases'
import { uploadPhoto } from '@/composables/useStorage'
import { useToast } from '@/composables/useToast'

const props = defineProps({ region: String })
const logsStore = useWorkLogsStore()
const authStore = useAuthStore()
const casesStore = useCasesStore()

const selectedEmployee = ref(null)
const mobileSelectedEmployee = ref(null)
const search = ref('')
const replyTarget = ref(null)
const replyContent = ref('')
const showLogForm = ref(false)
const previewUrl = ref(null)
const logEntries = ref({})
const otherItems = ref([])
const fuelItems = ref([])
const selectedDate = ref(new Date())
const viewMode = ref('day')
const submitting = ref(false)
const { toast } = useToast()

const isAfter21 = computed(() => new Date().getHours() >= 21)

const todayLabel = computed(() => {
    const d = new Date()
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
})

const myCases = computed(() =>
    casesStore.cases.filter(c =>
        c.companyId === props.region &&
        (authStore.isAdmin || authStore.isManager || c.assignedTo === authStore.user?.uid)
    )
)

function openLogForm() {
    logEntries.value = {}
    otherItems.value = []
    fuelItems.value = []
    showLogForm.value = true
}

function addOtherItem() {
    otherItems.value.push({ content: '' })
}

function addFuelItem() {
    fuelItems.value.push({ reason: '', distance: 0, photoFile: null, previewUrl: '' })
}

function triggerFuelPhoto(idx) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        fuelItems.value[idx].photoFile = file
        fuelItems.value[idx].previewUrl = URL.createObjectURL(file)
    }
    input.click()
}

async function submitLog() {
    const caseEntries = myCases.value
        .filter(c => logEntries.value[c.id]?.trim())
        .map(c => ({ caseId: c.id, caseName: c.name, content: logEntries.value[c.id].trim() }))
    const other = otherItems.value.filter(i => i.content.trim()).map(i => ({ content: i.content.trim() }))
    const hasFuel = !isAfter21.value && fuelItems.value.some(f => f.reason.trim())
    if (caseEntries.length === 0 && other.length === 0 && !hasFuel) return
    if (submitting.value) return
    submitting.value = true

    let fuelData = null
    if (hasFuel) {
        const items = []
        for (const item of fuelItems.value) {
            if (!item.reason.trim()) continue
            let photoUrl = ''
            if (item.photoFile) {
                try { photoUrl = await uploadPhoto(item.photoFile, 'fuel') } catch (_) {}
            }
            items.push({ reason: item.reason.trim(), distance: item.distance || 0, photoUrl })
        }
        if (items.length > 0) fuelData = items
    }

    const logDoc = {
        userId: authStore.user?.uid ?? '',
        userName: authStore.name ?? '',
        companyId: props.region,
        date: Timestamp.fromDate(new Date()),
        ...(caseEntries.length > 0 && { caseEntries }),
        ...(other.length > 0 && { otherItems: other }),
        ...(fuelData && { fuelExpenses: fuelData }),
    }
    await logsStore.addLog(logDoc)
    showLogForm.value = false
    submitting.value = false
    toast('日誌已送出')
}

// Week helpers
function getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay() // 0=Sun
    const diff = day === 0 ? -6 : 1 - day // adjust to Monday
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
}
function getWeekEnd(date) {
    const start = getWeekStart(date)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
}

const isToday = computed(() => {
    const t = new Date()
    const s = selectedDate.value
    return t.getFullYear() === s.getFullYear() && t.getMonth() === s.getMonth() && t.getDate() === s.getDate()
})

const isAtEnd = computed(() => {
    const today = new Date()
    if (viewMode.value === 'week') {
        const weekEnd = getWeekEnd(selectedDate.value)
        return weekEnd >= today
    }
    return isToday.value
})

function fmtDate(d) {
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const dateLabel = computed(() => {
    if (viewMode.value === 'week') {
        const ws = getWeekStart(selectedDate.value)
        const we = getWeekEnd(selectedDate.value)
        return `${fmtDate(ws)} - ${fmtDate(we)}`
    }
    const d = selectedDate.value
    if (isToday.value) return `${fmtDate(d)}（今日）`
    return fmtDate(d)
})

function shiftDate(delta) {
    const d = new Date(selectedDate.value)
    const step = viewMode.value === 'week' ? delta * 7 : delta
    d.setDate(d.getDate() + step)
    if (d > new Date()) return
    selectedDate.value = d
}

watch([() => props.region, selectedDate, viewMode], ([region]) => {
    if (!region) return
    if (viewMode.value === 'week') {
        const ws = getWeekStart(selectedDate.value)
        const we = getWeekEnd(selectedDate.value)
        logsStore.subscribe(region, ws, we)
    } else {
        logsStore.subscribe(region, selectedDate.value)
    }
}, { immediate: true })

// Sync mobile dropdown with the desktop sidebar selection
watch(mobileSelectedEmployee, val => { selectedEmployee.value = val })

onUnmounted(() => logsStore.unsubscribe?.())

const empColors = ['#c9a96e', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']
function empColor(uid) { return empColors[(uid?.charCodeAt(0) ?? 0) % empColors.length] }

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const filteredEmployees = computed(() => {
    const seen = new Set()
    return logsStore.logs
        .filter(l => { if (seen.has(l.userId)) return false; seen.add(l.userId); return true })
        .map(l => ({ id: l.userId, name: l.userName, hasLog: true }))
        .filter(e => !search.value || (e.name?.includes(search.value) ?? false))
})

const displayedLogs = computed(() =>
    selectedEmployee.value
        ? logsStore.logs.filter(l => l.userId === selectedEmployee.value.id)
        : logsStore.logs
)

const weekSummary = computed(() => {
    if (viewMode.value !== 'week' || displayedLogs.value.length === 0) return null
    const totalFuelKm = displayedLogs.value.reduce((sum, log) => {
        const km = log.fuelExpenses?.reduce((s, f) => s + (f.distance || 0), 0)
            ?? (log.fuelExpense?.distance || 0)
        return sum + km
    }, 0)
    return {
        count: displayedLogs.value.length,
        fuelKm: totalFuelKm,
        fuelAmount: totalFuelKm * 6,
    }
})

function exportWeekLogs() {
    if (displayedLogs.value.length === 0) {
        alert('本週無工作日誌記錄')
        return
    }
    const rows = []
    displayedLogs.value.forEach(log => {
        const dateStr = log.date
            ? (() => { const d = log.date.toDate?.() ?? new Date(log.date); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` })()
            : ''
        const caseReport = log.caseEntries?.length
            ? log.caseEntries.map(e => `${e.caseName}：${e.content}`).join('\n')
            : (log.content || '')
        const otherWork = log.otherItems?.map(i => i.content).join('\n') || ''
        const fuelKm = log.fuelExpenses?.reduce((s, f) => s + (f.distance || 0), 0)
            ?? (log.fuelExpense?.distance || 0)
        rows.push({
            '員工姓名': log.userName || '',
            '日期': dateStr,
            '案件回報': caseReport,
            '其他工作': otherWork,
            '油資(km)': fuelKm || '',
            '油資($)': fuelKm ? fuelKm * 6 : '',
        })
    })
    const sheet = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, '工作日誌')
    const weekStart = getWeekStart(selectedDate.value)
    const weekEnd = getWeekEnd(selectedDate.value)
    const fmt = d => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    XLSX.writeFile(wb, `工作日誌_${fmt(weekStart)}_${fmt(weekEnd)}.xlsx`)
}

async function submitReply(logId) {
    if (!replyContent.value.trim()) return
    await logsStore.addReply(logId, replyContent.value, authStore.user?.uid ?? 'unknown', authStore.name ?? '')
    replyContent.value = ''
    replyTarget.value = null
}
</script>
