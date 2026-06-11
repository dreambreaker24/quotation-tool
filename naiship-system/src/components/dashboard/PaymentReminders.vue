<template>
  <div v-if="hasAny" id="payment-reminders" class="mb-6">
    <h2 class="text-sm font-bold text-gray-700 mb-3">付款清單</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

      <!-- 左半：廠商付款排程 -->
      <div id="scheduled-reminders">
        <div class="text-xs font-semibold text-blue-600 mb-2">廠商付款排程（本月底及下月）</div>
        <div v-if="vendorItems.length === 0" class="text-[11px] text-gray-400">本月底及下月無廠商付款排程</div>
        <div class="flex flex-col gap-2">
          <div v-for="r in vendorItems" :key="r.id"
            class="border border-blue-100 rounded-xl p-3 bg-blue-50/30">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div v-if="r.source === 'auto'" class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    :class="isOverdue(r.dueDate) ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'">
                    {{ isOverdue(r.dueDate) ? '逾期' : r.dueDate }}
                  </span>
                  <span v-if="isOverdue(r.dueDate)" class="text-[10px] text-gray-400">{{ r.dueDate }}</span>
                </div>
                <div class="text-xs font-semibold text-gray-800 truncate">{{ r.caseName }}</div>
                <div class="text-[11px] text-gray-500 mt-0.5">
                  {{ r.workTypeName }}<template v-if="r.vendorName"> · {{ r.vendorName }}</template>
                  <template v-if="r.description"> · {{ r.description }}</template>
                </div>
                <div class="text-sm font-bold text-gray-700 mt-1">${{ (r.amount || 0).toLocaleString() }}</div>
                <div v-if="r.note" class="text-[11px] text-gray-400 mt-0.5">{{ r.note }}</div>
              </div>
              <button v-if="authStore.isManager" @click="markDone(r.id)"
                :disabled="doneFeedback[r.id]"
                class="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                :class="doneFeedback[r.id] ? 'bg-green-500 text-white cursor-default' : 'bg-green-100 text-green-700 hover:bg-green-200'">
                {{ doneFeedback[r.id] ? '✓ 已完成' : '標記完成' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右半：待請款 -->
      <div id="owner-reminders">
        <div class="text-xs font-semibold mb-2" style="color:#c9a96e">待請款</div>
        <div v-if="ownerItems.length === 0" class="text-[11px] text-gray-400">目前無待請款項目</div>
        <div class="flex flex-col gap-2">
          <div v-for="r in ownerItems" :key="r.id"
            class="border border-amber-100 rounded-xl p-3 bg-amber-50/30">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div v-if="r.source === 'auto'" class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    :class="isOverdue(r.dueDate) ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'">
                    {{ isOverdue(r.dueDate) ? '逾期' : r.dueDate }}
                  </span>
                  <span v-if="isOverdue(r.dueDate)" class="text-[10px] text-gray-400">{{ r.dueDate }}</span>
                </div>
                <div class="text-xs font-semibold text-gray-800 truncate">{{ r.caseName }}</div>
                <div class="text-[11px] text-gray-500 mt-0.5">
                  {{ r.workTypeName }}<template v-if="r.description"> · {{ r.description }}</template>
                </div>
                <div class="text-sm font-bold mt-1" style="color:#c9a96e">${{ (r.amount || 0).toLocaleString() }}</div>
                <div v-if="r.note" class="text-[11px] text-gray-400 mt-0.5">{{ r.note }}</div>
                <div v-if="r.createdByName" class="text-[10px] text-gray-300 mt-1">{{ r.createdByName }} 建立</div>
              </div>
              <button v-if="authStore.isManager" @click="markDone(r.id)"
                :disabled="doneFeedback[r.id]"
                class="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                :class="doneFeedback[r.id] ? 'bg-green-500 text-white cursor-default' : 'bg-green-100 text-green-700 hover:bg-green-200'">
                {{ doneFeedback[r.id] ? '✓ 已完成' : '標記完成' }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'
import { useAuthStore } from '@/stores/auth'

const remindersStore = usePaymentRemindersStore()
const authStore = useAuthStore()
const doneFeedback = ref({})

function today() {
    return new Date().toISOString().slice(0, 10)
}

function isOverdue(dueDate) {
    return !!dueDate && dueDate < today()
}

function sortByOverdueThenDate(items) {
    return items.sort((a, b) => {
        const aOver = isOverdue(a.dueDate), bOver = isOverdue(b.dueDate)
        if (aOver !== bOver) return aOver ? -1 : 1
        return (a.dueDate || '').localeCompare(b.dueDate || '')
    })
}

const vendorItems = computed(() => sortByOverdueThenDate([
    ...remindersStore.pendingVendor,
    ...remindersStore.upcomingAutoSoon,
]))

const ownerItems = computed(() => sortByOverdueThenDate([
    ...remindersStore.pendingOwner,
    ...remindersStore.upcomingOwnerSoon,
].filter(r => (r.amount || 0) > 0)))

const hasAny = computed(() => vendorItems.value.length > 0 || ownerItems.value.length > 0)

async function markDone(id) {
    doneFeedback.value = { ...doneFeedback.value, [id]: true }
    await remindersStore.markDone(id)
}
</script>
