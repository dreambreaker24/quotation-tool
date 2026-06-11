# 自動付款提醒系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 工種完工/儲存時自動建立廠商付款與業主請款提醒，顯示於 Dashboard 左側欄與待付款清單。

**Architecture:** 沿用現有 `paymentReminders` Firestore collection，以可預測的固定 document ID（`auto_vendor_${wtId}` / `auto_owner_${wtId}`）實現 upsert/delete，不需先 query。Store 新增 `upcomingAuto` computed 與兩個 helper 方法；WorkTypePanel 四個函式（markDone、unmarkDone、submitForm、removeWorkType）掛鉤自動提醒建立/刪除；Dashboard 左側加藍色「即將到期」區塊；PaymentReminders 底部加「排程提醒」section。

**Tech Stack:** Vue 3 Composition API、Pinia、Firebase Firestore（setDoc、deleteDoc）、Tailwind CSS

---

## 異動檔案總覽

| 檔案 | 動作 |
|---|---|
| `src/stores/paymentReminders.js` | 新增 `addAutoReminder`、`deleteAutoReminder`、`upcomingAuto`、`upcomingAutoSoon`；修改 `pendingOwner`、`pendingVendor` |
| `src/components/cases/WorkTypePanel.vue` | 新增日期計算函式；修改 `markDone`、`unmarkDone`、`submitForm`、`removeWorkType` |
| `src/views/DashboardView.vue` | 新增藍色「即將到期」sidebar 區塊 |
| `src/components/dashboard/PaymentReminders.vue` | 新增「排程提醒」section |

---

## Task 1：擴充 paymentReminders Store

**Files:**
- Modify: `naiship-system/src/stores/paymentReminders.js`

- [ ] **Step 1：在 import 行加入 `setDoc` 與 `deleteDoc`**

將第 3 行改為：

```js
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore'
```

- [ ] **Step 2：修改 `pendingOwner` 與 `pendingVendor`，排除 auto 提醒**

將原本第 28-29 行：

```js
const pendingOwner = computed(() => reminders.value.filter(r => r.type === 'owner'))
const pendingVendor = computed(() => reminders.value.filter(r => r.type === 'vendor'))
```

改為：

```js
const pendingOwner = computed(() => reminders.value.filter(r => r.type === 'owner' && (!r.source || r.source === 'manual')))
const pendingVendor = computed(() => reminders.value.filter(r => r.type === 'vendor' && (!r.source || r.source === 'manual')))
```

- [ ] **Step 3：新增 `upcomingAuto` 與 `upcomingAutoSoon` computed**

在 `pendingVendor` 下方加入：

```js
const upcomingAuto = computed(() =>
    reminders.value
        .filter(r => r.source === 'auto')
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
)

const upcomingAutoSoon = computed(() => {
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return upcomingAuto.value.filter(r => r.dueDate <= thirtyDaysLater)
})
```

- [ ] **Step 4：新增 `addAutoReminder` 與 `deleteAutoReminder`**

在 `addReminder` 函式後加入：

```js
async function addAutoReminder(docId, data) {
    await setDoc(doc(db, 'paymentReminders', docId), {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp(),
        doneAt: null,
        doneBy: null,
    })
}

async function deleteAutoReminder(docId) {
    await deleteDoc(doc(db, 'paymentReminders', docId))
}
```

- [ ] **Step 5：將新方法與 computed 加入 return**

將最後一行 return 改為：

```js
return {
    reminders, pendingOwner, pendingVendor,
    upcomingAuto, upcomingAutoSoon,
    subscribe, cleanup,
    addReminder, markDone,
    addAutoReminder, deleteAutoReminder,
}
```

- [ ] **Step 6：Build 確認無語法錯誤**

```bash
cd naiship-system && npm run build
```

Expected: `✓ built in X.XXs`（無 error）

- [ ] **Step 7：Commit**

```bash
git add naiship-system/src/stores/paymentReminders.js
git commit -m "feat(store): 擴充 paymentReminders 支援自動提醒（auto source）"
```

---

## Task 2：日期計算函式 + WorkTypePanel 四個觸發點

**Files:**
- Modify: `naiship-system/src/components/cases/WorkTypePanel.vue`

- [ ] **Step 1：在 script setup 的 import 區後方加入三個工具函式**

在 `const props = defineProps(...)` 前加入：

