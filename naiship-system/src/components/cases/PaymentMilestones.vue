<template>
  <div class="border-t border-gray-200 bg-white px-5 py-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">收款期程</span>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="milestones.length" class="text-xs text-gray-500">
          應收 <span style="color:#c9a96e" class="font-medium">${{ totalDue.toLocaleString() }}</span>
          ／已收 <span class="font-medium text-green-600">${{ totalPaid.toLocaleString() }}</span>
        </span>
        <button v-if="milestones.length < 6" @click="openAdd"
          class="text-xs px-3 py-1.5 rounded-lg text-white" style="background:#1e2533">+ 新增期款</button>
      </div>
    </div>

    <div v-if="milestones.length === 0" class="text-xs text-gray-400 py-3 text-center">
      尚無收款期程，點擊右上新增
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-gray-100">
            <th class="text-left text-[10px] text-gray-400 font-semibold pb-2 pr-3">期數／名稱</th>
            <th class="text-right text-[10px] text-gray-400 font-semibold pb-2 pr-3">應收金額</th>
            <th class="text-left text-[10px] text-gray-400 font-semibold pb-2 pr-3">到期日</th>
            <th class="text-right text-[10px] text-gray-400 font-semibold pb-2 pr-3">已收金額</th>
            <th class="text-left text-[10px] text-gray-400 font-semibold pb-2 pr-3">收款日期</th>
            <th class="text-center text-[10px] text-gray-400 font-semibold pb-2 pr-3">狀態</th>
            <th class="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(m, idx) in milestones" :key="m.id"
            class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
            <td class="py-2 pr-3 font-medium text-gray-800">{{ m.label }}</td>
            <td class="py-2 pr-3 text-right" style="color:#c9a96e">
              ${{ (m.amount || 0).toLocaleString() }}
            </td>
            <td class="py-2 pr-3 text-gray-600">{{ m.dueDate || '—' }}</td>
            <td class="py-2 pr-3 text-right text-green-600">
              {{ m.paidAmount ? `$${m.paidAmount.toLocaleString()}` : '—' }}
            </td>
            <td class="py-2 pr-3 text-gray-600">{{ m.paidDate || '—' }}</td>
            <td class="py-2 pr-3 text-center">
              <span class="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                :class="statusClass(m)">{{ statusLabel(m) }}</span>
            </td>
            <td class="py-2 text-right">
              <button @click="openEdit(idx)" class="text-[11px] text-gray-400 hover:text-gray-700 mr-2">編輯</button>
              <button @click="removeMilestone(idx)" class="text-[11px] text-red-400 hover:text-red-600">刪除</button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-gray-200">
            <td class="pt-2 pr-3 text-[11px] font-semibold text-gray-600">合計</td>
            <td class="pt-2 pr-3 text-right text-[11px] font-semibold" style="color:#c9a96e">
              ${{ totalDue.toLocaleString() }}
            </td>
            <td class="pt-2 pr-3"></td>
            <td class="pt-2 pr-3 text-right text-[11px] font-semibold text-green-600">
              ${{ totalPaid.toLocaleString() }}
            </td>
            <td colspan="3" class="pt-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>

  <!-- 新增/編輯期款 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ editingIdx !== null ? '編輯期款' : '新增期款' }}</h3>
        <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">期款名稱 *</label>
          <select v-model="form.label" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 請選擇 —</option>
            <option v-for="opt in LABEL_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">應收金額（元）*</label>
          <input v-model.number="form.amount" type="number" min="0"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">到期日</label>
          <input :value="form.dueDate" type="date"
            @input="form.dueDate = $event.target.value"
            @change="form.dueDate = $event.target.value"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">已收金額（元）</label>
          <input v-model.number="form.paidAmount" type="number" min="0"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">收款日期</label>
          <input :value="form.paidDate" type="date"
            @input="form.paidDate = $event.target.value"
            @change="form.paidDate = $event.target.value"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
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
import { useCasesStore } from '@/stores/cases'

const props = defineProps({ caseId: String, caseName: String })
const casesStore = useCasesStore()

const LABEL_OPTIONS = ['訂金（簽約款）', '第二期款', '第三期款', '第四期款', '第五期款', '尾款']
const TODAY = new Date().toISOString().slice(0, 10)

const showForm = ref(false)
const saving = ref(false)
const editingIdx = ref(null)
const form = ref({ label: '', amount: 0, dueDate: '', paidAmount: 0, paidDate: '' })

const caseData = computed(() => casesStore.cases.find(c => c.id === props.caseId))
const milestones = computed(() => caseData.value?.paymentMilestones ?? [])
const totalDue = computed(() => milestones.value.reduce((sum, m) => sum + (m.amount || 0), 0))
const totalPaid = computed(() => milestones.value.reduce((sum, m) => sum + (m.paidAmount || 0), 0))

function statusLabel(m) {
    if ((m.paidAmount || 0) >= (m.amount || 0) && m.amount > 0) return '已收清'
    if ((m.paidAmount || 0) > 0) return '部分收款'
    if (m.dueDate && m.dueDate < TODAY) return '逾期'
    return '未收款'
}

function statusClass(m) {
    const s = statusLabel(m)
    if (s === '已收清') return 'bg-green-100 text-green-700'
    if (s === '部分收款') return 'bg-amber-100 text-amber-700'
    if (s === '逾期') return 'bg-red-100 text-red-600'
    return 'bg-gray-100 text-gray-400'
}

function openAdd() {
    editingIdx.value = null
    form.value = { label: '', amount: 0, dueDate: '', paidAmount: 0, paidDate: '' }
    showForm.value = true
}

function openEdit(idx) {
    editingIdx.value = idx
    const m = milestones.value[idx]
    form.value = {
        label: m.label || '',
        amount: m.amount || 0,
        dueDate: m.dueDate || '',
        paidAmount: m.paidAmount || 0,
        paidDate: m.paidDate || '',
    }
    showForm.value = true
}

async function submitForm() {
    if (!form.value.label || saving.value) return
    saving.value = true
    try {
        const entry = {
            id: editingIdx.value !== null ? milestones.value[editingIdx.value].id : `pm_${Date.now()}`,
            label: form.value.label,
            amount: form.value.amount || 0,
            dueDate: form.value.dueDate || '',
            paidAmount: form.value.paidAmount || 0,
            paidDate: form.value.paidDate || '',
        }
        const updated = [...milestones.value]
        if (editingIdx.value !== null) {
            updated[editingIdx.value] = entry
        } else {
            updated.push(entry)
        }
        await casesStore.updateCase(props.caseId, { paymentMilestones: updated })
        showForm.value = false
    } finally {
        saving.value = false
    }
}

async function removeMilestone(idx) {
    if (!confirm(`確定要刪除「${milestones.value[idx].label}」？`)) return
    const updated = milestones.value.filter((_, i) => i !== idx)
    await casesStore.updateCase(props.caseId, { paymentMilestones: updated })
}
</script>
