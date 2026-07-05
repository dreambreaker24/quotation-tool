<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white sm:rounded-2xl rounded-t-2xl shadow-xl px-4 py-5 sm:p-6 w-full sm:max-w-lg sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-gray-800">{{ editingLog ? '編輯工作日誌' : '填寫今日工作日誌' }}</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex items-center gap-2 mb-4">
        <span class="text-xs text-gray-400">{{ todayLabel }}</span>
        <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style="background:#c9a96e">
          {{ regionLabel }}（本區）
        </span>
      </div>

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
          <button v-if="!isAfterDeadline || editingLog" @click="addFuelItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <div v-if="editingLog?.fuelApproved" class="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-2">
          ✓ 油資已核准，無法修改
        </div>
        <div v-else-if="isAfterDeadline && !editingLog" class="text-xs text-center text-red-500 py-2 bg-red-50 rounded-lg">
          油資申請已截止（截止至後天 19:00）
        </div>
        <template v-if="!editingLog?.fuelApproved && (!isAfterDeadline || editingLog)">
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
            <div class="flex flex-col sm:flex-row sm:items-end gap-3">
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
                    class="text-xs border border-dashed border-amber-300 rounded-lg px-3 py-3 sm:py-2 text-amber-600 hover:border-amber-500 transition-colors">
                    {{ item.photoFile ? '重新選擇' : '選擇照片' }}
                  </button>
                  <img v-if="item.previewUrl" :src="item.previewUrl"
                    class="w-12 h-12 sm:w-10 sm:h-10 rounded-lg object-cover cursor-pointer"
                    @click="previewUrl = item.previewUrl">
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 申請加班 -->
      <div class="border border-purple-200 rounded-xl p-4 bg-purple-50/50 mt-3">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-semibold text-purple-700">申請加班（選填）</div>
          <button v-if="!editingLog?.overtimeApproved && (!isAfterDeadline || editingLog)" @click="addOvertimeItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <!-- 已審核項目（唯讀顯示） -->
        <div v-for="(ot, i) in decidedOvertimeItems" :key="'decided-'+i"
          class="border rounded-xl p-3 mb-2 bg-white text-xs text-gray-600"
          :class="ot.approved ? 'border-green-200' : 'border-red-200'">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div><span class="text-gray-400">原因：</span>{{ ot.reason }}</div>
              <div class="text-purple-600 font-semibold mt-0.5">{{ ot.type || '平日' }} 加班 {{ ot.hours }} 小時</div>
            </div>
            <span :class="ot.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'"
              class="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
              {{ ot.approved ? '✓ 已同意' : '✕ 不同意' }}
            </span>
          </div>
        </div>
        <div v-if="editingLog?.overtimeApproved" class="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-2">
          ✓ 加班已全部審核完畢
        </div>
        <div v-else-if="isAfterDeadline && !editingLog" class="text-xs text-center text-red-500 py-2 bg-red-50 rounded-lg">
          加班申請已截止（截止至後天 19:00）
        </div>
        <div v-else-if="overtimeItems.length === 0 && decidedOvertimeItems.length === 0" class="text-xs text-gray-400 py-1">無加班申請（可點右上新增）</div>
        <div v-for="(item, idx) in overtimeItems" :key="idx"
          class="border border-purple-200 rounded-xl p-3 mb-2 last:mb-0 bg-white">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] text-purple-600 font-semibold">第 {{ idx + 1 }} 筆</span>
            <button @click="overtimeItems.splice(idx, 1)" class="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
          <div class="flex gap-1 mb-2">
            <button @click="item.type = '平日'"
              class="text-xs px-3 py-1 rounded-lg border transition-colors"
              :style="(item.type || '平日') === '平日' ? 'background:#8b5cf6;color:#fff;border-color:#8b5cf6' : 'color:#8b5cf6;border-color:#c4b5fd'">
              平日
            </button>
            <button @click="item.type = '休息日'"
              class="text-xs px-3 py-1 rounded-lg border transition-colors"
              :style="item.type === '休息日' ? 'background:#8b5cf6;color:#fff;border-color:#8b5cf6' : 'color:#8b5cf6;border-color:#c4b5fd'">
              休息日
            </button>
          </div>
          <textarea v-model="item.reason" rows="2"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none bg-white mb-2"
            placeholder="加班原因（例：處理緊急案件、協助廠商施工）"></textarea>
          <div class="flex items-center gap-3">
            <label class="text-xs text-gray-500">加班時數</label>
            <input v-model.number="item.hours" type="number" min="0" step="0.5"
              class="w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 bg-white"
              placeholder="0">
            <span class="text-xs text-gray-400">小時</span>
          </div>
        </div>
      </div>

      <!-- 附件 -->
      <div class="border border-gray-200 rounded-xl p-4 bg-gray-50/50 mt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600">附件（選填）</div>
          <button @click="logAttachInput.click()" class="text-xs" style="color:#c9a96e">+ 選擇檔案</button>
        </div>
        <div v-if="logAttachFiles.length" class="flex gap-2 flex-wrap">
          <div v-for="(f, i) in logAttachFiles" :key="i" class="relative">
            <img v-if="f.preview" :src="f.preview" class="w-12 h-12 rounded object-cover">
            <div v-else class="w-12 h-12 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
            <button @click="logAttachFiles.splice(i, 1)"
              class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
          </div>
        </div>
        <div v-else class="text-[11px] text-gray-300">無附件</div>
      </div>

      <div class="flex justify-end gap-2 mt-5">
        <button @click="$emit('close')" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitLog" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ submitting ? (editingLog ? '更新中…' : '送出中…') : (editingLog ? '更新日誌' : '送出日誌') }}
        </button>
      </div>
      <input ref="fuelFileInput" type="file" accept="image/*" class="hidden" @change="handleFuelFileChange">
      <input ref="logAttachInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleLogAttachFiles">
    </div>
  </div>

  <!-- Fuel photo preview (internal to form) -->
  <div v-if="previewUrl" @click="previewUrl = null"
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] cursor-pointer">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import { Timestamp } from 'firebase/firestore'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useAuthStore } from '@/stores/auth'
import { useCasesStore } from '@/stores/cases'
import { useNotificationsStore } from '@/stores/notifications'
import { uploadPhoto } from '@/composables/useStorage'
import { useToast } from '@/composables/useToast'

