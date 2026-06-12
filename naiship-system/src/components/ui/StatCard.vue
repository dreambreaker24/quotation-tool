<template>
  <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 border-l-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default" style="border-left-color:#c9a96e">
    <div class="text-[11px] text-gray-400 mb-1 uppercase tracking-wide">{{ label }}</div>
    <div class="text-3xl font-bold" style="color:#c9a96e">{{ value }}</div>
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
