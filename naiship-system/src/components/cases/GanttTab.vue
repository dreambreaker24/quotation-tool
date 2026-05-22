<template>
  <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
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
            :style="selectedCaseId === c.id ? 'background:rgba(201,169,110,0.12);border-left:2px solid #c9a96e' : ''">
            <span class="text-gray-400 text-[10px] w-4 select-none">{{ expanded[c.id] ? '▼' : '▶' }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold truncate"
                :style="selectedCaseId === c.id ? 'color:#c9a96e' : 'color:#1f2937'">{{ c.name }}</div>
              <div v-if="deadlineInfo(c)" class="text-[9px] font-medium" :style="`color:${deadlineInfo(c).color}`">
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
              class="px-3 flex items-center gap-2 border-t border-gray-100" style="height:28px">
              <span class="w-4"></span>
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="`background:${wt.color}`"></span>
              <span class="text-[11px] text-gray-600 flex-1 truncate">{{ wt.name }}</span>
              <span v-if="wt.vendorName" class="text-[10px] text-gray-400 truncate max-w-[80px]">{{ wt.vendorName }}</span>
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
                  :style="`left:${getWtGanttBar(wt, displayYear, displayMonth).left}px;width:${getWtGanttBar(wt, displayYear, displayMonth).width}px;background:${wt.color}`">
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>

    <!-- Today legend -->
    <div class="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500">
      今日：{{ currentMonthLabel }} 第 {{ todayDate }} 日
    </div>

    <!-- Case action bar (when selected) -->
    <div v-if="selectedCaseId" class="px-4 py-2 border-t border-gray-100 flex items-center gap-2">
      <button @click="editingCaseId = selectedCaseId"
        class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
        ✎ 編輯案件
      </button>
      <button @click="copyCase"
        class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
        ⧉ 複製案件
      </button>
    </div>

    <!-- Work type panel (when expanded) -->
    <WorkTypePanel v-if="selectedCaseId" :case-id="selectedCaseId" :case-name="selectedCaseName" />

    <!-- Payment milestones panel (when selected) -->
    <PaymentMilestones v-if="selectedCaseId" :case-id="selectedCaseId" :case-name="selectedCaseName" />

    <!-- Photo upload section (when expanded) -->
    <PhotoUpload v-if="expandedCaseId" :case-id="expandedCaseId" :case-name="expandedCaseName" />

    <!-- Case tasks section (when selected) -->
    <CaseTasks v-if="selectedCaseId" :case-id="selectedCaseId" :case-name="selectedCaseName" />
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
import WorkTypePanel from './WorkTypePanel.vue'
import PaymentMilestones from './PaymentMilestones.vue'
import CaseEditModal from './CaseEditModal.vue'

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
        color: '#c9a96e'
    }
}

const regionCases = computed(() =>
    casesStore.cases
        .filter(c => c.companyId === props.region)
        .map(c => ({ ...c, ganttBar: getCaseGanttBar(c, displayYear.value, displayMonth.value) }))
)

async function copyCase() {
    const c = casesStore.cases.find(x => x.id === selectedCaseId.value)
    if (!c) return
    const workTypes = (c.workTypes ?? []).map(wt => ({ ...wt, id: Date.now().toString(36) + Math.random().toString(36).slice(2) }))
    await casesStore.addCase({
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
    toast('案件已複製')
}

onUnmounted(() => tasksStore.cleanup())
</script>
