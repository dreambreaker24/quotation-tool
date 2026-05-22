<template>
  <div class="bg-white rounded-2xl shadow-sm p-4">
    <div class="flex items-center gap-2 mb-3">
      <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">待處理事項</h2>
      <span v-if="totalCount > 0"
        class="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
        style="background:#c9a96e">{{ totalCount }}</span>
    </div>

    <div v-if="totalCount === 0" class="text-xs text-gray-400 py-2">目前無待處理事項</div>

    <template v-else>
      <!-- 即將到期案件 -->
      <div v-if="urgentCases.length > 0" class="mb-3">
        <div class="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">即將到期案件</div>
        <div v-for="c in urgentCases" :key="c.id"
          @click="router.push({ name: 'cases', query: { region: c.companyId } })"
          class="flex items-center justify-between px-3 py-2 rounded-xl border border-red-100 bg-red-50 mb-1.5 last:mb-0 cursor-pointer hover:bg-red-100 transition-colors">
          <div>
            <div class="text-xs font-semibold text-gray-800">{{ c.name }}</div>
            <div class="text-[10px] text-gray-500">{{ c.assigneeName }}</div>
          </div>
          <span class="text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
            {{ deadlineLabel(c.deadline) }}
          </span>
        </div>
      </div>

      <!-- 今日跟進客戶 -->
      <div v-if="followUpClients.length > 0">
        <div class="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">今日跟進客戶</div>
        <div v-for="c in followUpClients" :key="c.id"
          @click="router.push({ name: 'clients' })"
          class="flex items-center justify-between px-3 py-2 rounded-xl border border-amber-100 bg-amber-50 mb-1.5 last:mb-0 cursor-pointer hover:bg-amber-100 transition-colors">
          <div>
            <div class="text-xs font-semibold text-gray-800">{{ c.name }}</div>
            <div class="text-[10px] text-gray-500">{{ c.phone || c.email || '' }}</div>
          </div>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
            style="background:#c9a96e;color:#fff">
            {{ c.followUpDate }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCasesStore } from '@/stores/cases'
import { useClientsStore } from '@/stores/clients'

const router = useRouter()
const casesStore = useCasesStore()
const clientsStore = useClientsStore()

const today = new Date()
today.setHours(0, 0, 0, 0)
const in7Days = new Date(today)
in7Days.setDate(in7Days.getDate() + 7)

const todayStr = today.toISOString().slice(0, 10)

const urgentCases = computed(() =>
    casesStore.activeCases.filter(c => {
        if (!c.deadline) return false
        const dl = c.deadline.toDate?.()
        if (!dl) return false
        return dl >= today && dl <= in7Days
    }).sort((a, b) => {
        const da = a.deadline.toDate?.()
        const db = b.deadline.toDate?.()
        return da - db
    })
)

const followUpClients = computed(() =>
    clientsStore.clients.filter(c => c.followUpDate && c.followUpDate <= todayStr)
        .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
)

const totalCount = computed(() => urgentCases.value.length + followUpClients.value.length)

function deadlineLabel(deadline) {
    const dl = deadline.toDate?.()
    if (!dl) return ''
    const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24))
    if (diff === 0) return '今日到期'
    if (diff === 1) return '明日到期'
    return `${diff} 天後`
}
</script>
