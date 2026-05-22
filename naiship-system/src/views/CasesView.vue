<template>
  <CaseSidebar :model-value="selectedRegion" @select-region="selectedRegion = $event" />
  <main class="flex-1 flex flex-col overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-6 flex items-center gap-1 flex-shrink-0">
      <button v-for="tab in tabs" :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-3 text-sm transition-colors"
        :class="activeTab === tab.id ? 'border-b-2 font-semibold' : 'text-gray-500 hover:text-gray-700'"
        :style="activeTab === tab.id ? 'border-color:#c9a96e;color:#c9a96e' : ''">
        {{ tab.label }}
      </button>
      <div class="ml-auto flex items-center gap-2 py-2">
        <button @click="showAddCase = true" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 新增案件</button>
        <select v-model="selectedMonth" class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>
    <div class="flex-1 overflow-auto p-6">
      <CalendarTab v-if="activeTab === 'cal'" :region="selectedRegion" />
      <GanttTab v-else-if="activeTab === 'gantt'" :region="selectedRegion" :month="selectedMonth" />
      <WorkJournalTab v-else-if="activeTab === 'log'" :region="selectedRegion" />
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
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">分區 *</label>
            <select v-model="caseForm.companyId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="south">奈拾南區</option>
              <option value="north">奈拾北區</option>
              <option value="central">奈拾中區</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">狀態 *</label>
            <select v-model="caseForm.status" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
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
              <input v-model="caseForm.assignees[idx]" type="text"
                class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
                :placeholder="`負責人 ${idx + 1}`">
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
import { ref, computed, onMounted } from 'vue'
import { Timestamp } from 'firebase/firestore'
import { useToast } from '@/composables/useToast'
import CaseSidebar from '@/components/cases/CaseSidebar.vue'
import CalendarTab from '@/components/cases/CalendarTab.vue'
import GanttTab from '@/components/cases/GanttTab.vue'
import WorkJournalTab from '@/components/cases/WorkJournalTab.vue'
import { useCasesStore } from '@/stores/cases'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'

const selectedRegion = ref('south')
const activeTab = ref('cal')
const showAddCase = ref(false)
const submitting = ref(false)
const casesStore = useCasesStore()
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const { toast } = useToast()
const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

const tabs = [
    { id: 'cal', label: '行事曆' },
    { id: 'gantt', label: '案件進度' },
    { id: 'log', label: '工作日誌' }
]

const blankCase = () => ({
    name: '', companyId: selectedRegion.value, assignees: [''], status: 'negotiating',
    estimatedAmount: 0, signedAmount: 0, startDate: '', endDate: '', signedDate: '',
    deadline: '', linkedClientId: ''
})
const caseForm = ref(blankCase())

onMounted(() => {
    const regions = authStore.isAdmin ? ['north', 'central', 'south'] : [authStore.companyId]
    clientsStore.subscribe(regions)
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

    const docRef = await casesStore.addCase(data)

    if (caseForm.value.linkedClientId && docRef?.id) {
        await clientsStore.updateClient(caseForm.value.linkedClientId, { linkedCaseId: docRef.id })
    }

    caseForm.value = blankCase()
    showAddCase.value = false
    submitting.value = false
    toast('案件已建立')
}

const monthOptions = computed(() => {
    const opts = []
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        opts.push({
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: `${d.getFullYear()}年 ${d.getMonth() + 1}月`
        })
    }
    return opts
})
</script>
