<template>
  <template v-if="route.meta.public">
    <router-view />
  </template>
  <template v-else>
    <NavBar />
    <div class="flex pt-14 min-h-screen bg-gray-100">
      <router-view />
    </div>
  </template>
</template>
<script setup>
import { useRoute } from 'vue-router'
import NavBar from '@/components/layout/NavBar.vue'
const route = useRoute()
</script>
