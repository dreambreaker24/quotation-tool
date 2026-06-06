<template>
  <CaseSidebar :model-value="selectedRegion" @select-region="selectedRegion = $event" @select-case="jumpToCase" />
  <main class="flex-1 flex flex-col overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-6 flex items-center gap-1 flex-shrink-0">
      <button v-for="tab in tabs" :key="tab.id"
        @click="switchTab(tab.id)"
        class="px-4 py-3 text-sm transition-colors relative"
        :class="activeTab === tab.id ? 'border-b-2 font-semibold' : 'text-gray-500 hover:text-gray-700'"
        :style="activeTab === tab.id ? 'border-color:#c9a96e;color:#c9a96e' : ''">
        {{ tab.label }}
        <span v-if="tab.id === 'announcement' && hasNewAnnouncement"
          class="absolute top-2 right-1 w-2 h-2 rounded-full bg-red-500"></span>
      </button>
      <div class="ml-auto flex items-center gap-2 py-2">
        <button @click="exportCases(casesStore.cases)" class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">匯出 Excel</button>
        <button @click="showAddCase = true" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 新增案件</button>
        <select v-model="selectedMonth" class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>
    <div class="flex-1 overflow-auto p-6">
      <CalendarTab v-if="activeTab === 'cal'" :region="selectedRegion" />
      <GanttTab v-else-if="activeTab === 'gantt'" :region="selectedRegion" :month="selectedMonth" :jump-case-id="jumpCaseId" @jumped="jumpCaseId = null" />
      <WorkJournalTab v-else-if="activeTab === 'log'" :region="selectedRegion" :pending-only="pendingOnly" />
      <AnnouncementTab v-else-if="activeTab === 'announcement'" />
    </div>
  </main>

  <AddCaseModal v-if="showAddCase" :region="selectedRegion"
    @close="showAddCase = false"
    @created="onCaseCreated" />
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useExport } from '@/composables/useExport'
import CaseSidebar from '@/components/cases/CaseSidebar.vue'
import CalendarTab from '@/components/cases/CalendarTab.vue'
import GanttTab from '@/components/cases/GanttTab.vue'
import WorkJournalTab from '@/components/cases/WorkJournalTab.vue'
import AnnouncementTab from '@/components/cases/AnnouncementTab.vue'
import AddCaseModal from '@/components/cases/AddCaseModal.vue'
import { useCasesStore } from '@/stores/cases'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { getDocs, collection, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/firebase'

const route = useRoute()
const validRegions = ['south', 'north', 'central']
const selectedRegion = ref(validRegions.includes(route.query.region) ? route.query.region : 'south')
const activeTab = ref('cal')
const jumpCaseId = ref(null)
const pendingOnly = computed(() => route.query.pendingOnly === 'true')

function jumpToCase(caseId) {
    activeTab.value = 'gantt'
    jumpCaseId.value = caseId
}
const showAddCase = ref(false)
const casesStore = useCasesStore()
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const { exportCases } = useExport()
const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

const tabs = [
    { id: 'cal', label: '行事曆' },
    { id: 'gantt', label: '案件進度' },
    { id: 'log', label: '工作日誌' },
    { id: 'announcement', label: '公司佈達' },
]

const hasNewAnnouncement = ref(false)

async function checkNewAnnouncement() {
    const lastRead = parseInt(localStorage.getItem('announcementLastRead') ?? '0')
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return
    const latestMs = snap.docs[0].data().createdAt?.toMillis?.() ?? 0
    hasNewAnnouncement.value = latestMs > lastRead
}

function switchTab(id) {
    activeTab.value = id
    if (id === 'announcement') {
        hasNewAnnouncement.value = false
        localStorage.setItem('announcementLastRead', Date.now().toString())
    }
}

function onCaseCreated({ caseId }) {
    showAddCase.value = false
    activeTab.value = 'gantt'
    jumpCaseId.value = caseId
}

onMounted(() => {
    casesStore.subscribe(['north', 'central', 'south'])
    clientsStore.subscribe(['north', 'central', 'south'])
    usersStore.subscribe()
    if (route.query.region && validRegions.includes(route.query.region)) selectedRegion.value = route.query.region
    if (route.query.tab) { const valid = ['cal', 'gantt', 'log', 'announcement']; if (valid.includes(route.query.tab)) switchTab(route.query.tab) }
    if (route.query.caseId) jumpToCase(route.query.caseId)
    checkNewAnnouncement()
})

watch(() => route.query.caseId, (id) => {
    if (id) jumpToCase(id)
})

watch(() => route.query.region, (r) => {
    if (r && validRegions.includes(r)) selectedRegion.value = r
})

watch(() => route.query.tab, (t) => {
    const valid = ['cal', 'gantt', 'log', 'announcement']
    if (t && valid.includes(t)) switchTab(t)
})

const monthOptions = computed(() => {
    let earliest = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    casesStore.cases.forEach(c => {
        const start = c.startDate?.toDate?.()
        if (start) {
            const startMonth = new Date(start.getFullYear(), start.getMonth(), 1)
            if (startMonth < earliest) earliest = startMonth
        }
    })
    const latest = new Date(now.getFullYear(), now.getMonth() + 2, 1)
    const opts = []
    const d = new Date(latest)
    while (d >= earliest) {
        opts.push({
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: `${d.getFullYear()}年 ${d.getMonth() + 1}月`
        })
        d.setMonth(d.getMonth() - 1)
    }
    return opts
})
</script>