```js
function calcVendorDueDate(endDate) {
    const d = new Date(endDate + 'T00:00:00')
    const day = d.getDate()
    const nextMonthDate = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const year = nextMonthDate.getFullYear()
    const month = nextMonthDate.getMonth()
    const targetDay = day <= 15 ? 15 : new Date(year, month + 1, 0).getDate()
    const result = new Date(year, month, targetDay)
    while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() + 1)
    return result.toISOString().slice(0, 10)
}

function calcOwnerDueDate(startDate) {
    const d = new Date(startDate + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
}

function formatDateChinese(isoDate) {
    const d = new Date(isoDate + 'T00:00:00')
    const days = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getMonth() + 1}/${d.getDate()}（週${days[d.getDay()]}）`
}
```

- [ ] **Step 2：修改 `markDone`，完工後建立廠商提醒**

將原本的 `markDone` 函式：

```js
async function markDone(idx) {
    const updated = [...workTypes.value]
    updated[idx] = { ...updated[idx], done: true }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    toast('已標記完工')
}
```

改為：

```js
async function markDone(idx) {
    const updated = [...workTypes.value]
    updated[idx] = { ...updated[idx], done: true }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    const wt = workTypes.value[idx]
    if (wt.endDate) {
        const dueDate = calcVendorDueDate(wt.endDate)
        await remindersStore.addAutoReminder(`auto_vendor_${wt.id}`, {
            source: 'auto',
            type: 'vendor',
            dueDate,
            caseId: props.caseId,
            caseName: props.caseName,
            companyId: caseData.value?.companyId ?? '',
            workTypeId: wt.id,
            workTypeName: wt.name,
            vendorName: wt.vendorName || '',
            amount: wtVendorCostTotal(wt),
            createdBy: authStore.user?.uid ?? '',
            createdByName: authStore.name ?? '',
        })
        toast(`已完工，廠商付款提醒：${formatDateChinese(dueDate)}`)
    } else {
        toast('已標記完工')
    }
}
```

- [ ] **Step 3：修改 `unmarkDone`，取消完工時刪除廠商提醒**

將原本：

```js
async function unmarkDone(idx) {
    const updated = [...workTypes.value]
    updated[idx] = { ...updated[idx], done: false }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
}
```

改為：

```js
async function unmarkDone(idx) {
    const updated = [...workTypes.value]
    updated[idx] = { ...updated[idx], done: false }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    const wt = workTypes.value[idx]
    await remindersStore.deleteAutoReminder(`auto_vendor_${wt.id}`)
}
```

- [ ] **Step 4：修改 `submitForm`，儲存後依進場日建立/刪除業主提醒**

找到 `submitForm` 內 `await casesStore.updateCase(...)` 這行，在其後、`notifStore.notifyAll(...)` 前插入：

```js
const autoOwnerId = `auto_owner_${entry.id}`
if (entry.startDate) {
    const dueDate = calcOwnerDueDate(entry.startDate)
    const amount = entry.paymentFree ? 0 : form.value.paymentItems.reduce((s, i) => s + (i.amount || 0), 0)
    await remindersStore.addAutoReminder(autoOwnerId, {
        source: 'auto',
        type: 'owner',
        dueDate,
        caseId: props.caseId,
        caseName: props.caseName,
        companyId: caseData.value?.companyId ?? '',
        workTypeId: entry.id,
        workTypeName: entry.name,
        vendorName: entry.vendorName || '',
        amount,
        createdBy: authStore.user?.uid ?? '',
        createdByName: authStore.name ?? '',
    })
} else {
    await remindersStore.deleteAutoReminder(autoOwnerId)
}
```

- [ ] **Step 5：修改 `removeWorkType`，刪除工種時一併刪除兩筆 auto 提醒**

將原本：

```js
async function removeWorkType(idx) {
    if (!confirm(`確定要刪除「${workTypes.value[idx].name}」？`)) return
    try {
        const updated = workTypes.value.filter((_, i) => i !== idx)
        await casesStore.updateCase(props.caseId, { workTypes: updated })
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}
```

改為：

```js
async function removeWorkType(idx) {
    if (!confirm(`確定要刪除「${workTypes.value[idx].name}」？`)) return
    const wt = workTypes.value[idx]
    try {
        const updated = workTypes.value.filter((_, i) => i !== idx)
        await casesStore.updateCase(props.caseId, { workTypes: updated })
        await remindersStore.deleteAutoReminder(`auto_vendor_${wt.id}`)
        await remindersStore.deleteAutoReminder(`auto_owner_${wt.id}`)
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}
```

- [ ] **Step 6：Build 確認無語法錯誤**

```bash
cd naiship-system && npm run build
```

Expected: `✓ built in X.XXs`

- [ ] **Step 7：Commit**

```bash
git add naiship-system/src/components/cases/WorkTypePanel.vue
git commit -m "feat(cases): 完工/儲存工種自動建立付款提醒"
```

---

## Task 3：Dashboard 左側欄藍色「即將到期」區塊

**Files:**
- Modify: `naiship-system/src/views/DashboardView.vue`

- [ ] **Step 1：在 DashboardView script 加入 upcomingAutoCount 與 hasUpcomingAuto**

找到：

```js
const hasPendingPayments = computed(() => pendingOwnerCount.value > 0 || pendingVendorCount.value > 0)
```

在其後加入：

```js
const upcomingAutoCount = computed(() => remindersStore.upcomingAutoSoon.length)
const hasUpcomingAuto = computed(() => upcomingAutoCount.value > 0)
```

- [ ] **Step 2：在左側欄加入藍色「即將到期」區塊**

找到金色「待付款」區塊結尾的 `</div>` 後（`<a href="#payment-reminders"...` 那個 div 的結尾），插入：

```html
<div v-if="authStore.isManager && hasUpcomingAuto"
  class="mx-3 mb-4 rounded-xl p-3" style="background:rgba(59,130,246,0.15)">
  <div class="text-[10px] text-blue-300 font-semibold uppercase tracking-wide mb-1">即將到期</div>
  <div class="text-white text-sm font-bold">{{ upcomingAutoCount }} 筆</div>
  <div class="text-[10px] text-gray-400 mt-0.5">30 天內付款排程</div>
  <a href="#scheduled-reminders"
    class="mt-2 block text-[10px] text-blue-300 hover:text-blue-100 underline">前往排程提醒</a>
</div>
```

- [ ] **Step 3：Build 確認無語法錯誤**

```bash
cd naiship-system && npm run build
```

Expected: `✓ built in X.XXs`

- [ ] **Step 4：Commit**

```bash
git add naiship-system/src/views/DashboardView.vue
git commit -m "feat(dashboard): 左側欄新增藍色即將到期提醒區塊"
```

---

## Task 4：PaymentReminders 排程提醒 section + Deploy

**Files:**
- Modify: `naiship-system/src/components/dashboard/PaymentReminders.vue`

- [ ] **Step 1：修改外層 v-if 條件，讓排程提醒存在時也顯示元件**

將第 2 行：

```html
<div v-if="remindersStore.pendingOwner.length > 0 || remindersStore.pendingVendor.length > 0"
```

改為：

```html
<div v-if="remindersStore.pendingOwner.length > 0 || remindersStore.pendingVendor.length > 0 || remindersStore.upcomingAuto.length > 0"
```

- [ ] **Step 2：在 `</div>` 前（元件最底部、關閉 `id="payment-reminders"` 的 div 前）加入排程提醒 section**

在現有兩個 section 的 `</div></div>` 後、元件最外層 `</div>` 前，插入：

```html
<div v-if="remindersStore.upcomingAuto.length > 0" id="scheduled-reminders" class="mt-5">
  <div class="text-xs font-semibold text-blue-600 mb-3">排程提醒</div>
  <div class="flex flex-col gap-2">
    <div v-for="r in remindersStore.upcomingAuto" :key="r.id"
      class="border rounded-xl p-3"
      :class="r.type === 'owner' ? 'border-amber-100 bg-amber-50/30' : 'border-blue-100 bg-blue-50/30'">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              :class="isOverdue(r.dueDate) ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'">
              {{ isOverdue(r.dueDate) ? '逾期' : r.dueDate }}
            </span>
            <span v-if="isOverdue(r.dueDate)" class="text-[10px] text-gray-400">{{ r.dueDate }}</span>
          </div>
          <div class="text-xs font-semibold text-gray-800 truncate">{{ r.caseName }}</div>
          <div class="text-[11px] text-gray-500 mt-0.5">
            {{ r.workTypeName }}<template v-if="r.vendorName"> · {{ r.vendorName }}</template>
          </div>
          <div class="text-sm font-bold mt-1"
            :style="r.type === 'owner' ? 'color:#c9a96e' : ''"
            :class="r.type === 'vendor' ? 'text-gray-700' : ''">
            ${{ (r.amount || 0).toLocaleString() }}
          </div>
          <div class="text-[10px] text-gray-300 mt-1">
            {{ r.type === 'owner' ? '業主請款' : '廠商付款' }}
          </div>
        </div>
        <button v-if="authStore.isManager" @click="markDone(r.id)"
          class="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors whitespace-nowrap">
          標記完成
        </button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3：在 script 加入 `isOverdue` 函式**

在 `async function markDone(id)` 前加入：

```js
function isOverdue(dueDate) {
    return !!dueDate && dueDate < new Date().toISOString().slice(0, 10)
}
```

- [ ] **Step 4：Build 確認無語法錯誤**

```bash
cd naiship-system && npm run build
```

Expected: `✓ built in X.XXs`

- [ ] **Step 5：Commit**

```bash
git add naiship-system/src/components/dashboard/PaymentReminders.vue
git commit -m "feat(dashboard): PaymentReminders 新增排程提醒 section"
```

- [ ] **Step 6：Deploy**

```bash
cd naiship-system && npm run deploy
```

Expected: `+ Deploy complete!`
