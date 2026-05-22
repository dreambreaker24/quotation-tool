<template>
  <div class="border-t border-gray-200 bg-white px-5 py-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">工種安排</span>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="totalPayment > 0" class="text-xs font-medium" style="color:#c9a96e">合計 ${{ totalPayment.toLocaleString() }}</span>
        <button @click="openAdd" class="text-xs px-3 py-1.5 rounded-lg text-white" style="background:#1e2533">+ 新增工種</button>
      </div>
    </div>

    <div v-if="workTypes.length === 0" class="text-xs text-gray-400 py-3 text-center">
      尚無工種資料，點擊右上新增
    </div>

    <div v-else class="flex flex-col gap-2">
      <div v-for="(wt, idx) in workTypes" :key="wt.id"
        class="border border-gray-100 rounded-xl p-3 flex items-center gap-3 bg-gray-50/50">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="`background:${wt.color}`"></span>
        <div class="flex-1 grid grid-cols-6 gap-2 items-start">
          <div>
            <div class="text-[10px] text-gray-400 mb-0.5">工種</div>
            <div class="text-xs font-semibold text-gray-800">{{ wt.name }}</div>
          </div>
          <div>
            <div class="text-[10px] text-gray-400 mb-0.5">負責廠商</div>
            <div class="text-xs text-gray-600">{{ wt.vendorName || '—' }}</div>
          </div>
          <div class="col-span-2">
            <div class="text-[10px] text-gray-400 mb-0.5">進場期間</div>
            <div class="text-xs text-gray-600">
              <template v-if="wt.startDate">
                {{ wt.startDate }}<template v-if="wt.endDate"><br>～ {{ wt.endDate }}</template>
              </template>
              <template v-else>—</template>
            </div>
          </div>
          <div>
            <div class="text-[10px] text-gray-400 mb-0.5">向業主收款</div>
            <div class="text-xs font-medium" style="color:#c9a96e">
              {{ wt.payment ? `$${wt.payment.toLocaleString()}` : '—' }}
            </div>
          </div>
          <div>
            <div class="text-[10px] text-gray-400 mb-0.5">報價單</div>
            <span v-if="wt.hasQuote" class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">已提供</span>
            <span v-else class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 whitespace-nowrap">未提供</span>
          </div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button @click="openEdit(idx)" class="text-[11px] text-gray-400 hover:text-gray-700">編輯</button>
          <button @click="removeWorkType(idx)" class="text-[11px] text-red-400 hover:text-red-600">刪除</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 新增/編輯工種 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ editingIdx !== null ? '編輯工種' : '新增工種' }}</h3>
        <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工種名稱 *</label>
          <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：水電、泥作、木工">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">負責廠商</label>
          <select v-model="form.vendorId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 尚未指定 —</option>
            <option v-for="v in vendorsStore.vendors" :key="v.id" :value="v.id">
              {{ v.name }}（{{ v.specialty }}）
            </option>
          </select>
          <p v-if="vendorsStore.vendors.length === 0" class="text-[11px] text-gray-400 mt-1">
            尚無廠商，請至系統設定 › 廠商管理新增
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">進場日期</label>
            <input :value="form.startDate" type="date"
              @input="form.startDate = $event.target.value"
              @change="form.startDate = $event.target.value"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">退場日期</label>
            <input :value="form.endDate" type="date"
              @input="form.endDate = $event.target.value"
              @change="form.endDate = $event.target.value"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">向業主收取工程款（元）</label>
          <input v-model.number="form.payment" type="number" min="0"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
        </div>
        <div class="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="form.hasQuote" class="rounded">
            <span class="text-sm text-gray-700">已提供報價單</span>
          </label>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitForm" :disabled="saving" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ saving ? '儲存中…' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useVendorsStore } from '@/stores/vendors'
import { useCasesStore } from '@/stores/cases'

const props = defineProps({ caseId: String, caseName: String })
const vendorsStore = useVendorsStore()
const casesStore = useCasesStore()

const showForm = ref(false)
const saving = ref(false)
const editingIdx = ref(null)
const form = ref({ name: '', vendorId: '', startDate: '', endDate: '', payment: 0, hasQuote: false })

const WT_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316']

const caseData = computed(() => casesStore.cases.find(c => c.id === props.caseId))
const workTypes = computed(() => caseData.value?.workTypes ?? [])
const totalPayment = computed(() => workTypes.value.reduce((sum, wt) => sum + (wt.payment || 0), 0))

function openAdd() {
    editingIdx.value = null
    form.value = { name: '', vendorId: '', startDate: '', endDate: '', payment: 0, hasQuote: false }
    showForm.value = true
}

function openEdit(idx) {
    editingIdx.value = idx
    const wt = workTypes.value[idx]
    form.value = { name: wt.name, vendorId: wt.vendorId || '', startDate: wt.startDate || '', endDate: wt.endDate || '', payment: wt.payment || 0, hasQuote: wt.hasQuote || false }
    showForm.value = true
}

async function submitForm() {
    if (!form.value.name || saving.value) return
    saving.value = true
    try {
        const vendor = vendorsStore.vendors.find(v => v.id === form.value.vendorId)
        const entry = {
            id: editingIdx.value !== null ? workTypes.value[editingIdx.value].id : `wt_${Date.now()}`,
            name: form.value.name,
            vendorId: form.value.vendorId || '',
            vendorName: vendor?.name ?? '',
            startDate: form.value.startDate || '',
            endDate: form.value.endDate || '',
            payment: form.value.payment || 0,
            hasQuote: form.value.hasQuote || false,
            color: editingIdx.value !== null
                ? workTypes.value[editingIdx.value].color
                : WT_COLORS[workTypes.value.length % WT_COLORS.length],
        }
        const updated = [...workTypes.value]
        if (editingIdx.value !== null) {
            updated[editingIdx.value] = entry
        } else {
            updated.push(entry)
        }
        await casesStore.updateCase(props.caseId, { workTypes: updated })
        showForm.value = false
    } finally {
        saving.value = false
    }
}

async function removeWorkType(idx) {
    if (!confirm(`確定要刪除「${workTypes.value[idx].name}」？`)) return
    const updated = workTypes.value.filter((_, i) => i !== idx)
    await casesStore.updateCase(props.caseId, { workTypes: updated })
}
</script>
