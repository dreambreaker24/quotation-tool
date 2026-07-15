<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">編輯案件</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <div v-if="!caseData" class="text-sm text-gray-400 py-4 text-center">載入中…</div>

      <div v-else class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">案件名稱 *</label>
          <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：台南東區翻新">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">城市</label>
            <input v-model="form.addressCity" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：台南市">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">區或鄉</label>
            <input v-model="form.addressDistrict" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：東區">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">街道門牌號</label>
          <input v-model="form.addressStreet" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：大同路二段123號">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">分區 *</label>
            <select v-model="form.companyId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="south">奈拾南區</option>
              <option value="north">奈拾北區</option>
              <option value="central">奈拾中區</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">狀態 *</label>
            <select v-model="form.status" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option v-for="(label, key) in CASE_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
        </div>

        <!-- Status history -->
        <div v-if="caseData.statusHistory?.length" class="bg-gray-50 rounded-xl px-3 py-2.5">
          <div class="text-xs font-semibold text-gray-500 mb-2">狀態變更紀錄</div>
          <div v-for="(h, i) in caseData.statusHistory" :key="i" class="flex items-center justify-between text-[11px] text-gray-500 py-0.5">
            <span>{{ statusLabel(h.status) }}</span>
            <span class="text-gray-400">{{ h.changedBy }} · {{ formatTs(h.changedAt) }}</span>
          </div>
        </div>

        <div>
          <label class="text-xs text-gray-500 mb-1 block">關聯客戶（選填）</label>
          <select v-model="form.linkedClientId" :disabled="!authStore.isManager"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500">
            <option value="">— 不關聯客戶 —</option>
            <option v-for="c in clientsForRegion" :key="c.id" :value="c.id">{{ c.name }}{{ c.phone ? ` · ${c.phone}` : '' }}</option>
          </select>
        </div>

        <div>
          <label class="text-xs text-gray-500 mb-1 block">負責人（最多 4 位）</label>
          <div class="flex flex-col gap-2">
            <div v-for="(a, idx) in form.assignees" :key="idx" class="flex items-center gap-2">
              <select v-model="form.assignees[idx]"
                class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option value="">— 選擇負責人 —</option>
                <option v-for="u in activeUsers" :key="u.id" :value="u.name">{{ u.name }}</option>
              </select>
              <button v-if="form.assignees.length > 1" @click="form.assignees.splice(idx, 1)"
                class="text-red-400 hover:text-red-600 px-1">✕</button>
            </div>
            <button v-if="form.assignees.length < 4" @click="form.assignees.push('')"
              class="text-xs text-left px-1" style="color:#c9a96e">+ 新增負責人</button>
          </div>
        </div>

        <div>
          <label class="text-xs text-gray-500 mb-1 block">簽約金額</label>
          <input v-model.number="form.signedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">開始日期</label>
            <input v-model="form.startDate" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">結束日期（預估）</label>
            <input v-model="form.endDate" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">簽約日期（選填）</label>
            <input v-model="form.signedDate" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">完工期限（業主要求）</label>
            <input v-model="form.deadline" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
      </div>

      <!-- 刪除區域 -->
      <div v-if="caseData" class="mt-5 pt-4 border-t border-gray-100">
        <div v-if="!confirmDelete" class="flex justify-between items-center">
          <button @click="confirmDelete = true" class="text-xs text-red-400 hover:text-red-600">刪除此案件</button>
          <div class="flex gap-2">
            <button @click="$emit('close')" class="text-sm text-gray-400 px-4 py-2">取消</button>
            <button @click="save" :disabled="saving" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
              {{ saving ? '儲存中…' : '儲存' }}
            </button>
          </div>
        </div>
        <div v-else class="flex flex-col gap-3">
          <p class="text-sm text-red-600 font-medium">⚠ 確定刪除「{{ caseData.name }}」？此操作無法復原。</p>
          <div class="flex gap-2 justify-end">
            <button @click="confirmDelete = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
            <button @click="deleteThisCase" :disabled="deleting" class="text-sm text-white px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60">
              {{ deleting ? '刪除中…' : '確認刪除' }}
            </button>
          </div>
        </div>
      </div>
      <div v-else class="flex justify-end gap-2 mt-5">
        <button @click="$emit('close')" class="text-sm text-gray-400 px-4 py-2">取消</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import { CASE_STATUS_LABELS } from '@/constants/caseStatus'
