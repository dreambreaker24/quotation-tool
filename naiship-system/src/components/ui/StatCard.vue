<template>
  <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div class="text-[11px] text-gray-400 mb-1">{{ label }}</div>
    <div class="text-2xl font-bold text-gray-800">{{ value }}</div>
    <div v-if="trend" data-test="trend" class="text-[11px] mt-1" :class="trendColor">{{ trend }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: String,
  value: String,
  trend: String
})

const trendColor = computed(() => props.trend?.startsWith('+') ? 'text-green-500' : 'text-red-400')
</script>