const props = defineProps({ show: Boolean, editingLog: Object, region: String })
const emit = defineEmits(['close', 'submitted'])

const logsStore = useWorkLogsStore()
const authStore = useAuthStore()
const casesStore = useCasesStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const submitting = ref(false)
const previewUrl = ref(null)
const fuelFileInput = ref(null)
const logAttachInput = ref(null)
const activeFuelIdx = ref(-1)
const logEntries = ref({})
const otherItems = ref([])
const fuelItems = ref([])
const overtimeItems = ref([])
const decidedOvertimeItems = ref([])
const logAttachFiles = ref([])

const REGION_LABELS = { south: '奈拾南區', north: '奈拾北區', central: '奈拾中區' }
const regionLabel = computed(() => REGION_LABELS[props.region] ?? props.region)

const todayLabel = computed(() => {
    const d = new Date()
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
})

const myCases = computed(() =>
    casesStore.cases.filter(c =>
        c.companyId === props.region &&
        !['completed', 'lost'].includes(c.status) &&
        (authStore.isAdmin || authStore.isManager ||
         c.assignedTo === authStore.user?.uid ||
         (authStore.name && c.assignees?.includes(authStore.name)))
    )
)

const isAfterDeadline = computed(() => {
    const now = new Date()
    const logDate = props.editingLog?.date?.toDate?.() ?? new Date()
    const deadline = new Date(logDate)
    deadline.setDate(deadline.getDate() + 2)
    deadline.setHours(19, 0, 0, 0)
    return now >= deadline
})

watch(() => props.show, (val) => {
    if (!val) return
    logEntries.value = {}
    logAttachFiles.value = []
    const log = props.editingLog
    if (log) {
        if (log.caseEntries?.length) log.caseEntries.forEach(e => { logEntries.value[e.caseId] = e.content })
        otherItems.value = (log.otherItems ?? []).map(i => ({ content: i.content }))
        fuelItems.value = log.fuelApproved
            ? []
            : (log.fuelExpenses ?? []).map(f => ({ reason: f.reason, distance: f.distance || 0, photoFile: null, previewUrl: f.photoUrl || '' }))
        decidedOvertimeItems.value = (log.overtimeItems ?? []).filter(i => i.approved != null)
        overtimeItems.value = log.overtimeApproved
            ? []
            : (log.overtimeItems ?? []).filter(i => i.approved == null).map(ot => ({ reason: ot.reason, hours: ot.hours }))
    } else {
        otherItems.value = []
        fuelItems.value = []
        overtimeItems.value = []
        decidedOvertimeItems.value = []
    }
})

function addOtherItem() { otherItems.value.push({ content: '' }) }
function addFuelItem() { fuelItems.value.push({ reason: '', distance: 0, photoFile: null, previewUrl: '' }) }
function addOvertimeItem() { overtimeItems.value.push({ reason: '', hours: 0, type: '平日' }) }