import { Timestamp, arrayUnion, arrayRemove, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useClientsStore } from '@/stores/clients'
import { useNotificationsStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'
import { isMissingSignedAmountForConstruction } from '@/utils/caseStatusRules'
import { db } from '@/firebase'

const props = defineProps({ caseId: String })
const emit = defineEmits(['close'])

const casesStore = useCasesStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const clientsStore = useClientsStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const activeUsers = computed(() => usersStore.users.filter(u => !u.disabled))
const clientsForRegion = computed(() =>
    clientsStore.clients.filter(c => c.companyId === form.value.companyId)
)

const saving = ref(false)
const confirmDelete = ref(false)
const deleting = ref(false)

async function deleteThisCase() {
    if (deleting.value) return
    deleting.value = true
    try {
        await casesStore.deleteCase(props.caseId)
        emit('close')
    } catch {
        toast('刪除失敗，請重試', 'error')
    } finally {
        deleting.value = false
    }
}

const caseData = computed(() => casesStore.cases.find(c => c.id === props.caseId) ?? null)

function tsToDate(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return d.toISOString().slice(0, 10)
}

const form = ref({
    name: '',
    addressCity: '',
    addressDistrict: '',
    addressStreet: '',
    companyId: 'south',
    status: 'negotiating',
    assignees: [''],
    signedAmount: 0,
    startDate: '',
    endDate: '',
    signedDate: '',
    deadline: '',
    linkedClientId: '',
})

const originalStatus = ref('')
const originalLinkedClientId = ref('')

watch(caseData, (c) => {
    if (!c) return
    confirmDelete.value = false
    originalStatus.value = c.status
    originalLinkedClientId.value = c.linkedClientId ?? ''
    form.value = {
        name: c.name ?? '',
        addressCity: c.addressCity ?? '',
        addressDistrict: c.addressDistrict ?? '',
        addressStreet: c.addressStreet ?? '',
        companyId: c.companyId ?? 'south',
        status: c.status ?? 'negotiating',
        assignees: c.assignees?.length ? [...c.assignees] : (c.assigneeName ? c.assigneeName.split('、') : ['']),
        signedAmount: c.signedAmount ?? 0,
        startDate: tsToDate(c.startDate),
        endDate: tsToDate(c.endDate),
        signedDate: tsToDate(c.signedDate),
        deadline: tsToDate(c.deadline),
        linkedClientId: c.linkedClientId ?? '',
    }
}, { immediate: true })

function statusLabel(s) { return CASE_STATUS_LABELS[s] ?? s }

function formatTs(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

async function save() {
    if (!form.value.name || saving.value) return
    if (isMissingSignedAmountForConstruction(form.value.status, originalStatus.value, form.value.signedAmount)) {
        toast('請先填寫簽約金額才能切換為施工中', 'error')
        return
    }
    saving.value = true
    try {
        const assignees = form.value.assignees.filter(a => a.trim())
        const data = {
            name: form.value.name,
            addressCity: form.value.addressCity || '',
            addressDistrict: form.value.addressDistrict || '',
            addressStreet: form.value.addressStreet || '',
            companyId: form.value.companyId,
            status: form.value.status,
            assignees,
            assigneeName: assignees.join('、'),
            signedAmount: form.value.signedAmount || 0,
            startDate: form.value.startDate ? Timestamp.fromDate(new Date(form.value.startDate)) : null,
            endDate: form.value.endDate ? Timestamp.fromDate(new Date(form.value.endDate)) : null,
            signedDate: form.value.signedDate ? Timestamp.fromDate(new Date(form.value.signedDate)) : null,
            deadline: form.value.deadline ? Timestamp.fromDate(new Date(form.value.deadline)) : null,
            linkedClientId: form.value.linkedClientId || null,
        }
        if (!data.startDate) delete data.startDate
        if (!data.endDate) delete data.endDate
        if (!data.signedDate) delete data.signedDate
        if (!data.deadline) delete data.deadline
        // 注意：linkedClientId 不能用「空值就 delete」的寫法（跟上面幾個日期欄位不一樣）。
        // 這裡如果 delete 掉，Firestore updateDoc 就完全不會動這個欄位，使用者選「— 不關聯客戶 —」
        // 想清空舊關聯客戶就會沒有效果。要保留 `linkedClientId: null` 明確寫入才能真的清空。

        if (form.value.status !== originalStatus.value) {
            const existing = caseData.value?.statusHistory ?? []
            data.statusHistory = [
                ...existing,
                { status: form.value.status, changedAt: Timestamp.now(), changedBy: authStore.name ?? '' }
            ]
        }

        const newLinkedClientId = form.value.linkedClientId || ''
        const batch = writeBatch(db)
        batch.update(doc(db, 'cases', props.caseId), { ...data, updatedAt: serverTimestamp() })

        if (originalLinkedClientId.value !== newLinkedClientId) {
            if (originalLinkedClientId.value) {
                const oldClient = clientsStore.clients.find(cl => cl.id === originalLinkedClientId.value)
                batch.update(doc(db, 'clients', originalLinkedClientId.value), {
                    linkedCaseIds: arrayRemove(props.caseId),
                    ...(oldClient?.linkedCaseId === props.caseId ? { linkedCaseId: null } : {}),
                })
            }
            if (newLinkedClientId) {
                const newClient = clientsStore.clients.find(cl => cl.id === newLinkedClientId)
                batch.update(doc(db, 'clients', newLinkedClientId), {
                    linkedCaseIds: arrayUnion(props.caseId),
                    ...(newClient && !newClient.linkedCaseId ? { linkedCaseId: props.caseId } : {}),
                })
            }
        }

        await batch.commit()

        toast('案件已儲存')
        notifStore.notifyAll(authStore.name ?? '', `更新了「${caseData.value?.name ?? ''}」`, props.caseId, caseData.value?.name ?? '', form.value.companyId)
        emit('close')
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        saving.value = false
    }
}
</script>
