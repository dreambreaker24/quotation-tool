<template>
  <div class="bg-white rounded-2xl shadow-sm p-5">
    <h2 class="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">案件狀態</h2>
    <v-chart :option="option" style="height:200px;width:100%" autoresize />
    <div class="flex flex-col gap-1.5 mt-2">
      <div v-for="d in data" :key="d.name" class="flex items-center gap-2 text-xs text-gray-600">
        <span class="w-3 h-3 rounded-full flex-shrink-0" :style="`background:${d.color}`"></span>
        {{ d.name }} ({{ d.value }})
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart as EPie } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([EPie, TooltipComponent, CanvasRenderer])

const props = defineProps({ data: Array })
const option = computed(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 件' },
    series: [{
        type: 'pie', radius: ['40%', '70%'],
        data: props.data.map(d => ({ value: d.value, name: d.name, itemStyle: { color: d.color } })),
        label: { show: false }
    }]
}))
</script>