function triggerFuelPhoto(idx) {
    activeFuelIdx.value = idx
    fuelFileInput.value?.click()
}

function handleFuelFileChange(e) {
    const file = e.target.files[0]
    if (!file || activeFuelIdx.value < 0) return
    fuelItems.value[activeFuelIdx.value].photoFile = file
    fuelItems.value[activeFuelIdx.value].previewUrl = URL.createObjectURL(file)
    e.target.value = ''
}

function handleLogAttachFiles(e) {
    Array.from(e.target.files).forEach(file => {
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        logAttachFiles.value.push({ file, preview: isPdf ? null : URL.createObjectURL(file) })
    })
    e.target.value = ''
}

async function submitLog() {
    const caseEntries = myCases.value
        .filter(c => logEntries.value[c.id]?.trim())
        .map(c => ({ caseId: c.id, caseName: c.name, content: logEntries.value[c.id].trim() }))
    const other = otherItems.value.filter(i => i.content.trim()).map(i => ({ content: i.content.trim() }))
    const canAddFuel = !isAfterDeadline.value || !!props.editingLog
    const hasFuel = canAddFuel && fuelItems.value.some(f => f.reason.trim())
    if (!props.editingLog && caseEntries.length === 0 && other.length === 0 && !hasFuel) return
    if (submitting.value) return
    submitting.value = true

    let fuelData = null
    if (hasFuel && !props.editingLog?.fuelApproved) {
        const items = []
        for (const item of fuelItems.value) {
            if (!item.reason.trim()) continue
            let photoUrl = item.previewUrl || ''
            if (item.photoFile) {
                try { photoUrl = await uploadPhoto(item.photoFile, 'fuel') } catch (_) {}
            }
            items.push({ reason: item.reason.trim(), distance: item.distance || 0, photoUrl })
        }
        if (items.length > 0) fuelData = items
    }

    const pendingOvertimeData = overtimeItems.value
        .filter(i => i.reason.trim() && i.hours > 0)
        .map(i => ({ reason: i.reason.trim(), hours: i.hours, type: i.type || '平日' }))
    const overtimeData = props.editingLog?.overtimeApproved
        ? decidedOvertimeItems.value
        : [...decidedOvertimeItems.value, ...pendingOvertimeData]

    if (props.editingLog) {
        const updateData = {
            ...(caseEntries.length > 0 ? { caseEntries } : { caseEntries: [] }),
            ...(other.length > 0 ? { otherItems: other } : { otherItems: [] }),
            ...(!props.editingLog.fuelApproved && {
                fuelExpenses: fuelData ?? [],
                ...(fuelData ? { fuelApproved: false } : {}),
            }),
            ...(overtimeData.length > 0 && {
                overtimeItems: overtimeData,
                overtimeApproved: overtimeData.every(i => i.approved != null),
            }),
        }
        try {
            await logsStore.updateLog(props.editingLog.id, updateData)
            toast('日誌已更新')
            emit('submitted')
        } catch {
            toast('更新失敗，請重試', 'error')
        }
        submitting.value = false
        return
    }

    const logAttachments = []
    for (const pf of logAttachFiles.value) {
        try {
            const url = await uploadPhoto(pf.file, 'log')
            const isPdf = pf.file.name.toLowerCase().endsWith('.pdf')
            const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            logAttachments.push({ url, isPdf, pdfUrl })
        } catch { /* skip */ }
    }

    const logDoc = {
        userId: authStore.user?.uid ?? '',
        userName: authStore.name ?? '',
        companyId: props.region,
        date: Timestamp.fromDate(new Date()),
        ...(caseEntries.length > 0 && { caseEntries }),
        ...(other.length > 0 && { otherItems: other }),
        ...(fuelData && { fuelExpenses: fuelData, fuelApproved: false }),
        ...(overtimeData.length > 0 && { overtimeItems: overtimeData, overtimeApproved: false }),
        ...(logAttachments.length > 0 && { logAttachments }),
    }
    try {
        await logsStore.addLog(logDoc)
        const now = new Date()
        const dateStr = `${now.getMonth() + 1}/${now.getDate()}`
        const logDateISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        notifStore.notifyAll(authStore.name ?? '', `新增了 ${dateStr} 工作日誌`, '', '', authStore.companyId ?? '', logDateISO)
        toast('日誌已送出')
        emit('submitted')
    } catch {
        toast('送出失敗，請重試', 'error')
    }
    submitting.value = false
}
</script>
