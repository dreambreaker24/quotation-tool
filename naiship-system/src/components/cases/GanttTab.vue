<template>
  <div class="lg:flex lg:items-start lg:gap-4">
  <div :class="panelMode === 'detailFull' ? 'lg:hidden' : 'lg:flex-1 lg:min-w-0'">
  <div class="bg-white rounded-2xl shadow-md overflow-hidden">
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
    <!-- Single scrollable container: left cell sticky, day grid scrolls -->
    <div class="overflow-x-auto" style="min-height:200px">
      <div :style="`min-width:${270 + 31 * 28 + 260}px`">
        <!-- Header row -->
        <div class="bg-gray-50 border-b border-gray-200 flex" style="height:36px">
          <div class="flex-shrink-0 sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 flex items-center gap-2" style="width:270px">
            <span class="flex-1 text-[11px] font-semibold text-gray-500">案件 / 工種</span>
            <span class="w-16 text-center text-[11px] font-semibold text-gray-500">負責人</span>
          </div>
          <div class="flex flex-shrink-0" style="width:868px">
            <div v-for="d in 31" :key="d"
              class="flex-shrink-0 text-center text-[10px] border-r border-gray-100 flex items-center justify-center"
              style="width:28px"
              :class="d === todayDate ? 'font-bold' : 'text-gray-400'"
              :style="d === todayDate ? 'color:#c9a96e;background:rgba(201,169,110,0.1)' : ''">
              {{ d }}
            </div>
          </div>
          <div class="flex-shrink-0 border-l-2 border-gray-200 flex items-center px-3" style="width:260px">
            <span class="text-[11px] font-semibold text-gray-500">💬 洽談進度</span>
          </div>
        </div>
        <!-- Case rows -->
        <template v-for="(row, idx) in ganttRows" :key="row.type === 'case' ? `case-${row.data.id}` : `${row.type}-${idx}`">
          <!-- 群組分隔列 -->
          <div v-if="row.type === 'group-sep'" class="flex" style="height:28px"
            :style="`background:${row.color}20`">
            <div class="flex-shrink-0 sticky left-0 z-10 px-4 flex items-center gap-2 border-r"
              style="width:270px"
              :style="`background:${row.color}30;border-color:${row.color}`">
              <span class="w-2 h-2 rounded-sm flex-shrink-0" :style="`background:${row.labelColor}`"></span>
              <span class="text-[10px] font-bold uppercase tracking-wide" :style="`color:${row.labelColor}`">{{ row.group }}</span>
            </div>
            <div class="flex-shrink-0" style="width:868px;border-top:2px solid;border-bottom:2px solid"
              :style="`border-color:${row.color}`"></div>
            <div class="flex-shrink-0" style="width:260px;border-left:2px solid #e5e7eb;border-top:2px solid;border-bottom:2px solid"
              :style="`border-top-color:${row.color};border-bottom-color:${row.color}`"></div>
          </div>

          <!-- 狀態間距列 -->
          <div v-else-if="row.type === 'status-gap'" class="flex" style="height:8px;background:#fafafa;border-bottom:1px dashed #f0f0f0">
            <div class="flex-shrink-0 sticky left-0 z-10" style="width:270px;background:#fafafa;border-right:1px solid #e5e7eb"></div>
            <div class="flex-shrink-0" style="width:868px"></div>
            <div class="flex-shrink-0" style="width:260px;border-left:2px solid #e5e7eb"></div>
          </div>

          <!-- 案件列 -->
          <template v-else-if="row.type === 'case'">
            <div :id="'case-row-' + row.data.id" class="flex border-b border-gray-100" style="min-height:44px"
              :style="[row.isEnded ? 'opacity:0.55' : '', selectedCaseId === row.data.id ? 'background:rgba(201,169,110,0.05)' : ''].filter(Boolean).join(';')">
              <div @click="selectCase(row.data.id)"
                class="flex-shrink-0 sticky left-0 z-10 border-r border-gray-200 px-3 flex items-center gap-2 cursor-pointer transition-colors"
                style="width:270px"
                :style="`border-left:3px solid ${STATUS_BAR_COLORS[row.data.status] ?? '#e5e7eb'};background:${selectedCaseId === row.data.id ? 'rgba(201,169,110,0.12)' : 'white'}`">
                <span class="text-gray-400 text-[10px] w-4 flex-shrink-0 select-none">{{ expanded[row.data.id] ? '▼' : '▶' }}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1 min-w-0">
                    <div class="text-xs font-semibold truncate" :title="row.data.name"
                      :style="selectedCaseId === row.data.id ? 'color:#c9a96e' : 'color:#1f2937'">{{ row.data.name }}</div>
                    <span v-if="hasOverduePayments(row.data)" class="text-[9px] text-red-500 font-bold flex-shrink-0" title="有逾期未收款">$⚠</span>
                  </div>
                  <div class="text-[9px] text-gray-400 truncate leading-none mt-0.5">
                    <span :class="row.data.addressDistrict ? '' : 'italic opacity-60'">{{ row.data.addressDistrict || '未填寫地址' }}</span>
                    <span class="mx-0.5">·</span>
                    <span :class="linkedClientName(row.data) ? '' : 'italic opacity-60'">{{ linkedClientName(row.data) || '未關聯客戶' }}</span>
                  </div>
                  <div v-if="deadlineInfo(row.data)" class="mt-0.5">
                    <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      :style="`color:${deadlineInfo(row.data).color};background:${deadlineInfo(row.data).bg}`">
                      ⚑ {{ deadlineInfo(row.data).label }}
                    </span>
                  </div>
                </div>
                <span class="w-16 text-center text-[11px] text-gray-500 flex-shrink-0">{{ row.data.assigneeName }}</span>
              </div>
              <div class="relative flex flex-shrink-0" style="width:868px">
                <div v-for="d in 31" :key="d"
                  class="flex-shrink-0 border-r border-gray-50" style="width:28px"
                  :style="d === todayDate ? 'background:rgba(251,191,36,0.08)' : ''">
                </div>
                <div v-if="row.data.ganttBar" class="absolute top-2 bottom-2 rounded opacity-80 pointer-events-none"
                  :style="`left:${row.data.ganttBar.left}px;width:${row.data.ganttBar.width}px;background:${row.data.ganttBar.color}`">
                </div>
                <div v-else class="absolute inset-0 flex items-center pl-2 text-[10px] text-gray-300 italic pointer-events-none">尚未排程</div>
              </div>
              <!-- 備注欄 -->
              <div class="flex-shrink-0 flex items-center px-3 gap-2"
                style="width:260px;border-left:2px solid #e5e7eb"
                :class="['negotiating','pending'].includes(row.data.status) ? 'cursor-pointer' : ''"
                @click="['negotiating','pending'].includes(row.data.status) ? selectCase(row.data.id) : null">
                <template v-if="['negotiating','pending'].includes(row.data.status)">
                  <span v-if="row.data.latestNote?.text"
                    class="flex-1 text-[10px] text-gray-500 truncate">{{ row.data.latestNote.text }}</span>
                  <span v-else class="flex-1 text-[10px]" style="color:#c9a96e">尚無備注</span>
                  <span class="text-[11px] border rounded px-1 flex-shrink-0"
                    style="color:#c9a96e;border-color:#c9a96e;line-height:1.6">+</span>
                </template>
                <span v-else class="text-[10px] text-gray-300">—</span>
              </div>
            </div>
            <!-- 工種子列 -->
            <template v-if="expanded[row.data.id]">
              <div v-if="!row.data.workTypes?.length" class="flex border-b border-gray-100" style="height:28px">
                <div class="flex-shrink-0 sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-5 flex items-center text-[11px] text-gray-400" style="width:270px">
                  尚無工種安排
                </div>
                <div class="flex-shrink-0" style="width:868px"></div>
                <div class="flex-shrink-0" style="width:260px;border-left:2px solid #e5e7eb"></div>
              </div>
              <div v-for="wt in row.data.workTypes" :key="wt.id"
                class="flex border-b border-gray-100" style="height:28px"
                :class="wt.done ? 'bg-green-50/50' : 'bg-gray-50/50'">
                <div class="flex-shrink-0 sticky left-0 z-10 border-r border-gray-200 px-3 flex items-center gap-2"
                  style="width:270px"
                  :style="wt.done ? 'background:#f0fdf4' : 'background:#f9fafb'">
                  <span class="w-4"></span>
                  <span class="w-2 h-2 rounded-full flex-shrink-0" :style="`background:${wt.color};opacity:${wt.done ? 0.4 : 1}`"></span>
                  <span class="text-[10px] flex-1 truncate" :class="wt.done ? 'text-gray-400 line-through' : 'text-gray-500'">{{ wt.name }}</span>
                  <span v-if="wt.done" class="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex-shrink-0 whitespace-nowrap">✓ 完工</span>
                  <template v-else>
                    <span v-if="isWtOverdue(wt, row.data)" class="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold flex-shrink-0 whitespace-nowrap">⚠ 逾期</span>
                    <span v-else-if="wt.vendorName" class="text-[10px] text-gray-400 truncate max-w-[80px]">{{ wt.vendorName }}</span>
                  </template>
                </div>
                <div class="relative flex flex-shrink-0" style="width:868px">
                  <div v-for="d in 31" :key="d" class="flex-shrink-0 border-r border-gray-50" style="width:28px"></div>
                  <div v-if="getWtGanttBar(wt, displayYear, displayMonth)"
                    class="absolute top-1 bottom-1 rounded pointer-events-none"
                    :style="`left:${getWtGanttBar(wt, displayYear, displayMonth).left}px;width:${getWtGanttBar(wt, displayYear, displayMonth).width}px;background:${wt.done ? '#86efac' : wt.color};opacity:${wt.done ? 0.5 : 1}`">
                  </div>
                </div>
                <div class="flex-shrink-0" style="width:260px;border-left:2px solid #e5e7eb"></div>
              </div>
            </template>
          </template>
        </template>
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
  </div>
  </div>

  <!-- Collapse toggle：左右兩顆按鈕，各自負責讓其中一側全展開。
       箭頭方向照直覺對應：往左的箭頭＝右側（案件詳情）要展開，往右的箭頭＝左側（甘特圖）要展開 -->
  <div v-if="selectedCaseId"
    class="hidden lg:flex lg:flex-col items-center justify-start gap-1.5 flex-shrink-0 w-6 rounded-lg transition-colors pt-16"
    style="align-self:stretch;background:#eeebe4">
    <button @click="panelMode = panelMode === 'ganttFull' ? 'both' : 'ganttFull'"
      class="w-6 h-9 rounded-lg flex items-center justify-center bg-white border shadow-sm hover:shadow-md transition-shadow"
      :class="panelMode === 'ganttFull' ? 'border-amber-400' : 'border-gray-300 hover:border-gray-400'"
      :title="panelMode === 'ganttFull' ? '恢復左右並排' : '甘特圖全展開'">
      <span class="text-sm font-bold" style="color:#c9a96e">»</span>
    </button>
    <button @click="panelMode = panelMode === 'detailFull' ? 'both' : 'detailFull'"
      class="w-6 h-9 rounded-lg flex items-center justify-center bg-white border shadow-sm hover:shadow-md transition-shadow"
      :class="panelMode === 'detailFull' ? 'border-amber-400' : 'border-gray-300 hover:border-gray-400'"
      :title="panelMode === 'detailFull' ? '恢復左右並排' : '案件詳情全展開'">
      <span class="text-sm font-bold" style="color:#c9a96e">«</span>
    </button>
  </div>

  <!-- Case detail panel -->
  <div v-if="selectedCaseId" ref="caseDetailRef"
    class="mt-3 lg:mt-0 lg:sticky lg:top-0 lg:max-h-[calc(100vh-150px)] lg:overflow-y-auto bg-white rounded-2xl shadow-md"
    :class="panelMode === 'ganttFull' ? 'lg:w-0 lg:opacity-0 lg:pointer-events-none lg:overflow-hidden' : panelMode === 'detailFull' ? 'lg:flex-1' : 'lg:w-[640px] lg:flex-shrink-0'">

    <!-- Action bar -->
    <div class="px-4 pt-3 pb-2 border-b border-amber-100 bg-amber-50/40 rounded-t-2xl">
      <div class="text-sm font-bold text-gray-800 mb-2 leading-snug pl-3 border-l-4" style="border-left-color:#c9a96e">{{ selectedCaseName }}</div>
      <div class="flex items-center gap-2 flex-wrap">
        <button @click="editingCaseId = selectedCaseId"
          class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white">
          ✎ 編輯案件
        </button>
        <button v-if="authStore.isManager" @click="copyCase"
          class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white">
          ⧉ 複製案件
        </button>
        <button v-if="authStore.isManager && selectedCaseStatus !== 'completed' && selectedCaseStatus !== 'lost'"
          @click="markCaseComplete"
          class="text-xs px-3 py-1.5 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
          style="background:#22c55e">
          ✓ 案件完成
        </button>
        <span v-else-if="selectedCaseStatus === 'completed'"
          class="text-xs px-3 py-1.5 rounded-lg font-medium"
          style="background:#dcfce7;color:#15803d">
          ✓ 已完工
        </span>
      </div>
    </div>

    <!-- Sticky tab bar -->
    <div class="relative sticky top-0 z-10 bg-white">
      <div class="flex border-b border-gray-100 overflow-x-auto" style="scrollbar-width:none">
        <button v-for="tab in availableTabs" :key="tab.key"
          @click="selectedTab = tab.key"
          class="flex-shrink-0 text-[11px] px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5"
          :class="selectedTab === tab.key
            ? 'border-[#c9a96e] text-[#c9a96e] bg-amber-50/30'
            : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'">
          {{ tab.label }}
          <span v-if="tab.key === 'tasks' && openTaskCount > 0"
            class="text-[9px] min-w-[16px] h-4 px-1 rounded-full text-white leading-4 text-center font-bold"
            style="background:#c9a96e">
            {{ openTaskCount }}
          </span>
        </button>
      </div>
      <div class="absolute right-0 top-0 bottom-0 w-10 pointer-events-none"
        style="background:linear-gradient(to right, transparent, white)"></div>
    </div>

    <CaseProgressNotes
      v-if="selectedTab === 'notes'"
      :key="`notes-${selectedCaseId}`"
      :case-id="selectedCaseId"
      :case-name="selectedCaseName"
      :company-id="selectedCaseCompanyId"
    />
    <BidRequestPanel v-if="selectedTab === 'bidding'" :key="`bid-${selectedCaseId}`" :case-id="selectedCaseId" :case-name="selectedCaseName" />
    <WorkTypePanel v-if="selectedTab === 'worktype'" :key="`wt-${selectedCaseId}`" :case-id="selectedCaseId" :case-name="selectedCaseName" :company-id="selectedCaseCompanyId" />
    <PaymentMilestones v-if="selectedTab === 'payment'" :case-id="selectedCaseId" :case-name="selectedCaseName" :company-id="selectedCaseCompanyId" />
    <PhotoUpload v-if="selectedTab === 'photo'" :case-id="selectedCaseId" :case-name="selectedCaseName" :company-id="selectedCaseCompanyId" />
    <CaseTasks v-if="selectedTab === 'tasks'" :case-id="selectedCaseId" :case-name="selectedCaseName" :company-id="selectedCaseCompanyId" />
    <CaseReview v-if="selectedTab === 'review'" :key="`review-${selectedCaseId}`" :case-id="selectedCaseId" :case-name="selectedCaseName" :company-id="selectedCaseCompanyId" />
  </div>
  </div>

  <!-- Case edit modal -->
  <CaseEditModal v-if="editingCaseId" :case-id="editingCaseId" @close="editingCaseId = null" />
