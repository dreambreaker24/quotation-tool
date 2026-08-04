<template>
  <div class="relative" ref="bellRef">
    <button @click="toggle"
      class="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span v-if="count > 0"
        class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
        {{ count > 99 ? '99+' : count }}
      </span>
    </button>

    <div v-if="open"
      class="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden border-t-4" style="border-top-color:#c9a96e">
      <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span class="text-sm font-semibold text-gray-800">通知</span>
        <span v-if="count > 0" class="text-[11px] text-gray-400">{{ count }} 則未讀</span>
      <span v-else-if="notifications.length > 0" class="text-[11px] text-gray-400">全部已讀</span>
      </div>

      <div class="max-h-80 overflow-y-auto">
        <div v-if="notifications.length === 0" class="px-4 py-8 text-center text-sm text-gray-400">
          目前沒有通知
        </div>
        <button v-for="n in notifications" :key="n.id"
          @click="handleClick(n)"
          class="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
          :class="n.read ? 'opacity-50' : ''">
          <div class="text-xs leading-snug flex items-start gap-1.5" :class="n.read ? 'text-gray-400' : 'text-gray-800'">
            <span class="flex-shrink-0 text-sm leading-none mt-0.5">{{ notifIcon(n.message) }}</span>
            <span :class="n.deleted ? 'line-through opacity-60' : ''">
              <span v-if="n.actorName" class="font-semibold">{{ n.actorName }}</span> {{ n.message }}
            </span>
            <span v-if="n.deleted" class="flex-shrink-0 text-[10px] text-gray-400 bg-gray-100 rounded px-1 py-0.5 ml-0.5 no-underline">已刪除</span>
          </div>
          <div class="text-[10px] text-gray-400 mt-1">{{ formatTime(n.createdAt) }}</div>
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { useNavStore } from '@/stores/nav'

const router = useRouter()
const notifStore = useNotificationsStore()
const authStore = useAuthStore()
const navStore = useNavStore()
const open = ref(false)
const bellRef = ref(null)

const notifications = computed(() => notifStore.notifications)
const count = computed(() => notifications.value.filter(n => !n.read).length)

watch(() => authStore.user?.uid, (uid) => {
    if (uid) notifStore.subscribe(uid)
}, { immediate: true })

onMounted(() => {
    document.addEventListener('click', onOutsideClick)
})

onUnmounted(() => {
    document.removeEventListener('click', onOutsideClick)
    notifStore.cleanup()
})

function toggle() { open.value = !open.value }

function onOutsideClick(e) {
    if (bellRef.value && !bellRef.value.contains(e.target)) open.value = false
}

async function handleClick(n) {
    open.value = false
    await notifStore.markRead(n.id)
    if (n.caseId) {
        navStore.requestCaseJump(n.caseId, n.tab || '', n.companyId || '', n.photoType || '')
        router.push({ path: '/cases', query: n.companyId ? { region: n.companyId } : {} })
    } else if (n.message.includes('工作日誌')) {
        const q = { tab: 'log' }
        if (n.logDate) q.date = n.logDate
        if (n.logUserId) q.logUserId = n.logUserId
        router.push({ path: '/cases', query: q })
    } else if (n.tab === 'cal' || n.message.includes('行程')) {
        const q = { tab: 'cal' }
        if (n.eventDate) q.eventDate = n.eventDate
        if (n.companyId) q.region = n.companyId
        router.push({ path: '/cases', query: q })
    } else if (n.message.includes('公司佈達')) {
        router.push({ path: '/cases', query: { tab: 'announcement' } })
    } else if (n.message.includes('聯繫記錄')) {
        router.push({ path: '/clients', query: n.clientId ? { clientId: n.clientId } : {} })
    }
}

function notifIcon(message) {
    if (message.includes('新增了案件')) return '📋'
    if (message.includes('的工種')) return '🔧'
    if (message.includes('的收款')) return '💰'
    if (message.includes('待辦事項')) return '✅'
    if (message.includes('案件檢討')) return '📝'
    if (message.includes('上傳了')) return '📷'
    if (message.includes('公司佈達')) return '📢'
    if (message.includes('回覆了')) return '💬'
    if (message.includes('工作日誌')) return '📓'
    if (message.includes('刪除了行程')) return '🗑️'
    if (message.includes('修改了行程')) return '✏️'
    if (message.includes('新增了行程')) return '📅'
    if (message.includes('更新了')) return '✏️'
    return '🔔'
}

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    const now = new Date()
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>
