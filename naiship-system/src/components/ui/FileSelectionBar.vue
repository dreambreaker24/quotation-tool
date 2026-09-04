<template>
  <div class="flex items-center gap-2 flex-wrap py-1">
    <button v-if="!selecting" type="button" @click="$emit('start')"
      class="text-[11px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors">
      選取
    </button>
    <template v-else>
      <button type="button" @click="$emit('select-all')"
        class="text-[11px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors">
        全選
      </button>
      <span class="text-[11px] text-gray-400">已選 {{ count }}</span>
      <button type="button" :disabled="count === 0" @click="$emit('download')"
        class="text-[11px] px-2.5 py-1 rounded-lg text-white disabled:opacity-40 transition-colors" style="background:#1e2533">
        下載
      </button>
      <button v-if="canShare" type="button" :disabled="count === 0" @click="$emit('share')"
        class="text-[11px] px-2.5 py-1 rounded-lg text-white disabled:opacity-40 transition-colors" style="background:#c9a96e">
        分享
      </button>
      <button type="button" @click="$emit('stop')" class="text-[11px] px-2 py-1 text-gray-400 hover:text-gray-600 transition-colors">
        取消
      </button>
    </template>
  </div>
</template>

<script setup>
defineProps({
    selecting: { type: Boolean, default: false },
    count: { type: Number, default: 0 },
    canShare: { type: Boolean, default: false },
})
defineEmits(['start', 'stop', 'select-all', 'download', 'share'])
</script>
