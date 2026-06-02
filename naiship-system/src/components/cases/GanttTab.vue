<template>
  <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
    <!-- 狀態篩選 chips -->
    <div class="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
      <span class="text-[11px] text-gray-400 font-semibold mr-1">篩選：</span>
      <button v-for="[status, color] in statusLegend" :key="status"
        @click="toggleStatus(status)"
        class="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition-colors"
        :style="activeStatuses.has(status)
          ? `background:${color};color:#fff;border-color:${color}`
          : 'background:#f9fafb;color:#9ca3af;border-color:#e5e7eb'">
        {{ STATUS_LABELS[status] }}
      </button>
    </div>
    <div class="flex" style="min-height:200px">
      <!-- Fixed left panel (270px) -->
      <div class="flex-shrink-0 border-r border-gray-200" style="width:270px">
        <!-- Column header -->
        <div class="bg-gray-50 border-b border-gray-200 px-3 py-2.5 flex items-center gap-2" style="height:36px">
          <span class="flex-1 text-[11px] font-semibold text-gray-500">案件 / 工種</span>
          <span class="w-16 text-center text-[11px] font-semibold text-gray-500">負責人</span>
        </div>
        <!-- Case rows -->
        <div v-for="c in regionCases" :key="c.id" class="border-b border-gray-100">
          <div @click="selectCase(c.id)"
            class="px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors" style="height:36px"
            :style="`border-left:3px solid ${STATUS_BAR_COLORS[c.status] ?? '#e5e7eb'};${selectedCaseId === c.id ? 'background:rgba(201,169,110,0.12)' : ''}`">
            <span class="text-gray-400 text-[10px] w-4 flex-shrink-0 select-none">{{ expanded[c.id] ? '▼' : '▶' }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1 min-w-0">
                <div class="text-xs font-semibold truncate" :title="c.name"
                  :style="selectedCaseId === c.id ? 'color:#c9a96e' : 'color:#1f2937'">{{ c.name }}</div>
                <span v-if="hasOverduePayments(c)" class="text-[9px] text-red-500 font-bold flex-shrink-0" title="有逾期未收款">$⚠</span>
              </div>
              <div v-if="deadlineInfo(c)" class="text-[9px] font-medium leading-none mt-0.5" :style="`color:${deadlineInfo(c).color}`">
                ⚑ {{ deadlineInfo(c).label }}
              </div>
            </div>
            <span class="w-16 text-center text-[11px] text-gray-500 flex-shrink-0">{{ c.assigneeName }}</span>
          </div>
          <!-- Work type sub-rows (when expanded) -->
          <div v-if="expanded[c.id]" class="bg-gray-50/50">
            <div v-if="!c.workTypes?.length" class="px-5 flex items-center border-t border-gray-100 text-[11px] text-gray-400" style="height:28px">
              尚無工種安排
            </div>
            <div v-for="wt in c.workTypes" :key="wt.id"
              class="px-3 flex items-center gap-2 border-t border-gray-100"
              style="height:28px"
              :class="wt.done ? 'bg-green-50/50' : ''">
              <span class="w-4"></span>
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="`background:${wt.color};opacity:${wt.done ? 0.4 : 1}`"></span>
              <span class="text-[11px] flex-1 truncate" :class="wt.done ? 'text-gray-400 line-through' : 'text-gray-600'">{{ wt.name }}</span>
              <span v-if="wt.done" class="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex-shrink-0 whitespace-nowrap">✓ 完工</span>
              <span v-else-if="wt.vendorName" class="text-[10px] text-gray-400 truncate max-w-[80px]">{{ wt.vendorName }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Scrollable 31-day grid -->
      <div class="flex-1 overflow-x-auto">
        <div :style="`min-width:${31 * 28}px`">
          <!-- Day headers -->
          <div class="bg-gray-50 border-b border-gray-200 flex" style="height:36px">
            <div v-for="d in 31" :key="d"
              class="flex-shrink-0 text-center text-[10px] border-r border-gray-100 flex items-center justify-center"
              style="width:28px"
              :class="d === todayDate ? 'font-bold' : 'text-gray-400'"
              :style="d === todayDate ? 'color:#c9a96e;background:rgba(201,169,110,0.1)' : ''">
              {{ d }}
            </div>
          </div>
          <!-- Case rows -->
          <template v-for="c in regionCases" :key="c.id">
            <div class="flex border-b border-gray-100 relative" style="height:36px"
              :style="selectedCaseId === c.id ? 'background:rgba(201,169,110,0.05)' : ''">
              <div v-for="d in 31" :key="d"
                class="flex-shrink-0 border-r border-gray-50" style="width:28px"
                :style="d === todayDate ? 'background:rgba(251,191,36,0.08)' : ''">
              </div>
              <!-- Case gantt bar -->
              <div v-if="c.ganttBar" class="absolute top-2 bottom-2 rounded opacity-80"
                :style="`left:${c.ganttBar.left}px;width:${c.ganttBar.width}px;background:${c.ganttBar.color}`">
              </div>
            </div>
            <!-- Work type sub-rows (when expanded) -->
            <template v-if="expanded[c.id]">
              <div v-if="!c.workTypes?.length" class="flex border-b border-gray-100" style="height:28px"></div>
              <div v-for="wt in c.workTypes" :key="wt.id"
                class="flex border-b border-gray-100 relative" style="height:28px">
                <div v-for="d in 31" :key="d"
                  class="flex-shrink-0 border-r border-gray-50" style="width:28px">
                </div>
                <div v-if="getWtGanttBar(wt, displayYear, displayMonth)"
                  class="absolute top-1 bottom-1 rounded"
                  :style="`left:${getWtGanttBar(wt, displayYear, displayMonth).left}px;width:${getWtGanttBar(wt, displayYear, displayMonth).width}px;background:${wt.done ? '#86efac' : wt.color};opacity:${wt.done ? 0.5 : 1}`">
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 flex items-center gap-3 flex-wrap">
      <span>今日：{{ currentMonthLabel }} 第 {{ todayDate }} 日</span>
      <div class="flex items-center gap-2 ml-2 flex-wrap">
        <span v-for="[status, color] in statusLegend" :key="status" class="flex items-center gap-1">
          <span class="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" :style="`background:${color}`"></span>
          <span>{{ STATUS_LABELS[status] }}</span>
        </span>
      </div>
    </div>

    <!-- Case action bar (when selected) -->
    <div v-if="selectedCaseId" class="px-4 pt-3 pb-2 border-t border-amber-100 bg-amber-50/40">
      <div class="text-sm font-bold text-gray-800 mb-2 leading-snug">{{ selectedCaseName }}</div>
      <div class="flex items-center gap-2 flex-wrap">
        <button @click="editingCaseId = selectedCaseId"
          class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white">
          ✎ 編輯案件
        </button>
        <button @click="copyCase"
          class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white">
          ⧉ 複製案件
        </button>
      </div>
    </div>

    <!-- Work type panel (when expanded) -->
    <WorkTypePanel v-if="selectedCaseId" :key="selectedCaseId" :case-id="selectedCaseId" :case-name="selectedCaseName" />

    <!-- Payment milestones panel (when selected) -->
    <PaymentMilestones v-if="selectedCaseId" :case-id="selectedCaseId" :case-name="selectedCaseName" />

    <!-- Photo upload section (when expanded) -->
    <PhotoUpload v-if="expandedCaseId" :case-id="expandedCaseId" :case-name="expandedCaseName" />

    <!-- Case tasks section (when selected) -->
    <CaseTasks v-if="selectedCaseId" :case-id="selectedCaseId" :case-name="selectedCaseName" />

    <!-- Case review section (when selected) -->
    <CaseReview v-if="selectedCaseId" :key="`review-${selectedCaseId}`" :case-id="selectedCaseId" :case-name="selectedCaseName" />
  </div>

  <!-- Case edit modal -->
  <CaseEditModal v-if="editingCaseId" :case-id="editingCaseId" @close="editingCaseId = null" />
</template>
<script setup>
import { ref, computed, reactive, watch, onUnmounted } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { useCaseTasksStore } from '@/stores/caseTasks'
import { deadlineInfo } from '@/composables/useDeadlineInfo'
import { useToast } from '@/composables/useToast'
import PhotoUpload from './PhotoUpload.vue'
import CaseTasks from './CaseTasks.vue'
import CaseReview from './CaseReview.vue'
import WorkTypePanel from './WorkTypePanel.vue'
import PaymentMilestones from './PaymentMilestones.vue'
import CaseEditModal from './CaseEditModal.vue'

const TODAY_STR = new Date().toISOString().slice(0, 10)

function hasOverduePayments(c) {
    return c.paymentMilestones?.some(m =>
        m.dueDate && m.dueDate < TODAY_STR && (m.paidAmount ?? 0) < (m.amount ?? 0)
    ) ?? false
}

const props = defineProps({ region: String, month: String, jumpCaseId: String })
const emit = defineEmits(['jumped'])
const casesStore = useCasesStore()
const tasksStore = useCaseTasksStore()
const { toast } = useToast()

const expanded = reactive({})
const expandedCaseId = ref(null)
const expandedCaseName = ref('')
const selectedCaseId = ref(null)
const selectedCaseName = ref('')
const editingCaseId = ref(null)
const todayDate = new Date().getDate()

const displayYear = computed(() => props.month ? Number(props.month.split('-')[0]) : new Date().getFullYear())
const displayMonth = computed(() => props.month ? Number(props.month.split('-')[1]) : new Date().getMonth() + 1)

const currentMonthLabel = computed(() => `${displayYear.value}年${displayMonth.value}月`)

function getWtGanttBar(wt, year, month) {
    if (!wt.startDate) return null
    const [sy, sm, sd] = wt.startDate.split('-').map(Number)
    const endStr = wt.endDate || wt.startDate
    const [ey, em, ed] = endStr.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    if ((sy > year || (sy === year && sm > month)) || (ey < year || (ey === year && em < month))) return null
    const startDay = (sy === year && sm === month) ? sd : 1
    const endDay = (ey === year && em === month) ? ed : daysInMonth
    return {
        left: (startDay - 1) * 28,
        width: Math.max(28, (endDay - startDay + 1) * 28),
        color: wt.color
    }
}

function selectCase(id) {
    expanded[id] = !expanded[id]
    const c = casesStore.cases.find(x => x.id === id)

    if (expanded[id]) {
        expandedCaseId.value = id
        expandedCaseName.value = c?.name ?? ''
        selectedCaseId.value = id
        selectedCaseName.value = c?.name ?? ''
        tasksStore.subscribe(id)
    } else {
        if (expandedCaseId.value === id) expandedCaseId.value = null
        if (selectedCaseId.value === id) {
            selectedCaseId.value = null
            selectedCaseName.value = ''
            tasksStore.cleanup()
        }
    }
}

watch(() => props.jumpCaseId, (id) => {
    if (!id) return
    const c = casesStore.cases.find(x => x.id === id)
    if (!c) return
    if (!expanded[id]) selectCase(id)
    emit('jumped')
})

const ALL_STATUSES = ['pending', 'negotiating', 'drafting', 'construction', 'pending_settlement', 'aftercare', 'completed', 'lost']
const activeStatuses = ref(new Set(ALL_STATUSES))

function toggleStatus(s) {
    if (activeStatuses.value.size === ALL_STATUSES.length) {
        activeStatuses.value = new Set([s])
    } else if (activeStatuses.value.size === 1 && activeStatuses.value.has(s)) {
        activeStatuses.value = new Set(ALL_STATUSES)
    } else {
        const next = new Set(activeStatuses.value)
        if (next.has(s)) next.delete(s)
        else next.add(s)
        activeStatuses.value = next
    }
}

const STATUS_BAR_COLORS = {
    negotiating: '#c9a96e',
    pending: '#94a3b8',
    drafting: '#f472b6',
    construction: '#3b82f6',
    pending_settlement: '#f97316',
    aftercare: '#a855f7',
    completed: '#22c55e',
    lost: '#ef4444',
}
const STATUS_LABELS = {
    pending: '待約', negotiating: '洽談中', drafting: '製圖中', construction: '施工中',
    pending_settlement: '待結算', aftercare: '售後', completed: '已完工', lost: '未成案',
}
const statusLegend = Object.entries(STATUS_BAR_COLORS)

const STATUS_ORDER = ['construction', 'negotiating', 'pending', 'drafting', 'pending_settlement', 'lost', 'aftercare', 'completed']

function getCaseGanttBar(c, year, month) {
    if (!c.startDate) return null
    const start = c.startDate.toDate?.() ?? new Date(c.startDate)
    const end = c.endDate ? (c.endDate.toDate?.() ?? new Date(c.endDate)) : start
    const daysInMonth = new Date(year, month, 0).getDate()
    const sy = start.getFullYear(), sm = start.getMonth() + 1
    const ey = end.getFullYear(), em = end.getMonth() + 1
    if ((sy > year || (sy === year && sm > month)) || (ey < year || (ey === year && em < month))) return null
    const startDay = (sy === year && sm === month) ? start.getDate() : 1
    const endDay = (ey === year && em === month) ? end.getDate() : daysInMonth
    return {
        left: (startDay - 1) * 28,
        width: Math.max(28, (endDay - startDay + 1) * 28),
        color: STATUS_BAR_COLORS[c.status] ?? '#c9a96e'
    }
}

const regionCases = computed(() =>
    casesStore.cases
        .filter(c => c.companyId === props.region && activeStatuses.value.has(c.status))
        .map(c => ({ ...c, ganttBar: getCaseGanttBar(c, displayYear.value, displayMonth.value) }))
        .sort((a, b) => {
            const si = STATUS_ORDER.indexOf(a.status)
            const sj = STATUS_ORDER.indexOf(b.status)
            if (si !== sj) return si - sj
            const at = a.createdAt?.toMillis?.() ?? 0
            const bt = b.createdAt?.toMillis?.() ?? 0
            return at - bt
        })
)

async function copyCase() {
    const c = casesStore.cases.find(x => x.id === selectedCaseId.value)
    if (!c) return
    const workTypes = (c.workTypes ?? []).map(wt => ({
        ...wt,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2)
    }))
    const docRef = await casesStore.addCase({
        name: `${c.name}（複製）`,
        companyId: c.companyId,
        status: 'negotiating',
        assignees: c.assignees ?? [],
        assigneeName: c.assigneeName ?? '',
        assignedTo: c.assignedTo ?? '',
        address: c.address ?? '',
        estimatedAmount: 0,
        signedAmount: 0,
        workTypes,
    })
    toast('案件已複製，請補充資料')
    if (docRef?.id) {
        const newId = docRef.id
        if (selectedCaseId.value && selectedCaseId.value !== newId) {
            expanded[selectedCaseId.value] = false
        }
        expanded[newId] = true
        selectedCaseId.value = newId
        selectedCaseName.value = `${c.name}（複製）`
        expandedCaseId.value = newId
        expandedCaseName.value = `${c.name}（複製）`
        tasksStore.subscribe(newId)
        editingCaseId.value = newId
    }
}

onUnmounted(() => tasksStore.cleanup())
</script>
