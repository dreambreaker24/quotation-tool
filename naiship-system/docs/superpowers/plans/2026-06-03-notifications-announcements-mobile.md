# 通知系統 + 公司佈達 + 工作日誌手機版 + 改名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 App 內通知系統、公司佈達 Tab、工作日誌手機版響應式，並將「客戶管理」改名為「客戶/廠商」。

**Architecture:** 通知存 Firestore `notifications` collection，前端 real-time onSnapshot 監聽。公司佈達獨立 `announcements` collection，未讀狀態用 localStorage。工作日誌在現有元件加 Tailwind 響應式 class，不建立獨立元件。

**Tech Stack:** Vue 3 + Pinia + Firebase Firestore + Tailwind CSS v4 + Cloudinary（圖片上傳）

---

## File Map

| 動作 | 檔案 |
|------|------|
| **新增** | `src/stores/notifications.js` |
| **新增** | `src/components/layout/NotificationBell.vue` |
| **新增** | `src/components/cases/AnnouncementTab.vue` |
| **修改** | `src/components/layout/NavBar.vue` |
| **修改** | `src/views/ClientsView.vue` |
| **修改** | `src/views/CasesView.vue` |
| **修改** | `src/components/cases/CaseEditModal.vue` |
| **修改** | `src/components/cases/WorkTypePanel.vue` |
| **修改** | `src/components/cases/PaymentMilestones.vue` |
| **修改** | `src/components/cases/CaseTasks.vue` |
| **修改** | `src/components/cases/CaseReview.vue` |
| **修改** | `src/components/cases/PhotoUpload.vue` |
| **修改** | `src/components/cases/WorkJournalTab.vue` |
| **修改** | `firestore.rules` |

---

## Task 1: 客戶/廠商 改名

**Files:**
- Modify: `src/components/layout/NavBar.vue`
- Modify: `src/views/ClientsView.vue`

- [ ] **Step 1: 改 NavBar.vue 的 navItems label**

在 `src/components/layout/NavBar.vue` 找到：
```js
{ to: '/clients', label: '客戶管理' },
```
改為：
```js
{ to: '/clients', label: '客戶/廠商' },
```

- [ ] **Step 2: 改 ClientsView.vue 的頁面標題**

在 `src/views/ClientsView.vue` 找到（tab label，約第 150 行）：
```js
{ id: 'clients', label: '客戶管理' },
```
改為：
```js
{ id: 'clients', label: '客戶/廠商' },
```

- [ ] **Step 3: Commit**

```bash
cd "C:\AI助理 Claude\naiship-system"
git add src/components/layout/NavBar.vue src/views/ClientsView.vue
git commit -m "feat: 客戶管理改名為客戶/廠商"
```

---

## Task 2: notifications.js store

**Files:**
- Create: `src/stores/notifications.js`

- [ ] **Step 1: 建立 notifications store**

新增 `src/stores/notifications.js`：

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'

