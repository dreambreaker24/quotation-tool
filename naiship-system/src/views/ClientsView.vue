<template>
  <ClientList :selected="selectedClient" @select="selectClient" @add="showForm = true" />
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- 客戶來源統計（近 3 個月） -->
    <div v-if="sourceStats.length > 0" class="bg-white border-b border-gray-100 px-5 py-3 flex-shrink-0">
      <div class="flex items-center gap-4 flex-wrap row-gap-2">
        <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">近 3 個月來源</span>
        <div v-for="[src, count] in sourceStats" :key="src" class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full flex-shrink-0" :style="`background:${sourceColor(src)}`"></span>
          <span class="text-xs text-gray-600">{{ src }}</span>
          <span class="text-xs font-semibold px-1.5 py-0.5 rounded-full text-white text-[10px]"
            :style="`background:${sourceColor(src)}`">{{ count }}</span>
        </div>
        <span class="text-[10px] text-gray-400 ml-auto">共 {{ totalRecentClients }} 位</span>
        <button @click="exportClients(clientsStore.clients)"
          class="text-xs border border-gray-200 rounded-lg px-2.5 py-1 text-gray-500 hover:border-gray-400">匯出</button>
      </div>
    </div>
    <ClientDetail :client="selectedClient" />
  </div>

  <!-- 新增客戶 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">新增客戶</h3>
        <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">姓名 *</label>
            <input v-model="clientForm.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">電話</label>
            <input v-model="clientForm.phone" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">Email</label>
            <input v-model="clientForm.email" type="email" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">Line ID</label>
            <input v-model="clientForm.lineId" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">地址</label>
          <input v-model="clientForm.address" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">客戶來源</label>
            <select v-model="clientForm.source" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option v-for="s in sourceOptions" :key="s" :value="s">{{ s }}</option>
              <optgroup label="朋友介紹">
                <option v-for="name in employeeNames" :key="name" :value="name">{{ name }}</option>
              </optgroup>
              <option value="其他">其他</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">狀態</label>
            <select v-model="clientForm.status" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="contacted">初次接觸</option>
              <option value="negotiating">洽談中</option>
              <option value="signed">已簽約</option>
              <option value="completed">已完工</option>
              <option value="returning">回頭客</option>
              <option value="lost">已流失</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">預算</label>
            <input v-model.number="clientForm.budget" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">坪數</label>
            <input v-model.number="clientForm.area" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">所屬分區</label>
          <select v-model="clientForm.companyId" @change="clientForm.linkedCaseId = ''"
            :disabled="!authStore.isManager"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500">
            <option value="south">奈拾南區</option>
            <option value="north">奈拾北區</option>
            <option value="central">奈拾中區</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">連結案件（選填）</label>
          <select v-model="clientForm.linkedCaseId"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 不連結案件 —</option>
            <option v-for="c in casesForRegion" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <p v-if="casesForRegion.length === 0" class="text-[11px] text-gray-400 mt-1">此分區目前無案件資料</p>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitClient" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">{{ submitting ? '建立中…' : '建立客戶' }}</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { useClientSources } from '@/composables/useClientSources'
import { useExport } from '@/composables/useExport'
import ClientList from '@/components/clients/ClientList.vue'
import ClientDetail from '@/components/clients/ClientDetail.vue'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useCasesStore } from '@/stores/cases'
import { useUsersStore } from '@/stores/users'

const selectedClient = ref(null)
const showForm = ref(false)
const submitting = ref(false)
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const casesStore = useCasesStore()
const usersStore = useUsersStore()
const { toast } = useToast()
const { sourceOptions, sourceColor, normalizeSource, employeeNames } = useClientSources()
const { exportClients } = useExport()

const sourceStats = computed(() => {
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const stats = {}
    clientsStore.clients.forEach(c => {
        if (!c.createdAt) return
        const d = c.createdAt.toDate?.() ?? new Date(c.createdAt)
        if (d < threeMonthsAgo) return
        const src = normalizeSource(c.source)
        stats[src] = (stats[src] || 0) + 1
    })
    return Object.entries(stats).sort((a, b) => b[1] - a[1])
})

const totalRecentClients = computed(() => sourceStats.value.reduce((s, [, n]) => s + n, 0))

onMounted(() => {
    casesStore.subscribe(['north', 'central', 'south'])
    clientsStore.subscribe(['north', 'central', 'south'])
    usersStore.subscribe()
})

watch(() => clientsStore.clients, (clients) => {
    if (selectedClient.value) {
        const updated = clients.find(c => c.id === selectedClient.value.id)
        if (updated) selectedClient.value = updated
    }
})

const blankClient = () => ({ name: '', phone: '', email: '', lineId: '', address: '', source: 'IG', status: 'contacted', budget: 0, area: 0, companyId: authStore.companyId || 'south', linkedCaseId: '', followUpDate: '' })
const clientForm = ref(blankClient())

const casesForRegion = computed(() =>
    casesStore.cases.filter(c => c.companyId === clientForm.value.companyId)
)

function selectClient(client) {
    selectedClient.value = client
}

async function submitClient() {
    if (!clientForm.value.name || submitting.value) return
    submitting.value = true
    await clientsStore.addClient({ ...clientForm.value, assignedTo: authStore.user?.uid ?? '' })
    clientForm.value = blankClient()
    showForm.value = false
    submitting.value = false
    toast('客戶已建立')
}
</script>
