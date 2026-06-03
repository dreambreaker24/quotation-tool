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
      <WorkJournalTab v-else-if="activeTab === 'log'" :region="selectedRegion" />
      <AnnouncementTab v-else-if="activeTab === 'announcement'" />
    </div>
  </main>

  <!-- 新增案件 Modal -->
  <div v-if="showAddCase" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">新增案件</h3>
        <button @click="showAddCase = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">案件名稱 *</label>
          <input v-model="caseForm.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：台南東區翻新">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">施工地址</label>
          <input v-model="caseForm.address" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：台南市東區某路1號">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">分區 *</label>
            <select v-model="caseForm.companyId" :disabled="!authStore.isManager"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500">
              <option value="south">奈拾南區</option>
              <option value="north">奈拾北區</option>
              <option value="central">奈拾中區</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">狀態 *</label>
            <select v-model="caseForm.status" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="pending">待約客戶</option>
              <option value="negotiating">洽談中</option>
              <option value="drafting">製圖中</option>
              <option value="construction">施工中</option>
              <option value="pending_settlement">待結算</option>
              <option value="aftercare">售後</option>
              <option value="completed">已完工</option>
              <option value="lost">未成案</option>
            </select>
          </div>
        </div>

        <!-- 關聯客戶 -->
        <div>
          <label class="text-xs text-gray-500 mb-1 block">關聯客戶（選填）</label>
          <select v-model="caseForm.linkedClientId"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 不關聯客戶 —</option>
            <option v-for="c in clientsForRegion" :key="c.id" :value="c.id">{{ c.name }}{{ c.phone ? ` · ${c.phone}` : '' }}</option>
          </select>
        </div>

        <div>
          <label class="text-xs text-gray-500 mb-1 block">負責人（最多 4 位）</label>
          <div class="flex flex-col gap-2">
            <div v-for="(a, idx) in caseForm.assignees" :key="idx" class="flex items-center gap-2">
              <select v-model="caseForm.assignees[idx]"
                class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option value="">— 選擇負責人 —</option>
                <option v-for="u in activeUsers" :key="u.id" :value="u.name">{{ u.name }}</option>
              </select>
              <button v-if="caseForm.assignees.length > 1" @click="caseForm.assignees.splice(idx, 1)"
                class="text-red-400 hover:text-red-600 px-1">✕</button>
            </div>
            <button v-if="caseForm.assignees.length < 4" @click="caseForm.assignees.push('')"
              class="text-xs text-left px-1" style="color:#c9a96e">+ 新增負責人</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">預估金額</label>
            <input v-model.number="caseForm.estimatedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">簽約金額</label>
            <input v-model.number="caseForm.signedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">開始日期</label>
            <input v-model="caseForm.startDate" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">結束日期（預估）</label>
            <input v-model="caseForm.endDate" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">簽約日期（選填）</label>
            <input v-model="caseForm.signedDate" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">完工期限（業主要求）</label>
            <input v-model="caseForm.deadline" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showAddCase = false; caseForm = blankCase()" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitCase" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">{{ submitting ? '建立中…' : '建立案件' }}</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Timestamp } from 'firebase/firestore'
import { useToast } from '@/composables/useToast'
import { useExport } from '@/composables/useExport'
import CaseSidebar from '@/components/cases/CaseSidebar.vue'
import CalendarTab from '@/components/cases/CalendarTab.vue'
import GanttTab from '@/components/cases/GanttTab.vue'
import WorkJournalTab from '@/components/cases/WorkJournalTab.vue'
import AnnouncementTab from '@/components/cases/AnnouncementTab.vue'
import { useCasesStore } from '@/stores/cases'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useNotificationsStore } from '@/stores/notifications'
import { getDocs, collection, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/firebase'

const route = useRoute()
const validRegions = ['south', 'north', 'central']
const selectedRegion = ref(validRegions.includes(route.query.region) ? route.query.region : 'south')
const activeTab = ref('cal')
const jumpCaseId = ref(null)

function jumpToCase(caseId) {
    activeTab.value = 'gantt'
    jumpCaseId.value = caseId
}
const showAddCase = ref(false)
const submitting = ref(false)
const casesStore = useCasesStore()
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const activeUsers = computed(() => usersStore.users.filter(u => !u.disabled))
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

const blankCase = () => ({
    name: '', address: '',
    companyId: authStore.isManager ? selectedRegion.value : (authStore.companyId || 'south'),
    assignees: [''], status: 'negotiating',
    estimatedAmount: 0, signedAmount: 0, startDate: '', endDate: '', signedDate: '',
    deadline: '', linkedClientId: ''
})
const caseForm = ref(blankCase())

onMounted(() => {
    casesStore.subscribe(['north', 'central', 'south'])
    clientsStore.subscribe(['north', 'central', 'south'])
    usersStore.subscribe()
    if (route.query.caseId) jumpToCase(route.query.caseId)
    checkNewAnnouncement()
})

watch(() => route.query.caseId, (id) => {
    if (id) jumpToCase(id)
})

watch(() => caseForm.value.linkedClientId, (clientId) => {
    if (!clientId) return
    const client = clientsStore.clients.find(c => c.id === clientId)
    if (!client?.assignedTo) return
    if (caseForm.value.assignees.some(a => a.trim())) return
    const user = usersStore.users.find(u => u.id === client.assignedTo)
    if (user?.name) caseForm.value.assignees = [user.name]
})

const clientsForRegion = computed(() =>
    clientsStore.clients.filter(c => c.companyId === caseForm.value.companyId)
)

async function submitCase() {
    if (!caseForm.value.name || submitting.value) return
    submitting.value = true
    const assignees = caseForm.value.assignees.filter(a => a.trim())
    const data = {
        name: caseForm.value.name,
        address: caseForm.value.address || '',
        companyId: caseForm.value.companyId,
        status: caseForm.value.status,
        estimatedAmount: caseForm.value.estimatedAmount || 0,
        signedAmount: caseForm.value.signedAmount || 0,
        assignees,
        assigneeName: assignees.join('、'),
        assignedTo: authStore.user?.uid ?? '',
        startDate: caseForm.value.startDate ? Timestamp.fromDate(new Date(caseForm.value.startDate)) : null,
        endDate: caseForm.value.endDate ? Timestamp.fromDate(new Date(caseForm.value.endDate)) : null,
        signedDate: caseForm.value.signedDate ? Timestamp.fromDate(new Date(caseForm.value.signedDate)) : null,
        deadline: caseForm.value.deadline ? Timestamp.fromDate(new Date(caseForm.value.deadline)) : null,
        linkedClientId: caseForm.value.linkedClientId || null,
    }
    if (!data.startDate) delete data.startDate
    if (!data.endDate) delete data.endDate
    if (!data.signedDate) delete data.signedDate
    if (!data.deadline) delete data.deadline
    if (!data.linkedClientId) delete data.linkedClientId

    try {
        const docRef = await casesStore.addCase(data)
        if (caseForm.value.linkedClientId && docRef?.id) {
            await clientsStore.updateClient(caseForm.value.linkedClientId, { linkedCaseId: docRef.id })
        }
        const newCaseName = data.name
        const newCaseId = docRef?.id ?? ''
        caseForm.value = blankCase()
        showAddCase.value = false
        activeTab.value = 'gantt'
        jumpCaseId.value = newCaseId
        toast('案件已建立')
        notifStore.notifyAll(authStore.name ?? '', `新增了案件「${newCaseName}」`, newCaseId, newCaseName)
    } catch {
        toast('建立失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

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
