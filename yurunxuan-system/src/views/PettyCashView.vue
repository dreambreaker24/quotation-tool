<template>
    <div class="flex-1 p-4 sm:p-6">
        <PettyCashManager />
    </div>
</template>
<script setup>
import { onMounted, onUnmounted } from 'vue'
import PettyCashManager from '@/components/pettyCash/PettyCashManager.vue'
import { usePettyCashStore } from '@/stores/pettyCash'

const store = usePettyCashStore()
onMounted(() => store.subscribe())
onUnmounted(() => store.cleanup())
</script>
