<template>
  <!-- Desktop sidebar -->
  <div class="hidden lg:block bg-white rounded-2xl shadow-sm flex-shrink-0 overflow-hidden" style="width:200px">
    <div class="px-4 py-3 border-b border-gray-100">
      <div class="text-xs font-semibold text-gray-500 mb-2">選擇員工</div>
      <input v-model="search" type="text" placeholder="搜尋..."
        class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
    </div>
    <div class="py-1">
      <div @click="$emit('update:modelValue', null)"
        class="px-4 py-2.5 cursor-pointer flex items-center gap-2"
        :style="!modelValue ? 'background:rgba(201,169,110,0.1);border-left:2px solid #c9a96e' : ''"
        :class="!modelValue ? '' : 'hover:bg-gray-50'">
        <span class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">全</span>
        <span class="text-xs text-gray-500">全部員工</span>
      </div>
      <div v-for="emp in filtered" :key="emp.id"
        @click="$emit('update:modelValue', emp)"
        class="px-4 py-2.5 cursor-pointer flex items-center gap-2.5 transition-colors"
        :class="[modelValue?.id !== emp.id ? 'hover:bg-gray-50' : '', !emp.hasLog ? 'bg-red-50/40' : '']"
        :style="modelValue?.id === emp.id ? 'background:rgba(201,169,110,0.1);border-left:3px solid #c9a96e' : 'border-left:3px solid transparent'">
        <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ring-2 ring-offset-1"
          :style="`background:${empColor(emp.name)};ring-color:${empColor(emp.name)}40`">{{ emp.name?.[0] ?? '?' }}</span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-semibold text-gray-800">{{ emp.name }}</div>
          <div v-if="emp.hasLog" class="text-[10px] text-gray-400">今日已填寫</div>
          <div v-else class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block bg-red-500 text-white mt-0.5">⚠ 未填寫</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile select -->
  <select :value="modelValue?.id ?? null" @change="$emit('update:modelValue', filtered.find(e => e.id === $event.target.value) ?? null)"
    class="lg:hidden text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white mb-2 w-full min-h-[44px]">
    <option :value="null">全部員工</option>
    <option v-for="emp in filtered" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
  </select>
</template>
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ employees: Array, modelValue: Object })
defineEmits(['update:modelValue'])

const search = ref('')
const filtered = computed(() =>
    props.employees.filter(e => !search.value || e.name?.includes(search.value))
)

const MEMBER_COLORS = { '柏': '#c9a96e', '其宏': '#1f2937', '蚌': '#ef4444' }
function empColor(name) {
    if (!name) return '#9ca3af'
    if (MEMBER_COLORS[name]) return MEMBER_COLORS[name]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
    const fallback = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#14b8a6', '#f97316']
    return fallback[hash % fallback.length]
}
</script>
