<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
    <!-- 柏 -->
    <div class="bg-white rounded-2xl shadow-sm px-4 py-3 border-t-4" style="border-top-color:#c9a96e">
      <div class="text-[11px] text-gray-400 mb-1">柏 零用金</div>
      <div class="flex items-baseline gap-1.5 mb-2">
        <span class="text-xl font-bold" :class="benBalance < 5000 ? 'text-red-500' : 'text-gray-800'">
          ${{ benBalance.toLocaleString() }}
        </span>
        <span class="text-xs text-gray-400">/ ${{ settings.benBudget?.toLocaleString() }}</span>
      </div>
      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all"
          :style="`width:${Math.min(100, Math.max(0, benBalance / (settings.benBudget || 1) * 100))}%;background:${benBalance < 5000 ? '#ef4444' : '#22c55e'}`"></div>
      </div>
    </div>

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

    <!-- 總計：柏＋蚌＋賴賴三人加起來 -->
    <div class="bg-white rounded-2xl shadow-sm px-4 py-3 border-t-4" style="border-top-color:#1f2937">
      <div class="text-[11px] text-gray-400 mb-1">總零用金</div>
      <div class="flex items-baseline gap-1.5 mb-2">
        <span class="text-xl font-bold" :class="totalBalance < 10000 ? 'text-red-500' : 'text-gray-800'">
          ${{ totalBalance.toLocaleString() }}
        </span>
        <span class="text-xs text-gray-400">/ ${{ totalBudget.toLocaleString() }}</span>
      </div>
      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all"
          :style="`width:${Math.min(100, Math.max(0, totalBalance / totalBudget * 100))}%;background:${totalBalance < 10000 ? '#ef4444' : '#1f2937'}`"></div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { usePettyCashStore } from '@/stores/pettyCash'

const store = usePettyCashStore()
const benBalance = computed(() => store.benBalance)
const bunBalance = computed(() => store.bunBalance)
const laiBalance = computed(() => store.laiBalance)
const totalBalance = computed(() => store.totalBalance)
const settings = computed(() => store.settings)
const totalBudget = computed(() => settings.value.totalBudget
    || (settings.value.benBudget || 10000) + (settings.value.bunBudget || 30000) + (settings.value.laiBudget || 10000))
</script>