</template>
<script setup>
import { ref, computed, reactive, watch, onUnmounted, nextTick } from 'vue'
import { CASE_STATUS_LABELS as STATUS_LABELS, CASE_STATUS_COLORS as STATUS_BAR_COLORS } from '@/constants/caseStatus'
import { useCasesStore } from '@/stores/cases'
import { useCaseTasksStore } from '@/stores/caseTasks'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { useNotificationsStore } from '@/stores/notifications'
import { deadlineInfo } from '@/composables/useDeadlineInfo'
import { useToast } from '@/composables/useToast'
import PhotoUpload from './PhotoUpload.vue'
import CaseTasks from './CaseTasks.vue'
import CaseReview from './CaseReview.vue'
import CaseProgressNotes from './CaseProgressNotes.vue'
import BidRequestPanel from './BidRequestPanel.vue'
import WorkTypePanel from './WorkTypePanel.vue'
import PaymentMilestones from './PaymentMilestones.vue'
import CaseEditModal from './CaseEditModal.vue'

const TODAY_STR = new Date().toISOString().slice(0, 10)

function hasOverduePayments(c) {
    return c.paymentMilestones?.some(m =>
        m.dueDate && m.dueDate < TODAY_STR && (m.paidAmount ?? 0) < (m.amount ?? 0)
    ) ?? false
}

