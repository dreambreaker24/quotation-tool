<template>
  <div class="grid grid-cols-3 gap-3 mb-4">
    <!-- 蚌 -->
    <div class="bg-white rounded-2xl shadow-sm px-4 py-3 border-t-4" style="border-top-color:#ef4444">
      <div class="text-[11px] text-gray-400 mb-1">蚌 零用金</div>
      <div class="flex items-baseline gap-1.5 mb-2">
        <span class="text-xl font-bold" :class="bunBalance < 5000 ? 'text-red-500' : 'text-gray-800'">
          ${{ bunBalance.toLocaleString() }}
        </span>
        <span class="text-xs text-gray-400">/ ${{ settings.bunBudget?.toLocaleString() }}</span>
      </div>
      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all"
          :style="`width:${Math.min(100, Math.max(0, bunBalance / (settings.bunBudget || 1) * 100))}%;background:${bunBalance < 5000 ? '#ef4444' : '#22c55e'}`"></div>
      </div>
    </div>

    <!-- 賴賴 -->
    <div class="bg-white rounded-2xl shadow-sm px-4 py-3 border-t-4" style="border-top-color:#a855f7">
      <div class="text-[11px] text-gray-400 mb-1">賴賴 零用金</div>
      <div class="flex items-baseline gap-1.5 mb-2">
        <span class="text-xl font-bold" :class="laiBalance < 5000 ? 'text-red-500' : 'text-gray-800'">
          ${{ laiBalance.toLocaleString() }}
        </span>
        <span class="text-xs text-gray-400">/ ${{ settings.laiBudget?.toLocaleString() }}</span>
      </div>
      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all"
          :style="`width:${Math.min(100, Math.max(0, laiBalance / (settings.laiBudget || 1) * 100))}%;background:${laiBalance < 5000 ? '#ef4444' : '#22c55e'}`"></div>
      </div>
    </div>

    <!-- 總計 -->
    <div class="bg-white rounded-2xl shadow-sm px-4 py-3 border-t-4" style="border-top-color:#c9a96e">
      <div class="text-[11px] text-gray-400 mb-1">總零用金</div>
      <div class="text-xl font-bold" :class="totalBalance < 10000 ? 'text-red-500' : 'text-gray-800'">
        ${{ totalBalance.toLocaleString() }}
      </div>
      <div class="text-[10px] mt-1.5" :class="totalBalance < 10000 ? 'text-red-400' : 'text-gray-400'">
        {{ totalBalance < 10000 ? '⚠ 低於補款門檻' : '正常' }}
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { usePettyCashStore } from '@/stores/pettyCash'

const store = usePettyCashStore()
const bunBalance = computed(() => store.bunBalance)
const laiBalance = computed(() => store.laiBalance)
const totalBalance = computed(() => store.totalBalance)
const settings = computed(() => store.settings)
</script>
