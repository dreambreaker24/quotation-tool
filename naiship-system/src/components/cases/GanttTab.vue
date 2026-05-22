<template>
  <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
    <div class="flex" style="min-height:200px">
      <!-- Fixed left panel (250px) -->
      <div class="flex-shrink-0 border-r border-gray-200" style="width:250px">
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
            <span class="flex-1 text-xs font-semibold truncate"
              :style="selectedCaseId === c.id ? 'color:#c9a96e' : 'color:#1f2937'">{{ c.name }}</span>
            <span class="w-16 text-center text-[11px] text-gray-500">{{ c.assigneeName }}</span>
          </div>
          <!-- Work type sub-rows (when expanded) -->
          <div v-if="expanded[c.id]" class="bg-gray-50/50">
            <div v-for="wt in (c._workTypes || defaultWorkTypes)" :key="wt.id"
              class="px-3 flex items-center gap-2 border-t border-gray-100" style="height:28px">
              <span class="w-4"></span>
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="`background:${wt.color}`"></span>
              <span class="text-[11px] text-gray-600">{{ wt.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Scrollable 31-day grid -->
      <div class="flex-1 overflow-x-auto">
        <div :style="`min-width:${31*28}px`">
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
              <div v-for="wt in (c._workTypes || defaultWorkTypes)" :key="wt.id"
                class="flex border-b border-gray-100 relative" style="height:28px">
                <div v-for="d in 31" :key="d"
                  class="flex-shrink-0 border-r border-gray-50" style="width:28px">
                </div>
                <div v-if="wt.ganttBar" class="absolute top-1 bottom-1 rounded"
                  :style="`left:${wt.ganttBar.left}px;width:${wt.ganttBar.width}px;background:${wt.color}`">
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

    <!-- Photo upload section (when expanded) -->
    <PhotoUpload v-if="expandedCaseId" :case-id="expandedCaseId" :case-name="expandedCaseName" />

    <!-- Case tasks section (when selected) -->
    <CaseTasks v-if="selectedCaseId" :case-id="selectedCaseId" :case-name="selectedCaseName" />
  </div>
</template>
<script setup>
import { ref, computed, reactive, watch, onUnmounted } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { useCaseTasksStore } from '@/stores/caseTasks'
import PhotoUpload from './PhotoUpload.vue'
import CaseTasks from './CaseTasks.vue'

const props = defineProps({ region: String, month: String })
const casesStore = useCasesStore()
const tasksStore = useCaseTasksStore()

const expanded = reactive({})
const expandedCaseId = ref(null)
const expandedCaseName = ref('')
const selectedCaseId = ref(null)
const selectedCaseName = ref('')
const todayDate = new Date().getDate()

const currentMonthLabel = computed(() => {
    const now = new Date()
    return `${now.getFullYear()}年${now.getMonth()+1}月`
})

const defaultWorkTypes = [
    { id: 'wt1', name: '水電', color: '#3b82f6', ganttBar: null },
    { id: 'wt2', name: '泥作', color: '#f59e0b', ganttBar: null }
]

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

function dayToLeft(day) { return (day - 1) * 28 }
function daysWidth(start, end) { return Math.max(28, (end - start + 1) * 28) }

const regionCases = computed(() =>
    casesStore.cases
        .filter(c => c.companyId === props.region)
        .map(c => {
            const startDay = c.startDate?.toDate?.().getDate()
            const endDay = c.endDate?.toDate?.().getDate()
            return {
                ...c,
                _workTypes: c.workTypes || null,
                ganttBar: startDay ? {
                    left: dayToLeft(startDay),
                    width: endDay ? daysWidth(startDay, endDay) : 56,
                    color: '#c9a96e'
                } : null
            }
        })
)

onUnmounted(() => tasksStore.cleanup())
</script>