function isWtOverdue(wt, c) {
    if (!wt.endDate || wt.done) return false
    if (c.status === 'completed' || c.status === 'lost') return false
    return wt.endDate < TODAY_STR
}

const props = defineProps({ region: String, month: String, jumpCaseId: String, jumpCaseTab: String })
const emit = defineEmits(['jumped'])
const casesStore = useCasesStore()
const tasksStore = useCaseTasksStore()
const authStore = useAuthStore()
const clientsStore = useClientsStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

function linkedClientName(c) {
    if (!c.linkedClientId) return ''
    return clientsStore.clients.find(cl => cl.id === c.linkedClientId)?.name ?? ''
}

const expanded = reactive({})
const expandedCaseId = ref(null)
const expandedCaseName = ref('')
const selectedCaseId = ref(null)
const selectedCaseName = ref('')
const selectedCaseCompanyId = ref('')
const panelMode = ref('both') // 'both' | 'ganttFull' | 'detailFull'
const editingCaseId = ref(null)
const selectedTab = ref('worktype')
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
    const willExpand = !expanded[id]
    // 展開新案件前先收合其他所有案件
    if (willExpand) Object.keys(expanded).forEach(k => { expanded[k] = false })
    expanded[id] = willExpand
    const c = casesStore.cases.find(x => x.id === id)

    if (expanded[id]) {
        expandedCaseId.value = id
        expandedCaseName.value = c?.name ?? ''
        selectedCaseId.value = id
        selectedCaseName.value = c?.name ?? ''
        selectedCaseCompanyId.value = c?.companyId ?? ''
        tasksStore.subscribe(id)
    } else {
        if (expandedCaseId.value === id) expandedCaseId.value = null
        if (selectedCaseId.value === id) {
            selectedCaseId.value = null
            selectedCaseName.value = ''
            selectedCaseCompanyId.value = ''
            tasksStore.cleanup()
        }
    }
}

