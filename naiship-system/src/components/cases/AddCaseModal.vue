<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">新增案件</h3>
        <button @click="cancel" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
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
              <option v-for="(label, key) in CASE_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
        </div>
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
        <button @click="cancel" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitCase" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">{{ submitting ? '建立中…' : '建立案件' }}</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import { Timestamp, arrayUnion } from 'firebase/firestore'
import { CASE_STATUS_LABELS } from '@/constants/caseStatus'
import { useCasesStore } from '@/stores/cases'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useNotificationsStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'

const props = defineProps({ region: String })
const emit = defineEmits(['close', 'created'])

const casesStore = useCasesStore()
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const submitting = ref(false)

const activeUsers = computed(() => usersStore.users.filter(u => !u.disabled))

const blankCase = () => ({
    name: '', address: '',
    companyId: authStore.isManager ? (props.region ?? 'south') : (authStore.companyId || 'south'),
    assignees: [''], status: 'negotiating',
    estimatedAmount: 0, signedAmount: 0, startDate: '', endDate: '', signedDate: '',
    deadline: '', linkedClientId: ''
})
const caseForm = ref(blankCase())

const clientsForRegion = computed(() =>
    clientsStore.clients.filter(c => c.companyId === caseForm.value.companyId)
)

watch(() => caseForm.value.linkedClientId, (clientId) => {
    if (!clientId) return
    const client = clientsStore.clients.find(c => c.id === clientId)
    if (!client?.assignedTo) return
    if (caseForm.value.assignees.some(a => a.trim())) return
    const user = usersStore.users.find(u => u.id === client.assignedTo)
    if (user?.name) caseForm.value.assignees = [user.name]
})

function cancel() {
    caseForm.value = blankCase()
    emit('close')
}

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
            await clientsStore.updateClient(caseForm.value.linkedClientId, {
                linkedCaseId: docRef.id,
                linkedCaseIds: arrayUnion(docRef.id),
            })
        }
        const newCaseName = data.name
        const newCaseId = docRef?.id ?? ''
        notifStore.notifyAll(authStore.name ?? '', `新增了案件「${newCaseName}」`, newCaseId, newCaseName, data.companyId)
        toast('案件已建立')
        caseForm.value = blankCase()
        emit('created', { caseId: newCaseId })
    } catch {
        toast('建立失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}
</script>
