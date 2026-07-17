<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">{{ caseInfo?.name }}｜獎金資料</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <div v-if="loading" class="text-sm text-gray-400 py-4 text-center">載入中…</div>

      <div v-else class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">設計約金額</label>
            <input v-model.number="form.designContractAmount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">工程約金額</label>
            <input v-model.number="form.constructionContractAmount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>

        <RoleAssigneePicker label="業務負責人" v-model="form.salesPersonIds" v-model:split="form.salesSplit" />
        <div class="text-xs text-gray-500">業務建議獎金：{{ salesAmount.toLocaleString() }} 元</div>

        <RoleAssigneePicker label="設計師負責人" v-model="form.designerIds" v-model:split="form.designerSplit" />
        <div class="text-xs text-gray-500">設計師建議獎金：{{ designerAmount.toLocaleString() }} 元</div>

        <RoleAssigneePicker label="工務負責人" v-model="form.siteManagerIds" v-model:split="form.siteManagerSplit" />
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工務雜支</label>
          <input v-model.number="form.miscExpenses" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div class="text-xs" :class="profitMargin < 0.25 ? 'text-red-600' : 'text-gray-500'">
          利潤率：{{ (profitMargin * 100).toFixed(1) }}%
          <span v-if="profitMargin < 0.25">（未達 25%，工務獎金強制為 0）</span>
        </div>
        <div class="text-xs text-gray-500">工務建議獎金：{{ siteManagerAmount.toLocaleString() }} 元</div>

        <div v-for="role in ['sales', 'designer', 'siteManager']" :key="role">
          <div class="text-xs text-gray-500 mb-1">{{ roleLabel(role) }}條件</div>
          <div class="flex flex-wrap gap-3">
            <label v-for="key in Object.keys(form.qualitativeChecks[role])" :key="key" class="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" v-model="form.qualitativeChecks[role][key]" class="rounded">
              {{ key }}
            </label>
          </div>
        </div>

        <div>
          <label class="text-xs text-gray-500 mb-1 block">備註</label>
          <textarea v-model="form.notes" rows="2" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"></textarea>
        </div>

        <button @click="save" :disabled="saving" class="text-sm text-white px-4 py-2 rounded-lg" style="background:#1e2533">
          {{ saving ? '儲存中…' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useCaseBonusDataStore, defaultCaseBonusData } from '@/stores/caseBonusData'
import { useToast } from '@/composables/useToast'
import {
    calcSalesBonus, calcDesignerBonus, calcSiteManagerBonus,
    calcProfitMargin, sumVendorCost,
} from '@/utils/bonusCalc'
import RoleAssigneePicker from './RoleAssigneePicker.vue'

const props = defineProps({ caseId: String, caseInfo: Object })
const emit = defineEmits(['close'])

const store = useCaseBonusDataStore()
const { toast } = useToast()
const loading = ref(true)
const saving = ref(false)
const form = reactive(defaultCaseBonusData())

onMounted(async () => {
    const data = await store.fetchData(props.caseId)
    Object.assign(form, JSON.parse(JSON.stringify(data)))
    loading.value = false
})

const vendorCostTotal = computed(() => sumVendorCost(props.caseInfo?.workTypes))

const salesAmount = computed(() =>
    calcSalesBonus(form.designContractAmount, form.constructionContractAmount, props.caseInfo?.signedAmount))
const designerAmount = computed(() => calcDesignerBonus(props.caseInfo?.signedAmount))
const profitMargin = computed(() =>
    calcProfitMargin(props.caseInfo?.signedAmount, vendorCostTotal.value, form.miscExpenses))
const siteManagerAmount = computed(() =>
    calcSiteManagerBonus(props.caseInfo?.signedAmount, vendorCostTotal.value, form.miscExpenses))

function roleLabel(role) {
    return { sales: '業務', designer: '設計師', siteManager: '工務' }[role]
}

async function save() {
    saving.value = true
    try {
        await store.saveData(props.caseId, { ...form })
        toast('已儲存')
        emit('close')
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        saving.value = false
    }
}
</script>