export const useNotificationsStore = defineStore('notifications', () => {
    const notifications = ref([])
    let unsubscribe = null

    function subscribe(uid) {
        if (unsubscribe) unsubscribe()
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', uid),
            orderBy('createdAt', 'desc')
        )
        unsubscribe = onSnapshot(q, snap => {
            notifications.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        notifications.value = []
    }

    async function notifyAll(actorName, message, caseId, caseName) {
        const authStore = useAuthStore()
        const usersStore = useUsersStore()
        const currentUid = authStore.user?.uid
        const jobs = []
        for (const u of usersStore.users) {
            if (u.id === currentUid || u.disabled) continue
            jobs.push(addDoc(collection(db, 'notifications'), {
                userId: u.id,
                actorName,
                message,
                caseId: caseId ?? '',
                caseName: caseName ?? '',
                createdAt: serverTimestamp(),
            }))
        }
        await Promise.all(jobs)
    }

    async function markRead(id) {
        await deleteDoc(doc(db, 'notifications', id))
    }

    return { notifications, subscribe, cleanup, notifyAll, markRead }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/notifications.js
git commit -m "feat(notifications): 新增 notifications store"
```

---

## Task 3: NotificationBell.vue

**Files:**
- Create: `src/components/layout/NotificationBell.vue`

- [ ] **Step 1: 建立 NotificationBell 元件**

新增 `src/components/layout/NotificationBell.vue`：

```vue
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
      class="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span class="text-sm font-semibold text-gray-800">通知</span>
        <span v-if="count > 0" class="text-[11px] text-gray-400">{{ count }} 則未讀</span>
      </div>

      <div class="max-h-80 overflow-y-auto">
        <div v-if="notifications.length === 0" class="px-4 py-8 text-center text-sm text-gray-400">
          目前沒有通知
        </div>
        <button v-for="n in notifications" :key="n.id"
          @click="handleClick(n)"
          class="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
          <div class="text-xs text-gray-800 leading-snug">
            <span class="font-semibold">{{ n.actorName }}</span>
            {{ n.message }}
          </div>
          <div class="text-[10px] text-gray-400 mt-1">{{ formatTime(n.createdAt) }}</div>
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const notifStore = useNotificationsStore()
const authStore = useAuthStore()
const open = ref(false)
const bellRef = ref(null)

const notifications = computed(() => notifStore.notifications)
const count = computed(() => notifications.value.length)

onMounted(() => {
    if (authStore.user?.uid) notifStore.subscribe(authStore.user.uid)
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
        router.push({ path: '/cases', query: { caseId: n.caseId } })
    }
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/NotificationBell.vue
git commit -m "feat(notifications): 新增 NotificationBell 元件"
```

---

## Task 4: NavBar.vue 整合通知鈴鐺

**Files:**
- Modify: `src/components/layout/NavBar.vue`

- [ ] **Step 1: 在 NavBar 加入 NotificationBell**

將 `src/components/layout/NavBar.vue` 改為：

```vue
<template>
  <nav class="text-white h-14 flex items-center px-6 gap-4 fixed top-0 left-0 right-0 z-50" style="background:#1e2533">
    <div class="flex items-center gap-3 mr-4">
      <div class="w-7 h-7 rounded flex items-center justify-center font-bold text-xs" style="background:#c9a96e;color:#1e2533">奈</div>
      <span class="font-semibold text-sm tracking-wide">奈拾設計 管理系統</span>
    </div>
    <div class="flex gap-1">
      <router-link v-for="item in navItems" :key="item.to" :to="item.to"
        class="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white transition-colors relative"
        active-class="text-white"
        :style="isActive(item.to) ? 'background:rgba(255,255,255,0.1)' : ''">
        {{ item.label }}
        <span v-if="item.to === '/clients' && hasFollowUpDue"
          class="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
      </router-link>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <NotificationBell />
      <span class="text-xs text-gray-400">{{ auth.name }}（{{ roleLabel }}）</span>
      <button @click="auth.logout()" class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style="background:#c9a96e;color:#1e2533">
        {{ auth.name?.[0] ?? '?' }}
      </button>
    </div>
  </nav>
</template>
<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { useRoute } from 'vue-router'
import NotificationBell from './NotificationBell.vue'

const auth = useAuthStore()
const clientsStore = useClientsStore()
const route = useRoute()
const roleLabel = computed(() => ({ admin: '管理者', manager: '主管', employee: '員工' }[auth.role] ?? ''))
const todayStr = new Date().toISOString().slice(0, 10)
const hasFollowUpDue = computed(() =>
    clientsStore.clients.some(c => c.followUpDate && c.followUpDate <= todayStr)
)
const navItems = computed(() => [
  ...(auth.isManager ? [{ to: '/', label: '首頁總覽' }] : []),
  { to: '/cases', label: '案件管理' },
  { to: '/clients', label: '客戶/廠商' },
  { to: '/settings', label: '系統設定' }
])
function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/NavBar.vue
git commit -m "feat(notifications): NavBar 加入通知鈴鐺，客戶管理改名"
```

---

## Task 5: 通知觸發 — CasesView + CaseEditModal

**Files:**
- Modify: `src/views/CasesView.vue`
- Modify: `src/components/cases/CaseEditModal.vue`

- [ ] **Step 1: CasesView.vue — 新增案件後發通知**

在 `src/views/CasesView.vue` 的 import 區加：
```js
import { useNotificationsStore } from '@/stores/notifications'
```

在 script setup 區加（接在 `const { toast } = useToast()` 之後）：
```js
const notifStore = useNotificationsStore()
```

在 `submitCase` 函式的 `toast('案件已建立')` 之後加：
```js
notifStore.notifyAll(authStore.name ?? '', `新增了案件「${caseForm.value.name}」`, docRef?.id ?? '', caseForm.value.name)
```

在 `onMounted` 加上 caseId query watcher（讓通知跳轉在已開啟 `/cases` 時也有效）：
```js
watch(() => route.query.caseId, (id) => {
    if (id) jumpToCase(id)
})
```

並在 imports 補上 `watch`（若原本沒有）：
```js
import { ref, computed, onMounted, watch } from 'vue'
```

- [ ] **Step 2: CaseEditModal.vue — 儲存案件後發通知**

在 `src/components/cases/CaseEditModal.vue` 的 import 區加：
```js
import { useNotificationsStore } from '@/stores/notifications'
```

在 script setup 加：
```js
const notifStore = useNotificationsStore()
```

在 `save()` 函式的 `toast('案件已儲存')` 之後加：
```js
notifStore.notifyAll(authStore.name ?? '', `更新了「${caseData.value?.name ?? ''}」`, props.caseId, caseData.value?.name ?? '')
```

（需確認 `authStore` 已在 CaseEditModal import，若無則補上 `import { useAuthStore } from '@/stores/auth'` 和 `const authStore = useAuthStore()`）

- [ ] **Step 3: Commit**

```bash
git add src/views/CasesView.vue src/components/cases/CaseEditModal.vue
git commit -m "feat(notifications): CasesView 和 CaseEditModal 加通知觸發"
```

---

## Task 6: 通知觸發 — 案件子操作元件

**Files:**
- Modify: `src/components/cases/WorkTypePanel.vue`
- Modify: `src/components/cases/PaymentMilestones.vue`
- Modify: `src/components/cases/CaseTasks.vue`
- Modify: `src/components/cases/CaseReview.vue`
- Modify: `src/components/cases/PhotoUpload.vue`

各檔案統一做法：

**A. import 加入：**
```js
import { useNotificationsStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'  // 若原本沒有
```

**B. script setup 加入：**
```js
const notifStore = useNotificationsStore()
const authStore = useAuthStore()  // 若原本沒有
```

**C. 各元件的觸發點：**

- [ ] **WorkTypePanel.vue** — 在 `submitForm()` 的 `toast('...')` 之後（約第 465 行附近）：
```js
notifStore.notifyAll(authStore.name ?? '', `更新了「${props.caseName}」的工種`, props.caseId, props.caseName)
```

- [ ] **PaymentMilestones.vue** — 在 `submitForm()` 的 `toast('...')` 之後（約第 270 行附近）：
```js
notifStore.notifyAll(authStore.name ?? '', `更新了「${props.caseName}」的收款里程碑`, props.caseId, props.caseName)
```

- [ ] **CaseTasks.vue** — 在 `submitAdd()` 的 `toast('已送出')` 之後（約第 259 行附近）：
```js
notifStore.notifyAll(authStore.name ?? '', `在「${props.caseName}」新增了待辦事項`, props.caseId, props.caseName)
```

- [ ] **CaseReview.vue** — 在 `submitReview()` 成功儲存後（`showForm.value = false` 之後）：
```js
notifStore.notifyAll(authStore.name ?? '', `在「${props.caseName}」新增了案件檢討`, props.caseId, props.caseName)
```

- [ ] **PhotoUpload.vue** — 在 `uploadFiles()` 成功後（toast 之後）：
```js
notifStore.notifyAll(authStore.name ?? '', `在「${props.caseName}」上傳了照片`, props.caseId, props.caseName)
```

（PhotoUpload 的 props 需確認有 `caseName`，若無則改為 `'一個案件'`）

- [ ] **Commit：**

```bash
git add src/components/cases/WorkTypePanel.vue src/components/cases/PaymentMilestones.vue src/components/cases/CaseTasks.vue src/components/cases/CaseReview.vue src/components/cases/PhotoUpload.vue
git commit -m "feat(notifications): 案件子操作元件加通知觸發"
```

---

## Task 7: AnnouncementTab.vue

**Files:**
- Create: `src/components/cases/AnnouncementTab.vue`

- [ ] **Step 1: 建立公司佈達元件**

新增 `src/components/cases/AnnouncementTab.vue`：

```vue
<template>
  <div class="flex flex-col gap-4">
    <!-- 主管：新增按鈕 -->
    <div v-if="authStore.isManager" class="flex justify-end">
      <button @click="openAdd"
        class="text-sm text-white px-4 py-2 rounded-xl" style="background:#1e2533">
        + 新增公告
      </button>
    </div>

    <!-- 空白狀態 -->
    <div v-if="announcements.length === 0" class="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400 text-sm">
      目前尚無公司佈達
    </div>

    <!-- 置頂最新公告 -->
    <div v-if="announcements.length > 0" class="bg-white rounded-2xl shadow-sm p-6">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold mr-2">最新公告</span>
          <span class="text-base font-bold text-gray-800">{{ latest.title }}</span>
        </div>
        <div v-if="authStore.isManager" class="flex gap-2 flex-shrink-0">
          <button @click="openEdit(latest)" class="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1">編輯</button>
          <button @click="remove(latest)" class="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2 py-1">刪除</button>
        </div>
      </div>
      <p class="text-sm text-gray-700 whitespace-pre-wrap mb-4">{{ latest.content }}</p>
      <div v-if="latest.images?.length" class="flex gap-2 flex-wrap mb-4">
        <img v-for="url in latest.images" :key="url" :src="url"
          @click="previewUrl = url"
          class="w-24 h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity">
      </div>
      <div class="text-[11px] text-gray-400">{{ latest.createdByName }} · {{ formatDate(latest.createdAt) }}</div>
    </div>

    <!-- 舊公告清單 -->
    <div v-if="older.length > 0" class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500">舊公告</div>
      <div v-for="a in older" :key="a.id" class="border-b border-gray-50 last:border-0">
        <button @click="toggleExpand(a.id)"
          class="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 text-left transition-colors">
          <div>
            <div class="text-sm font-semibold text-gray-700">{{ a.title }}</div>
            <div class="text-[11px] text-gray-400 mt-0.5">{{ a.createdByName }} · {{ formatDate(a.createdAt) }}</div>
          </div>
          <div class="flex items-center gap-2">
            <div v-if="authStore.isManager" class="flex gap-1">
              <span @click.stop="openEdit(a)" class="text-[11px] text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-1.5 py-0.5">編輯</span>
              <span @click.stop="remove(a)" class="text-[11px] text-red-400 hover:text-red-600 border border-red-100 rounded px-1.5 py-0.5">刪除</span>
            </div>
            <span class="text-gray-400 text-xs">{{ expanded.has(a.id) ? '▲' : '▼' }}</span>
          </div>
        </button>
        <div v-if="expanded.has(a.id)" class="px-5 pb-4">
          <p class="text-sm text-gray-700 whitespace-pre-wrap mb-3">{{ a.content }}</p>
          <div v-if="a.images?.length" class="flex gap-2 flex-wrap">
            <img v-for="url in a.images" :key="url" :src="url"
              @click="previewUrl = url"
              class="w-20 h-20 object-cover rounded-xl cursor-pointer hover:opacity-80">
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 新增/編輯 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-gray-800">{{ editingId ? '編輯公告' : '新增公告' }}</h3>
        <button @click="closeForm" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-4">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">標題 *</label>
          <input v-model="form.title" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="公告標題">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">內容 *</label>
          <textarea v-model="form.content" rows="5"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="公告內容..."></textarea>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500">圖片（選填）</label>
            <button @click="imgInput.click()" class="text-xs" style="color:#c9a96e">+ 新增圖片</button>
          </div>
          <div v-if="existingImages.length" class="flex gap-2 flex-wrap mb-2">
            <div v-for="(url, i) in existingImages" :key="url" class="relative">
              <img :src="url" class="w-16 h-16 object-cover rounded-xl">
              <button @click="existingImages.splice(i, 1)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] flex items-center justify-center">✕</button>
            </div>
          </div>
          <div v-if="pendingImages.length" class="flex gap-2 flex-wrap">
            <div v-for="(f, i) in pendingImages" :key="i" class="relative">
              <img :src="f.preview" class="w-16 h-16 object-cover rounded-xl">
              <button @click="pendingImages.splice(i, 1)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] flex items-center justify-center">✕</button>
            </div>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="closeForm" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitForm" :disabled="saving" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ saving ? '儲存中…' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
  <input ref="imgInput" type="file" accept="image/*" multiple class="hidden" @change="handleImages">

  <!-- 圖片預覽 -->
  <div v-if="previewUrl" @click="previewUrl = null" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { collection, addDoc, getDocs, deleteDoc, updateDoc, orderBy, query, serverTimestamp, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { uploadPhoto } from '@/composables/useStorage'
import { useToast } from '@/composables/useToast'

const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const announcements = ref([])
const expanded = ref(new Set())
const showForm = ref(false)
const editingId = ref(null)
const saving = ref(false)
const previewUrl = ref(null)
const imgInput = ref(null)
const form = ref({ title: '', content: '' })
const existingImages = ref([])
const pendingImages = ref([])

const latest = computed(() => announcements.value[0] ?? null)
const older = computed(() => announcements.value.slice(1))

onMounted(async () => {
    localStorage.setItem('announcementLastRead', Date.now().toString())
    await load()
})

async function load() {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    announcements.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

function toggleExpand(id) {
    const s = new Set(expanded.value)
    s.has(id) ? s.delete(id) : s.add(id)
    expanded.value = s
}

function openAdd() {
    editingId.value = null
    form.value = { title: '', content: '' }
    existingImages.value = []
    pendingImages.value = []
    showForm.value = true
}

function openEdit(a) {
    editingId.value = a.id
    form.value = { title: a.title, content: a.content }
    existingImages.value = [...(a.images ?? [])]
    pendingImages.value = []
    showForm.value = true
}

function closeForm() { showForm.value = false }

function handleImages(e) {
    Array.from(e.target.files).forEach(file => {
        pendingImages.value.push({ file, preview: URL.createObjectURL(file) })
    })
    e.target.value = ''
}

async function submitForm() {
    if (!form.value.title.trim() || !form.value.content.trim() || saving.value) return
    saving.value = true
    try {
        const newUrls = []
        for (const p of pendingImages.value) {
            try { newUrls.push(await uploadPhoto(p.file, 'announcement')) } catch { /* skip */ }
        }
        const images = [...existingImages.value, ...newUrls]
        if (editingId.value) {
            await updateDoc(doc(db, 'announcements', editingId.value), {
                title: form.value.title.trim(),
                content: form.value.content.trim(),
                images,
                updatedAt: serverTimestamp(),
            })
            toast('公告已更新')
        } else {
            await addDoc(collection(db, 'announcements'), {
                title: form.value.title.trim(),
                content: form.value.content.trim(),
                images,
                createdBy: authStore.user?.uid ?? '',
                createdByName: authStore.name ?? '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            })
            toast('公告已發布')
            notifStore.notifyAll(authStore.name ?? '', `發布了公司佈達「${form.value.title.trim()}」`, '', '')
        }
        closeForm()
        await load()
    } finally {
        saving.value = false
    }
}

async function remove(a) {
    if (!confirm(`確定刪除「${a.title}」？`)) return
    await deleteDoc(doc(db, 'announcements', a.id))
    announcements.value = announcements.value.filter(x => x.id !== a.id)
    toast('公告已刪除')
}

function formatDate(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cases/AnnouncementTab.vue
git commit -m "feat(announcements): 新增公司佈達元件"
```

---

## Task 8: CasesView.vue 加公司佈達 Tab

**Files:**
- Modify: `src/views/CasesView.vue`

- [ ] **Step 1: 加入公司佈達 Tab 和未讀紅點邏輯**

在 `src/views/CasesView.vue` 的 import 區加：
```js
import AnnouncementTab from '@/components/cases/AnnouncementTab.vue'
import { getDocs, collection, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/firebase'
```

在 `tabs` array 加第四個 Tab：
```js
const tabs = [
    { id: 'cal', label: '行事曆' },
    { id: 'gantt', label: '案件進度' },
    { id: 'log', label: '工作日誌' },
    { id: 'announcement', label: '公司佈達' },
]
```

在 script setup 加未讀紅點 state：
```js
const hasNewAnnouncement = ref(false)

async function checkNewAnnouncement() {
    const lastRead = parseInt(localStorage.getItem('announcementLastRead') ?? '0')
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return
    const latest = snap.docs[0].data()
    const latestMs = latest.createdAt?.toMillis?.() ?? 0
    hasNewAnnouncement.value = latestMs > lastRead
}
```

將原有的 `onMounted` 改為（保留原有訂閱，新增 checkNewAnnouncement 和 caseId watcher）：
```js
onMounted(() => {
    casesStore.subscribe(['north', 'central', 'south'])
    clientsStore.subscribe(['north', 'central', 'south'])
    usersStore.subscribe()
    if (route.query.caseId) jumpToCase(route.query.caseId)
    checkNewAnnouncement()
})

watch(() => route.query.caseId, (id) => {
    if (id) jumpToCase(id)
})
```
```

在 Tab 按鈕的 click handler 加：當切換到 announcement tab 時清除紅點：
```js
function switchTab(id) {
    activeTab.value = id
    if (id === 'announcement') {
        hasNewAnnouncement.value = false
        localStorage.setItem('announcementLastRead', Date.now().toString())
    }
}
```

在 template 的 Tab 按鈕，將 `@click="activeTab = tab.id"` 改為 `@click="switchTab(tab.id)"`，並加紅點：
```html
<button v-for="tab in tabs" :key="tab.id"
  @click="switchTab(tab.id)"
  class="px-4 py-3 text-sm transition-colors relative"
  :class="activeTab === tab.id ? 'border-b-2 font-semibold' : 'text-gray-500 hover:text-gray-700'"
  :style="activeTab === tab.id ? 'border-color:#c9a96e;color:#c9a96e' : ''">
  {{ tab.label }}
  <span v-if="tab.id === 'announcement' && hasNewAnnouncement"
    class="absolute top-2 right-1 w-2 h-2 rounded-full bg-red-500"></span>
</button>
```

在 template 的 Tab 內容區加：
```html
<AnnouncementTab v-else-if="activeTab === 'announcement'" />
```

- [ ] **Step 2: Commit**

```bash
git add src/views/CasesView.vue
git commit -m "feat(announcements): CasesView 加公司佈達 Tab 和未讀紅點"
```

---

## Task 9: WorkJournalTab.vue 手機版響應式

**Files:**
- Modify: `src/components/cases/WorkJournalTab.vue`

- [ ] **Step 1: 控制列改為手機友好版面**

找到（約第 37 行）：
```html
<div class="bg-white rounded-2xl shadow-sm px-5 py-3 flex items-center justify-between flex-wrap gap-2">
```
改為：
```html
<div class="bg-white rounded-2xl shadow-sm px-4 lg:px-5 py-3 flex flex-col lg:flex-row lg:items-center gap-2">
```

找到日期導覽列（約第 47-51 行），讓它和標題在同一 flex row：
```html
<div class="flex items-center justify-between gap-2">
  <div class="text-sm font-semibold text-gray-800">
    {{ selectedEmployee ? `${selectedEmployee.name} 的工作日誌` : '全部員工工作日誌' }}
  </div>
  <div class="flex items-center gap-1">
    <button @click="shiftDate(-1)" class="text-gray-400 hover:text-gray-700 text-sm leading-none px-2 py-1 min-h-[36px]">◀</button>
    <span class="text-[11px] text-gray-500">{{ dateLabel }}</span>
    <button @click="shiftDate(1)" :disabled="isAtEnd" class="text-gray-400 hover:text-gray-700 text-sm leading-none px-2 py-1 min-h-[36px] disabled:opacity-30">▶</button>
  </div>
</div>
```

找到右側按鈕區（約第 53 行）：
```html
<div class="flex items-center gap-2 flex-wrap">
```
改為：
```html
<div class="flex items-center gap-2 flex-wrap lg:flex-nowrap lg:justify-end">
```

找到「填寫今日日誌」按鈕（約第 66 行）：
```html
<button v-if="isToday" @click="openLogForm" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 填寫今日日誌</button>
```
改為：
```html
<button v-if="isToday" @click="openLogForm"
  class="text-sm text-white px-4 py-2 rounded-lg w-full lg:w-auto min-h-[40px] font-semibold" style="background:#1e2533">
  + 填寫今日日誌
</button>
```

- [ ] **Step 2: 手機版 employee select 優化（約第 40-43 行）**

```html
<select v-model="mobileSelectedEmployee"
  class="lg:hidden text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white w-full min-h-[44px]">
  <option :value="null">全部員工</option>
  <option v-for="emp in filteredEmployees" :key="emp.id" :value="emp">{{ emp.name }}</option>
</select>
```

- [ ] **Step 3: 日誌卡片操作按鈕放大觸控目標**

找到「編輯」按鈕（約第 86 行）：
```html
<button v-if="canEditLog(log)" @click="openEditForm(log)"
  class="text-[11px] text-gray-400 hover:text-amber-600 border border-gray-200 hover:border-amber-300 rounded-lg px-2 py-0.5 transition-colors">
  編輯
</button>
```
改為：
```html
<button v-if="canEditLog(log)" @click="openEditForm(log)"
  class="text-xs text-gray-400 hover:text-amber-600 border border-gray-200 hover:border-amber-300 rounded-lg px-3 py-1.5 min-h-[36px] transition-colors">
  編輯
</button>
```

- [ ] **Step 4: 日誌 Modal 確保全寬（約第 242-243 行）**

```html
<div v-if="showLogForm" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style="background:rgba(0,0,0,0.4)">
  <div class="bg-white sm:rounded-2xl rounded-t-2xl shadow-xl px-4 py-6 sm:p-6 w-full sm:max-w-lg sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
```

- [ ] **Step 5: 確保所有 textarea/input 在手機為全寬**

加班時數 input（約第 358 行）：
```html
<input v-model.number="item.hours" type="number" min="0" step="0.5"
  class="w-20 sm:w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 bg-white min-h-[44px]"
  placeholder="0">
```

- [ ] **Step 6: Commit**

```bash
git add src/components/cases/WorkJournalTab.vue
git commit -m "feat(mobile): WorkJournalTab 手機版響應式調整"
```

---

## Task 10: Firestore Rules 更新

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: 加入 notifications 和 announcements 規則**

在 `firestore.rules` 的 `match /todos/{todoId}` 區塊之後加入：

```
match /notifications/{notifId} {
  allow read, delete: if isSignedIn() && resource.data.userId == request.auth.uid;
  allow create: if isSignedIn();
}
match /announcements/{announcementId} {
  allow read: if isSignedIn();
  allow create, update: if isManager();
  allow delete: if isManager();
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: firestore rules 加入 notifications 和 announcements"
```

---

## Task 11: Build + Deploy

- [ ] **Step 1: Build**

```bash
cd "C:\AI助理 Claude\naiship-system"
npm run build
```

預期輸出末尾：`✓ built in X.XXs`（無 error）

- [ ] **Step 2: Deploy hosting + firestore**

```bash
firebase deploy --only hosting,firestore --project quotation-system-ddc5c
```

預期輸出末尾：`+ Deploy complete!`

- [ ] **Step 3: 開瀏覽器驗證**

用 Playwright 或手動驗證以下功能：
1. NavBar 顯示通知鈴鐺
2. 導覽列顯示「客戶/廠商」
3. 案件管理出現「公司佈達」第四個 Tab
4. 主管可在公司佈達新增公告
5. 新增一個案件，其他帳號收到通知
6. 點通知 → 跳轉到對應案件
7. 手機版工作日誌：「+ 填寫今日日誌」按鈕為全寬且可操作
