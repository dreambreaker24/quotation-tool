<template>
  <div class="bg-white rounded-2xl shadow-sm p-5">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-semibold text-gray-700">廠商管理</h2>
      <button @click="openAdd" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 新增廠商</button>
    </div>

    <div class="mb-3">
      <input v-model="searchKeyword" type="text" placeholder="搜尋廠商名稱或工種…"
        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
    </div>

    <div v-if="filteredVendors.length === 0" class="text-sm text-gray-400 text-center py-8">
      {{ vendorsStore.vendors.length === 0 ? '尚無廠商資料，點擊右上新增' : '找不到符合的廠商' }}
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-xs min-w-[600px]">
        <thead>
          <tr class="bg-gray-50">
            <th class="text-left px-3 py-2 text-gray-500 font-semibold">廠商名稱</th>
            <th class="text-left px-3 py-2 text-gray-500 font-semibold">工種/專長</th>
            <th class="text-left px-3 py-2 text-gray-500 font-semibold">聯絡人 / 電話</th>
            <th class="text-left px-3 py-2 text-gray-500 font-semibold">統編 / Line</th>
            <th class="text-center px-3 py-2 text-gray-500 font-semibold">廠商資料表</th>
            <th class="text-center px-3 py-2 text-gray-500 font-semibold w-16">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in filteredVendors" :key="v.id" class="border-t border-gray-100 hover:bg-gray-50">
            <td class="px-3 py-2.5 font-medium text-gray-800">{{ v.name }}</td>
            <td class="px-3 py-2.5 text-gray-600">{{ v.specialty }}</td>
            <td class="px-3 py-2.5 text-gray-600">
              <div>{{ v.contact || '—' }}</div>
              <div class="text-gray-400">{{ v.phone || '' }}</div>
            </td>
            <td class="px-3 py-2.5 text-gray-600">
              <div v-if="v.taxId">{{ v.taxId }}</div>
              <div v-if="v.lineId" class="text-gray-400">{{ v.lineId }}</div>
              <span v-if="!v.taxId && !v.lineId">—</span>
            </td>
            <td class="px-3 py-2.5 text-center">
              <span v-if="v.formSubmitted"
                class="inline-flex flex-col items-center gap-0.5">
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">已繳交</span>
                <span v-if="v.formDate" class="text-[10px] text-gray-400">{{ v.formDate }}</span>
              </span>
              <span v-else class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">未繳交</span>
            </td>
            <td class="px-3 py-2.5 text-center">
              <div class="flex items-center justify-center gap-2">
                <button @click="openEdit(v)" class="text-gray-400 hover:text-gray-700">編輯</button>
                <button @click="confirmDelete(v)" class="text-red-400 hover:text-red-600">刪除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- 新增/編輯 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ editingId ? '編輯廠商' : '新增廠商' }}</h3>
        <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">廠商名稱 *</label>
            <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：振宏水電行">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">工種/專長 *</label>
            <input v-model="form.specialty" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：水電、泥作">
          </div>
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
import { ref, computed } from 'vue'
import { useVendorsStore } from '@/stores/vendors'
import { useToast } from '@/composables/useToast'

const vendorsStore = useVendorsStore()
const { toast } = useToast()

const searchKeyword = ref('')
const filteredVendors = computed(() => {
    const kw = searchKeyword.value.trim()
    if (!kw) return vendorsStore.vendors
    return vendorsStore.vendors.filter(v =>
        v.name.includes(kw) || v.specialty.includes(kw)
    )
})

const showForm = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const blankForm = () => ({ name: '', specialty: '', contact: '', phone: '', taxId: '', lineId: '', formSubmitted: false, formDate: '' })
const form = ref(blankForm())

function openAdd() {
    editingId.value = null
    form.value = blankForm()
    showForm.value = true
}

function openEdit(v) {
    editingId.value = v.id
    form.value = {
        name: v.name, specialty: v.specialty,
        contact: v.contact || '', phone: v.phone || '',
        taxId: v.taxId || '', lineId: v.lineId || '',
        formSubmitted: v.formSubmitted || false, formDate: v.formDate || ''
    }
    showForm.value = true
}

async function submitForm() {
    if (!form.value.name || !form.value.specialty || submitting.value) return
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
    } finally {
        submitting.value = false
    }
}

async function confirmDelete(v) {
    if (!confirm(`確定要刪除「${v.name}」？該廠商在所有案件工種的關聯也將一併清除。`)) return
    await vendorsStore.deleteVendorAndCascade(v.id)
    toast('廠商已刪除')
}
</script>
