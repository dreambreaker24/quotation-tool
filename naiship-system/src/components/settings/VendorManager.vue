<template>
  <div class="bg-white rounded-2xl shadow-md p-5">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#c9a96e">廠商管理</h2>
        <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ vendorsStore.vendors.length }} 家</span>
      </div>
      <button @click="openAdd" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 新增廠商</button>
    </div>

    <div class="mb-3">
      <input v-model="searchKeyword" type="text" placeholder="搜尋廠商名稱…"
        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
    </div>

    <!-- 搜尋模式：平鋪列表 -->
    <template v-if="searchKeyword.trim()">
      <div v-if="filteredVendors.length === 0" class="text-sm text-gray-400 text-center py-8">找不到符合的廠商</div>
      <div v-else class="flex flex-col gap-1">
        <div v-for="v in filteredVendors" :key="v.id"
          class="flex flex-col px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 gap-0.5">
          <div class="flex items-center gap-3 text-xs">
            <div class="flex-1 min-w-0">
              <span class="font-medium text-gray-800">{{ v.name }}</span>
              <span v-if="getVendorSpecialties(v).length" class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ getVendorSpecialties(v).join('、') }}</span>
            </div>
            <div class="hidden sm:flex items-center gap-1 text-gray-500 flex-shrink-0">
              <span v-if="v.contact">{{ v.contact }}</span>
              <span v-if="v.contact && v.phone" class="text-gray-300">·</span>
              <span v-if="v.phone">{{ v.phone }}</span>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span v-if="v.rating" class="text-amber-400 text-[10px]">{{ '★'.repeat(v.rating) }}</span>
              <span v-if="v.formSubmitted" class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ 資料表</span>
              <button @click="openEdit(v)" class="text-gray-400 hover:text-gray-700">編輯</button>
              <button v-if="authStore.isManager" @click="confirmDelete(v)" class="text-red-400 hover:text-red-600">刪除</button>
            </div>
          </div>
          <div v-if="v.taxId || v.abilities" class="flex items-center gap-2 text-[10px] text-gray-400">
            <span v-if="v.taxId">統編 {{ v.taxId }}</span>
            <span v-if="v.taxId && v.abilities" class="text-gray-200">|</span>
            <span v-if="v.abilities" class="truncate">{{ v.abilities }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 預設：折疊分類（全分類顯示） -->
    <template v-else>
      <div v-if="vendorsStore.vendors.length === 0 && !hasUncategorized" class="text-sm text-gray-400 text-center py-8">
        尚無廠商資料，點擊右上新增
      </div>
      <div class="flex flex-col">
        <div v-for="cat in allCategories" :key="cat.label">
          <button @click="cat.list.length > 0 && toggleCategory(cat.label)"
            class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors"
            :class="cat.list.length > 0 ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-40'">
            <span class="text-[10px] text-gray-400 inline-block transition-transform duration-150 w-2.5"
              :style="expandedCategories[cat.label] ? 'transform:rotate(90deg)' : 'transform:rotate(0deg)'">
              {{ cat.list.length > 0 ? '▶' : '·' }}
            </span>
            <span class="text-sm font-medium text-gray-700">{{ cat.label }}</span>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="cat.list.length > 0 ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-300'">
              {{ cat.list.length }}
            </span>
          </button>
          <div v-if="expandedCategories[cat.label] && cat.list.length > 0" class="mx-2 mb-1 flex flex-col gap-1">
            <div v-for="v in cat.list" :key="v.id"
              class="flex flex-col px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/60 gap-0.5 hover:bg-white hover:shadow-sm hover:-translate-y-px transition-all cursor-default">
              <div class="flex items-center gap-3 text-xs">
                <div class="flex-1 min-w-0">
                  <span class="font-medium text-gray-800">{{ v.name }}</span>
                </div>
                <div class="hidden sm:flex items-center gap-1 text-gray-500 flex-shrink-0">
                  <span v-if="v.contact">{{ v.contact }}</span>
                  <span v-if="v.contact && v.phone" class="text-gray-300">·</span>
                  <span v-if="v.phone">{{ v.phone }}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span v-if="v.rating" class="text-amber-400 text-[10px]">{{ '★'.repeat(v.rating) }}</span>
                  <span v-if="v.formSubmitted" class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓</span>
                  <button @click="openEdit(v)" class="text-gray-400 hover:text-gray-700">編輯</button>
                  <button v-if="authStore.isManager" @click="confirmDelete(v)" class="text-red-400 hover:text-red-600">刪除</button>
                </div>
              </div>
              <div v-if="v.taxId || v.abilities || (cat.label === '其他' && getVendorSpecialties(v).length)" class="flex items-center gap-2 text-[10px] text-gray-400">
                <span v-if="v.taxId">統編 {{ v.taxId }}</span>
                <span v-if="v.taxId && (v.abilities || (cat.label === '其他' && getVendorSpecialties(v).length))" class="text-gray-200">|</span>
                <span v-if="v.abilities || (cat.label === '其他' && getVendorSpecialties(v).length)" class="truncate">{{ v.abilities || getVendorSpecialties(v).join('、') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- 新增/編輯 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ editingId ? '編輯廠商' : '新增廠商' }}</h3>
        <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">廠商名稱 *</label>
          <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：振宏水電行">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工種分類 *（可複選）</label>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="cat in VENDOR_CATEGORIES" :key="cat" type="button"
              @click="toggleSpecialty(cat)"
              class="text-xs px-2.5 py-1 rounded-full border transition-colors"
              :class="form.specialties.includes(cat) ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 hover:border-gray-400'"
              :style="form.specialties.includes(cat) ? 'background:#c9a96e' : ''">
              {{ cat }}
            </button>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">廠商能力</label>
          <input v-model="form.abilities" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：住宅水電、冷氣配管、弱電網路">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">聯絡人</label>
            <input v-model="form.contact" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="姓名">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">電話</label>
            <input v-model="form.phone" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0912-345-678">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">統編</label>
            <input v-model="form.taxId" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="12345678">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">Line ID</label>
            <input v-model="form.lineId" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="@vendor">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">適用分區</label>
          <select v-model="form.companyId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">全部分區</option>
            <option value="south">奈拾南區</option>
            <option value="north">奈拾北區</option>
            <option value="central">奈拾中區</option>
          </select>
        </div>
        <div class="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
          <label class="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" v-model="form.formSubmitted" class="rounded">
            <span class="text-sm text-gray-700">已繳交廠商資料表</span>
          </label>
          <div v-if="form.formSubmitted">
            <label class="text-xs text-gray-500 mb-1 block">繳交日期</label>
            <input :value="form.formDate" type="date"
              @input="form.formDate = $event.target.value"
              @change="form.formDate = $event.target.value"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 bg-white">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-2 block">廠商評分</label>
          <div class="flex gap-1">
            <button v-for="n in 5" :key="n" @click="form.rating = form.rating === n ? 0 : n"
              type="button"
              class="text-xl transition-colors"
              :class="n <= form.rating ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'">★</button>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">備注</label>
          <textarea v-model="form.notes" rows="3"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="廠商合作評價、注意事項…"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitForm" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ submitting ? '儲存中…' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, reactive } from 'vue'
import { WORK_CATEGORIES as VENDOR_CATEGORIES } from '@/constants/workCategories'
import { useVendorsStore } from '@/stores/vendors'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { getVendorSpecialties } from '@/utils/vendorSpecialty'

const vendorsStore = useVendorsStore()
const authStore = useAuthStore()
const { toast } = useToast()

const expandedCategories = reactive({})

function toggleCategory(label) {
    expandedCategories[label] = !expandedCategories[label]
}

const standardCategories = VENDOR_CATEGORIES.filter(c => c !== '其他')

const allCategories = computed(() => {
    const result = standardCategories.map(label => ({
        label,
        list: vendorsStore.vendors.filter(v => getVendorSpecialties(v).includes(label)),
    }))
    const others = vendorsStore.vendors.filter(v => !getVendorSpecialties(v).some(s => standardCategories.includes(s)))
    if (others.length > 0) result.push({ label: '其他', list: others })
    return result
})

const hasUncategorized = computed(() =>
    vendorsStore.vendors.some(v => !getVendorSpecialties(v).some(s => standardCategories.includes(s)))
)

const searchKeyword = ref('')
const filteredVendors = computed(() => {
    const kw = searchKeyword.value.trim()
    if (!kw) return vendorsStore.vendors
    return vendorsStore.vendors.filter(v =>
        (v.name || '').includes(kw) || getVendorSpecialties(v).some(s => s.includes(kw))
    )
})

const showForm = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const blankForm = () => ({ name: '', specialties: [], abilities: '', contact: '', phone: '', taxId: '', lineId: '', formSubmitted: false, formDate: '', companyId: '', rating: 0, notes: '' })
const form = ref(blankForm())

function openAdd() {
    editingId.value = null
    form.value = blankForm()
    showForm.value = true
}

function toggleSpecialty(cat) {
    const idx = form.value.specialties.indexOf(cat)
    if (idx >= 0) form.value.specialties.splice(idx, 1)
    else form.value.specialties.push(cat)
}

function openEdit(v) {
    editingId.value = v.id
    form.value = {
        name: v.name, specialties: getVendorSpecialties(v),
        abilities: v.abilities || '',
        contact: v.contact || '', phone: v.phone || '',
        taxId: v.taxId || '', lineId: v.lineId || '',
        formSubmitted: v.formSubmitted || false, formDate: v.formDate || '',
        companyId: v.companyId || '',
        rating: v.rating || 0,
        notes: v.notes || '',
    }
    showForm.value = true
}

async function submitForm() {
    if (!form.value.name || form.value.specialties.length === 0 || submitting.value) return
    submitting.value = true
    try {
        const data = { ...form.value }
        if (!data.formSubmitted) data.formDate = ''
        if (editingId.value) {
            await vendorsStore.updateVendor(editingId.value, data)
            toast('廠商已更新')
        } else {
            await vendorsStore.addVendor(data)
            toast('廠商已新增')
        }
        showForm.value = false
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

async function confirmDelete(v) {
    if (!confirm(`確定要刪除「${v.name}」？該廠商在所有案件工種的關聯也將一併清除。`)) return
    try {
        await vendorsStore.deleteVendorAndCascade(v.id)
        toast('廠商已刪除')
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
