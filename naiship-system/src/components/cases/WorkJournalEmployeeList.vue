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
        class="px-4 py-2.5 cursor-pointer flex items-center gap-2"
        :style="modelValue?.id === emp.id ? 'background:rgba(201,169,110,0.1);border-left:2px solid #c9a96e' : ''"
        :class="modelValue?.id !== emp.id ? 'hover:bg-gray-50' : ''">
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          :style="`background:${empColor(emp.id)}`">{{ emp.name?.[0] ?? '?' }}</span>
        <div>
          <div class="text-xs font-semibold text-gray-800">{{ emp.name }}</div>
          <div class="text-[10px]" :class="emp.hasLog ? 'text-gray-400' : 'text-amber-500'">
            {{ emp.hasLog ? '今日已填寫' : '⚠ 未填寫' }}
          </div>
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

const EMP_COLORS = ['#c9a96e', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']
function empColor(uid) { return EMP_COLORS[(uid?.charCodeAt(0) ?? 0) % EMP_COLORS.length] }
</script>
