<template>
  <div v-if="remindersStore.pendingOwner.length > 0 || remindersStore.pendingVendor.length > 0 || remindersStore.upcomingAuto.length > 0"
    id="payment-reminders" class="mb-6">
    <h2 class="text-sm font-bold text-gray-700 mb-3">待付款清單</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-if="remindersStore.pendingOwner.length > 0">
        <div class="text-xs font-semibold mb-2" style="color:#c9a96e">向業主請款</div>
        <div class="flex flex-col gap-2">
          <div v-for="r in remindersStore.pendingOwner" :key="r.id"
            class="border border-amber-100 rounded-xl p-3 bg-amber-50/30">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-gray-800 truncate">{{ r.caseName }}</div>
                <div class="text-[11px] text-gray-500 mt-0.5">{{ r.workTypeName }} · {{ r.description }}</div>
                <div class="text-sm font-bold mt-1" style="color:#c9a96e">${{ (r.amount || 0).toLocaleString() }}</div>
                <div v-if="r.note" class="text-[11px] text-gray-400 mt-0.5">{{ r.note }}</div>
                <div class="text-[10px] text-gray-300 mt-1">{{ r.createdByName }} 建立</div>
              </div>
              <button v-if="authStore.isManager"
                @click="markDone(r.id)"
                class="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors whitespace-nowrap">
                標記完成
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="remindersStore.pendingVendor.length > 0">
        <div class="text-xs font-semibold text-blue-600 mb-2">廠商匯款</div>
        <div class="flex flex-col gap-2">
          <div v-for="r in remindersStore.pendingVendor" :key="r.id"
            class="border border-blue-100 rounded-xl p-3 bg-blue-50/30">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-gray-800 truncate">{{ r.caseName }}</div>
                <div class="text-[11px] text-gray-500 mt-0.5">{{ r.workTypeName }} · {{ r.description }}</div>
                <div class="text-sm font-bold text-gray-700 mt-1">${{ (r.amount || 0).toLocaleString() }}</div>
                <div v-if="r.note" class="text-[11px] text-gray-400 mt-0.5">{{ r.note }}</div>
                <div class="text-[10px] text-gray-300 mt-1">{{ r.createdByName }} 建立</div>
              </div>
              <button v-if="authStore.isManager"
                @click="markDone(r.id)"
                class="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors whitespace-nowrap">
                標記完成
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="remindersStore.upcomingAuto.length > 0" id="scheduled-reminders" class="mt-5">
      <div class="text-xs font-semibold text-blue-600 mb-3">排程提醒</div>
      <div class="flex flex-col gap-2">
        <div v-for="r in remindersStore.upcomingAuto" :key="r.id"
          class="border rounded-xl p-3"
          :class="r.type === 'owner' ? 'border-amber-100 bg-amber-50/30' : 'border-blue-100 bg-blue-50/30'">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  :class="isOverdue(r.dueDate) ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'">
                  {{ isOverdue(r.dueDate) ? '逾期' : r.dueDate }}
                </span>
                <span v-if="isOverdue(r.dueDate)" class="text-[10px] text-gray-400">{{ r.dueDate }}</span>
              </div>
              <div class="text-xs font-semibold text-gray-800 truncate">{{ r.caseName }}</div>
              <div class="text-[11px] text-gray-500 mt-0.5">
                {{ r.workTypeName }}<template v-if="r.vendorName"> · {{ r.vendorName }}</template>
              </div>
              <div class="text-sm font-bold mt-1"
                :style="r.type === 'owner' ? 'color:#c9a96e' : ''"
                :class="r.type === 'vendor' ? 'text-gray-700' : ''">
                ${{ (r.amount || 0).toLocaleString() }}
              </div>
              <div class="text-[10px] text-gray-300 mt-1">
                {{ r.type === 'owner' ? '業主請款' : '廠商付款' }}
              </div>
            </div>
            <button v-if="authStore.isManager" @click="markDone(r.id)"
              class="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors whitespace-nowrap">
              標記完成
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { usePaymentRemindersStore } from '@/stores/paymentReminders'
import { useAuthStore } from '@/stores/auth'

const remindersStore = usePaymentRemindersStore()
const authStore = useAuthStore()

function isOverdue(dueDate) {
    return !!dueDate && dueDate < new Date().toISOString().slice(0, 10)
}

async function markDone(id) {
    await remindersStore.markDone(id)
}
</script>
