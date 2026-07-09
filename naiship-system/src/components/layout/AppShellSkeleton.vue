<template>
  <div class="h-14 flex items-center px-4 sm:px-6 gap-4 fixed top-0 left-0 right-0 z-50" style="background:#1e2533">
    <div class="w-7 h-7 rounded flex items-center justify-center font-bold text-xs flex-shrink-0" style="background:#c9a96e;color:#1e2533">奈</div>
    <div class="h-3 rounded-full sk" style="width:120px"></div>
    <div class="ml-auto flex items-center gap-3">
      <div class="h-3 rounded-full sk" style="width:70px"></div>
      <div class="w-8 h-8 rounded-full sk flex-shrink-0"></div>
    </div>
  </div>
  <div class="pt-14 min-h-screen px-6 py-6" style="background:#f5f4f1">
    <div class="h-6 rounded-lg sk mb-4" style="width:180px"></div>
    <div class="h-32 rounded-2xl sk mb-4"></div>
    <div class="h-32 rounded-2xl sk"></div>
  </div>
</template>
<style scoped>
.sk {
  background: linear-gradient(90deg, #e5e2d8 25%, #f0ede5 37%, #e5e2d8 63%);
  background-size: 400% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .sk { animation: none; }
}
@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
</style>
