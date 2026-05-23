<template>
  <div v-if="client" class="flex-1 p-6 overflow-auto">
    <div class="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-gray-800">{{ client.name }}</h2>
        <button v-if="!editing" @click="startEdit"
          class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">編輯</button>
        <div v-else class="flex gap-2">
          <button @click="editing = false" class="text-xs text-gray-400 px-3 py-1.5">取消</button>
          <button @click="saveEdit" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">儲存</button>
        </div>
      </div>

      <!-- 檢視模式 -->
      <div v-if="!editing" class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-400 text-xs block mb-0.5">電話</span><p class="text-gray-700">{{ client.phone || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">Email</span><p class="text-gray-700">{{ client.email || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">Line ID</span><p class="text-gray-700">{{ client.lineId || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">地址</span><p class="text-gray-700">{{ client.address || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">來源</span><p class="text-gray-700">{{ client.source || '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">預算</span><p class="text-gray-700">{{ client.budget ? `$${client.budget.toLocaleString()}` : '—' }}</p></div>
        <div><span class="text-gray-400 text-xs block mb-0.5">坪數</span><p class="text-gray-700">{{ client.area ? `${client.area} 坪` : '—' }}</p></div>
        <div>
          <span class="text-gray-400 text-xs block mb-0.5">下次跟進</span>
          <div class="flex items-center gap-2">
            <p class="text-gray-700">{{ client.followUpDate || '—' }}</p>
            <button v-if="client.followUpDate" @click="addToCalendar" :disabled="addingToCalendar"
              class="text-[10px] border border-purple-200 rounded px-1.5 py-0.5 text-purple-600 hover:bg-purple-50 disabled:opacity-50">
              {{ addingToCalendar ? '…' : '＋行事曆' }}
            </button>
          </div>
        </div>
        <div>
          <span class="text-gray-400 text-xs block mb-0.5">狀態</span>
          <select :value="client.status" @change="updateStatus($event.target.value)"
            class="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1">
            <option value="contacted">初次接觸</option>
            <option value="negotiating">洽談中</option>
            <option value="signed">已簽約</option>
            <option value="completed">已完工</option>
            <option value="lost">已流失</option>
          </select>
        </div>
        <div class="col-span-2">
          <span class="text-gray-400 text-xs block mb-0.5">連結案件</span>
          <p v-if="linkedCase" class="text-gray-700 flex items-center gap-2">
            {{ linkedCase.name }}
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{{ statusLabel(linkedCase.status) }}</span>
          </p>
          <p v-else class="text-gray-400">—</p>
        </div>
        <div v-if="client.status === 'lost'" class="col-span-2">
          <span class="text-gray-400 text-xs block mb-0.5">流失原因</span>
          <p class="text-gray-700">{{ client.lostReason || '—' }}</p>
        </div>
        <div class="col-span-2">
          <span class="text-gray-400 text-xs block mb-0.5">備注</span>
          <p class="text-gray-700 text-sm whitespace-pre-wrap">{{ client.memo || '—' }}</p>
        </div>
      </div>

      <!-- 編輯模式 -->
      <div v-else class="grid grid-cols-2 gap-3 text-sm">
        <div><label class="text-xs text-gray-400 block mb-0.5">姓名</label>
          <input v-model="editForm.name" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1"></div>
        <div><label class="text-xs text-gray-400 block mb-0.5">電話</label>
          <input v-model="editForm.phone" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1"></div>
        <div><label class="text-xs text-gray-400 block mb-0.5">Email</label>
          <input v-model="editForm.email" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1"></div>
        <div><label class="text-xs text-gray-400 block mb-0.5">Line ID</label>
          <input v-model="editForm.lineId" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1"></div>
        <div class="col-span-2"><label class="text-xs text-gray-400 block mb-0.5">地址</label>
          <input v-model="editForm.address" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1"></div>
        <div><label class="text-xs text-gray-400 block mb-0.5">來源</label>
          <select v-model="editForm.source" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1">
            <option v-for="s in sourceOptions" :key="s" :value="s">{{ s }}</option>
            <optgroup label="朋友介紹">
              <option v-for="name in employeeNames" :key="name" :value="name">{{ name }}</option>
            </optgroup>
            <option value="其他">其他</option>
            <option v-if="legacySource" :value="legacySource">{{ legacySource }}（舊）</option>
          </select></div>
        <div><label class="text-xs text-gray-400 block mb-0.5">狀態</label>
          <select v-model="editForm.status" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1">
            <option value="contacted">初次接觸</option><option value="negotiating">洽談中</option>
            <option value="signed">已簽約</option><option value="completed">已完工</option><option value="lost">已流失</option>
          </select></div>
        <div><label class="text-xs text-gray-400 block mb-0.5">預算</label>
          <input v-model.number="editForm.budget" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1"></div>
        <div><label class="text-xs text-gray-400 block mb-0.5">坪數</label>
          <input v-model.number="editForm.area" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1"></div>
        <div><label class="text-xs text-gray-400 block mb-0.5">下次跟進日期（選填）</label>
          <input v-model="editForm.followUpDate" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1"></div>
        <div class="col-span-2"><label class="text-xs text-gray-400 block mb-0.5">連結案件</label>
          <select v-model="editForm.linkedCaseId" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1">
            <option value="">— 不連結 —</option>
            <option v-for="c in casesStore.cases" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select></div>
        <div v-if="editForm.status === 'lost'" class="col-span-2">
          <label class="text-xs text-gray-400 block mb-0.5">流失原因</label>
          <input v-model="editForm.lostReason" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1">
        </div>
        <div class="col-span-2">
          <label class="text-xs text-gray-400 block mb-0.5">備注</label>
          <textarea v-model="editForm.memo" rows="3"
            class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 resize-none"
            placeholder="合作記錄、特殊需求、注意事項…"></textarea>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm p-6">
      <ClientContactLog :client-id="client.id" />
    </div>
  </div>
  <div v-else class="flex-1 flex items-center justify-center">
    <p class="text-sm text-gray-400">請從左側選擇客戶</p>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { Timestamp } from 'firebase/firestore'
import ClientContactLog from './ClientContactLog.vue'
import { useClientsStore } from '@/stores/clients'
import { useCasesStore } from '@/stores/cases'
import { useCalendarEventsStore } from '@/stores/calendarEvents'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useClientSources } from '@/composables/useClientSources'

const props = defineProps({ client: Object })
const clientsStore = useClientsStore()
const casesStore = useCasesStore()
const { sourceOptions, employeeNames, normalizeSource } = useClientSources()

const legacySource = computed(() => {
    const src = props.client?.source
    if (!src) return null
    const isKnown = sourceOptions.value.includes(src) || employeeNames.value.includes(src) || src === '其他'
    return isKnown ? null : src
})

const eventsStore = useCalendarEventsStore()
const authStore = useAuthStore()
const editing = ref(false)
const editForm = ref({})
const addingToCalendar = ref(false)
const { toast } = useToast()

async function addToCalendar() {
    if (!props.client?.followUpDate || addingToCalendar.value) return
    addingToCalendar.value = true
    try {
        await eventsStore.addEvent({
            companyId: props.client.companyId,
            type: 'followup',
            date: Timestamp.fromDate(new Date(props.client.followUpDate)),
            label: `跟進：${props.client.name}`,
            createdBy: authStore.user?.uid ?? '',
        })
        toast('已加入行事曆')
    } catch {
        toast('新增失敗，請重試', 'error')
    } finally {
        addingToCalendar.value = false
    }
}

const linkedCase = computed(() =>
  props.client?.linkedCaseId
    ? casesStore.cases.find(c => c.id === props.client.linkedCaseId) ?? null
    : null
)

const caseStatusMap = { negotiating:'洽談中', drafting:'製圖中', construction:'施工中', pending_settlement:'待結算', aftercare:'售後', completed:'已完工', lost:'未成案' }
function statusLabel(s) { return caseStatusMap[s] ?? s }

function startEdit() {
  editForm.value = {
    name: props.client.name ?? '',
    phone: props.client.phone ?? '',
    email: props.client.email ?? '',
    lineId: props.client.lineId ?? '',
    address: props.client.address ?? '',
    source: props.client.source ?? 'IG',
    status: props.client.status ?? 'contacted',
    budget: props.client.budget ?? 0,
    area: props.client.area ?? 0,
    linkedCaseId: props.client.linkedCaseId ?? '',
    lostReason: props.client.lostReason ?? '',
    followUpDate: props.client.followUpDate ?? '',
    memo: props.client.memo ?? '',
  }
  editing.value = true
}

async function saveEdit() {
  try {
    await clientsStore.updateClient(props.client.id, { ...editForm.value })
    editing.value = false
    toast('客戶資料已更新')
  } catch {
    toast('儲存失敗，請重試', 'error')
  }
}

async function updateStatus(status) {
  try {
    await clientsStore.updateClient(props.client.id, { status })
  } catch {
    toast('更新失敗，請重試', 'error')
  }
}
</script>
