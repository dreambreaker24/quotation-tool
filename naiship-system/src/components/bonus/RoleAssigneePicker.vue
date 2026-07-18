<template>
  <div>
    <label class="text-xs text-gray-500 mb-1 block">{{ label }}</label>
    <div class="flex flex-wrap gap-2 mb-2">
      <label v-for="u in usersStore.users" :key="u.id" class="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-full px-2 py-1">
        <input type="checkbox" :checked="modelValue.includes(u.id)" @change="toggle(u.id)" class="rounded">
        {{ u.name }}
      </label>
    </div>
    <div v-if="modelValue.length > 1" class="flex flex-wrap gap-2">
      <div v-for="uid in modelValue" :key="uid" class="flex items-center gap-1 text-xs text-gray-500">
        {{ userName(uid) }}
        <input type="number" min="0" max="100" :value="split[uid] ?? defaultPercent"
          @input="setSplit(uid, $event.target.value)"
          class="w-14 border border-gray-200 rounded px-1 py-0.5 text-xs">%
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { useUsersStore } from '@/stores/users'

const props = defineProps({
    label: String,
    modelValue: { type: Array, default: () => [] },
    split: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'update:split'])

const usersStore = useUsersStore()
const defaultPercent = computed(() => props.modelValue.length ? Math.floor(100 / props.modelValue.length) : 0)

function userName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? uid
}

function toggle(uid) {
    const wasSelected = props.modelValue.includes(uid)
    const next = wasSelected
        ? props.modelValue.filter(id => id !== uid)
        : [...props.modelValue, uid]
    emit('update:modelValue', next)
    if (!wasSelected && next.length > 1) {
        const evenPercent = Math.floor(100 / next.length)
        const seededSplit = { ...props.split }
        next.forEach(id => {
            if (typeof seededSplit[id] !== 'number') seededSplit[id] = evenPercent
        })
        emit('update:split', seededSplit)
    }
}

function setSplit(uid, value) {
    emit('update:split', { ...props.split, [uid]: Number(value) || 0 })
}
</script>