watch([() => props.jumpCaseId, () => casesStore.cases], ([id]) => {
    if (!id) return
    const c = casesStore.cases.find(x => x.id === id)
    if (!c) return
    const jumpTab = props.jumpCaseTab  // 在 emit 清掉 prop 前先捕捉
    if (!expanded[id]) selectCase(id)
    emit('jumped')
    // nextTick 確保在 watch(selectedCaseId) 把 tab 重設為 'worktype' 之後再覆蓋
    nextTick(() => {
        if (jumpTab) {
            const validTab = CASE_TABS.find(t => t.key === jumpTab)
            if (validTab) selectedTab.value = jumpTab
        }
        document.getElementById('case-row-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
}, { immediate: true })

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

const statusLegend = Object.entries(STATUS_BAR_COLORS)

const GROUPS = [
    { name: '進行工程', statuses: ['construction', 'drafting'], color: '#bfdbfe', labelColor: '#3b82f6' },
    { name: '開發客戶', statuses: ['negotiating', 'pending'], color: '#fde68a', labelColor: '#c9a96e' },
    { name: '收尾結算', statuses: ['pending_settlement', 'aftercare'], color: '#fed7aa', labelColor: '#f97316' },
    { name: '已結束', statuses: ['completed', 'lost'], color: '#e5e7eb', labelColor: '#9ca3af' },
]
const STATUS_ORDER = ['construction', 'drafting', 'negotiating', 'pending', 'pending_settlement', 'aftercare', 'completed', 'lost']

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

const ganttRows = computed(() => {
    const sorted = casesStore.cases
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

    const rows = []
    for (const group of GROUPS) {
        const groupCases = sorted.filter(c => group.statuses.includes(c.status))
        if (groupCases.length === 0) continue
        rows.push({ type: 'group-sep', group: group.name, color: group.color, labelColor: group.labelColor, isEnded: group.name === '已結束' })
        for (let i = 0; i < groupCases.length; i++) {
            if (i > 0 && groupCases[i - 1].status !== groupCases[i].status) {
                rows.push({ type: 'status-gap' })
            }
            rows.push({ type: 'case', data: groupCases[i], isEnded: group.name === '已結束' })
        }
    }
    return rows
})

const selectedCaseStatus = computed(() =>
    casesStore.cases.find(x => x.id === selectedCaseId.value)?.status ?? ''
)

const caseDetailRef = ref(null)

const CASE_TABS = [
    { key: 'bidding',  label: '廠商比價' },
    { key: 'worktype', label: '工程安排' },
    { key: 'photo',    label: '檔案管理' },
    { key: 'tasks',    label: '交辦事項' },
    { key: 'notes',    label: '洽談備注' },
    { key: 'payment',  label: '收款期程' },
    { key: 'review',   label: '案件檢討' },
]

const availableTabs = computed(() => {
    const isNeg = ['negotiating', 'pending'].includes(selectedCaseStatus.value)
    return CASE_TABS.filter(t => t.key !== 'notes' || isNeg)
})

const openTaskCount = computed(() => tasksStore.tasks.filter(t => !t.done && (t.type === 'client' || t.type === 'manager')).length)

watch(selectedCaseId, async (newId) => {
    selectedTab.value = 'worktype'
    if (newId) {
        await nextTick()
        caseDetailRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
})

async function markCaseComplete() {
    const c = casesStore.cases.find(x => x.id === selectedCaseId.value)
    if (!c) return
    if (!confirm(`確定要將「${c.name}」標記為已完工？`)) return
    await casesStore.updateCase(selectedCaseId.value, { status: 'completed' })
    notifStore.notifyAll(authStore.name ?? '', `已將「${c.name}」標記為完工`, selectedCaseId.value, c.name, c.companyId)
    toast(`「${c.name}」已標記為已完工`)
}

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
        addressCity: c.addressCity ?? '',
        addressDistrict: c.addressDistrict ?? '',
        addressStreet: c.addressStreet ?? '',
        estimatedAmount: 0,
        signedAmount: 0,
        workTypes,
    })
    const newCaseName = `${c.name}（複製）`
    notifStore.notifyAll(authStore.name ?? '', `新增了案件「${newCaseName}」`, docRef?.id ?? '', newCaseName, c.companyId)
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
