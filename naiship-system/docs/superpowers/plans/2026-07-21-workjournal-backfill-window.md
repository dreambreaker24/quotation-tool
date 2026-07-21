# 工作日誌自助補寫 2 天視窗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓員工在工作日誌頁面切到「過去 2 天內」的日期時，也能看到新增日誌按鈕並成功補寫那一天的日誌（含一般工作內容跟加班/油資），跟現有「只有今天」的限制相比放寬到跟既有加班/油資自助視窗一致的天數。

**Architecture:** `WorkJournalTab.vue` 的新增日誌按鈕改用既有的 `canSelfEditOvertimeFuel(selectedDate)` 判斷可見範圍（不新增獨立天數規則），並把使用者目前檢視的日期透過新 prop 傳給 `WorkJournalLogForm.vue`；表單新增日誌時改用這個日期而不是永遠寫死的「現在」，通知訊息也要跟著用同一個日期，不能顯示成送出當下的日期。

**Tech Stack:** Vue 3 `<script setup>`、Firebase Firestore（`Timestamp`）。

---

## 檔案異動總覽

- 修改：`src/components/cases/WorkJournalTab.vue`（新增日誌按鈕可見範圍改成 2 天視窗、文字動態顯示、傳 `target-date` prop）
- 修改：`src/components/cases/WorkJournalLogForm.vue`（新增 `targetDate` prop，新增日誌時的日期跟通知訊息都改用這個日期）

這兩個檔案改動緊密相關（`WorkJournalTab.vue` 傳的 prop 要跟 `WorkJournalLogForm.vue` 讀的 prop 對得上），合併成一個 task，內部拆成兩個檔案各自的步驟。

---

### Task 1: 放寬新增日誌可見範圍到 2 天內，並讓補寫日誌使用正確日期

**Files:**
- Modify: `naiship-system/src/components/cases/WorkJournalTab.vue`
- Modify: `naiship-system/src/components/cases/WorkJournalLogForm.vue`

- [ ] **Step 1: `WorkJournalTab.vue` — 新增 `canCreateLog`／`createLogLabel` computed**

找到 `naiship-system/src/components/cases/WorkJournalTab.vue` 裡的 `isToday` computed（目前在第 289-293 行）：

```js
const isToday = computed(() => {
    const t = new Date()
    const s = selectedDate.value
    return t.getFullYear() === s.getFullYear() && t.getMonth() === s.getMonth() && t.getDate() === s.getDate()
})
```

在它後面（`isAtEnd` computed 之前）插入兩個新的 computed：

```js
const canCreateLog = computed(() => canSelfEditOvertimeFuel(selectedDate.value))

const createLogLabel = computed(() => {
    if (isToday.value) return '+ 填寫今日日誌'
    const d = selectedDate.value
    return `+ 補寫 ${d.getMonth() + 1}/${d.getDate()} 日誌`
})
```

`canSelfEditOvertimeFuel` 已經在這個檔案第 144 行匯入過（`import { canEditGeneralContent, canSelfEditOvertimeFuel } from '@/utils/workJournalDeadline'`），不用新增 import。`selectedDate.value` 是純 `Date` 物件，`canSelfEditOvertimeFuel` 內部呼叫的 `daysSince()` 本來就相容純 `Date` 輸入（`logDate.toDate?.() ?? new Date(logDate)`，沒有 `.toDate` 方法時會直接用 `new Date(logDate)` 包一層，對已經是 `Date` 的值等於原樣使用）。

- [ ] **Step 2: `WorkJournalTab.vue` — 按鈕改用新的 computed**

找到第 40-43 行：

```vue
          <button v-if="isToday" @click="openLogForm"
            class="text-sm text-white px-4 py-2 rounded-lg w-full lg:w-auto min-h-[40px] font-semibold" style="background:#1e2533">
            + 填寫今日日誌
          </button>
```

改成：

```vue
          <button v-if="canCreateLog" @click="openLogForm"
            class="text-sm text-white px-4 py-2 rounded-lg w-full lg:w-auto min-h-[40px] font-semibold" style="background:#1e2533">
            {{ createLogLabel }}
          </button>
```

- [ ] **Step 3: `WorkJournalTab.vue` — 傳 `target-date` prop 給表單**

找到第 94-102 行：

```vue
  <WorkJournalLogForm
    :show="showLogForm"
    :editing-log="editingLog"
    :region="region"
    :can-edit-content="editingLog ? canEditContentFor(editingLog) : true"
    :can-edit-overtime-fuel="editingLog ? canEditOvertimeFuelFor(editingLog) : true"
    @close="showLogForm = false; editingLog = null"
    @submitted="showLogForm = false; editingLog = null"
  />
```

改成（加一行 `:target-date="selectedDate"`）：

```vue
  <WorkJournalLogForm
    :show="showLogForm"
    :editing-log="editingLog"
    :region="region"
    :target-date="selectedDate"
    :can-edit-content="editingLog ? canEditContentFor(editingLog) : true"
    :can-edit-overtime-fuel="editingLog ? canEditOvertimeFuelFor(editingLog) : true"
    @close="showLogForm = false; editingLog = null"
    @submitted="showLogForm = false; editingLog = null"
  />
```

（這個 prop 對編輯既有日誌的情境完全不影響——`WorkJournalLogForm.vue` 只有在「新增日誌」`editingLog` 為 null 的路徑才會用到 `targetDate`，見 Step 4/5。）

- [ ] **Step 4: `WorkJournalLogForm.vue` — 新增 `targetDate` prop**

找到第 194-198 行：

```js
const props = defineProps({
    show: Boolean, editingLog: Object, region: String,
    canEditContent: { type: Boolean, default: true },
    canEditOvertimeFuel: { type: Boolean, default: true },
})
```

改成（加一行 `targetDate`）：

```js
const props = defineProps({
    show: Boolean, editingLog: Object, region: String,
    targetDate: { type: Date, default: null },
    canEditContent: { type: Boolean, default: true },
    canEditOvertimeFuel: { type: Boolean, default: true },
})
```

- [ ] **Step 5: `WorkJournalLogForm.vue` — 新增日誌時用 `targetDate`，通知訊息也要跟著用同一個日期**

找到第 354-370 行：

```js
    const logDoc = {
        userId: authStore.user?.uid ?? '',
        userName: authStore.name ?? '',
        companyId: props.region,
        date: Timestamp.fromDate(new Date()),
        ...(caseEntries.length > 0 && { caseEntries }),
        ...(other.length > 0 && { otherItems: other }),
        ...(fuelData && { fuelExpenses: fuelData, fuelApproved: false }),
        ...(overtimeData.length > 0 && { overtimeItems: overtimeData, overtimeApproved: false }),
        ...(logAttachments.length > 0 && { logAttachments }),
    }
    try {
        await logsStore.addLog(logDoc)
        const now = new Date()
        const dateStr = `${now.getMonth() + 1}/${now.getDate()}`
        const logDateISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        notifStore.notifyAll(authStore.name ?? '', `新增了 ${dateStr} 工作日誌`, '', '', authStore.companyId ?? '', logDateISO, '', '', false, '', '', authStore.user?.uid ?? '')
```

改成（`date: Timestamp.fromDate(new Date())` 改用 `props.targetDate ?? new Date()`；通知訊息原本用送出當下的「現在」組日期字串，補寫過去日期時會顯示錯誤日期，改成跟 `logDoc.date` 用同一個日期來源）：

```js
    const logDate = props.targetDate ?? new Date()
    const logDoc = {
        userId: authStore.user?.uid ?? '',
        userName: authStore.name ?? '',
        companyId: props.region,
        date: Timestamp.fromDate(logDate),
        ...(caseEntries.length > 0 && { caseEntries }),
        ...(other.length > 0 && { otherItems: other }),
        ...(fuelData && { fuelExpenses: fuelData, fuelApproved: false }),
        ...(overtimeData.length > 0 && { overtimeItems: overtimeData, overtimeApproved: false }),
        ...(logAttachments.length > 0 && { logAttachments }),
    }
    try {
        await logsStore.addLog(logDoc)
        const dateStr = `${logDate.getMonth() + 1}/${logDate.getDate()}`
        const logDateISO = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`
        notifStore.notifyAll(authStore.name ?? '', `新增了 ${dateStr} 工作日誌`, '', '', authStore.companyId ?? '', logDateISO, '', '', false, '', '', authStore.user?.uid ?? '')
```

這樣「補寫 7/19 的日誌」送出後，通知會正確顯示「新增了 7/19 工作日誌」而不是送出當下的日期，其他人點通知跳轉也會跳到 7/19 而不是今天。

- [ ] **Step 6: Build 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run`
Expected: 所有既有測試依然 PASS（這兩個檔案都沒有專屬單元測試，跑全套確認沒連帶壞掉別的，應該還是 167 個測試通過）

- [ ] **Step 7: 確認沒有遺漏**

Run: `cd "C:\AI助理 Claude\naiship-system" && grep -n "canCreateLog\|createLogLabel\|targetDate\|target-date" src/components/cases/WorkJournalTab.vue src/components/cases/WorkJournalLogForm.vue`
Expected: `WorkJournalTab.vue` 要有 `canCreateLog`（computed 定義 + 按鈕 `v-if`，共 2 筆）、`createLogLabel`（computed 定義 + 按鈕文字綁定，共 2 筆）、`target-date`（傳給表單的 prop，1 筆）；`WorkJournalLogForm.vue` 要有 `targetDate`（`defineProps` 裡的宣告 + `logDate = props.targetDate ?? new Date()` 使用，共 2 筆）

- [ ] **Step 8: 自我檢查**

確認只有這兩個檔案被改動。確認 `WorkJournalTab.vue` 的 `isToday`（仍然被 `createLogLabel` 用到，不能刪掉）、`canEditContentFor`、`canEditOvertimeFuelFor`、`openProxyPicker`、`submitProxyPicker` 等既有函式完全沒被動到。確認 `WorkJournalLogForm.vue` 裡「編輯既有日誌」（`props.editingLog` 不為 null）的路徑完全沒被這次改動影響——`logDate`／`targetDate` 只會在新增日誌（`editingLog` 為 null）的分支被使用到。

- [ ] **Step 9: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/components/cases/WorkJournalTab.vue naiship-system/src/components/cases/WorkJournalLogForm.vue
git commit -m "feat(workjournal): allow employees to self-serve backfill journal entries within 2-day window"
```

## Reporting

Report DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED at the top, with commit hash and build/test output. Manual browser verification（用一般員工帳號實測切到 1-2 天前、3 天前的按鈕顯示與行為）is deferred to 柏，不是這個 task 的內建步驟。

---

## 執行後檢查清單（對照 spec「測試」章節，柏會親自驗證）

- [ ] 切到今天：按鈕顯示「+ 填寫今日日誌」，行為跟現況一致
- [ ] 切到 1-2 天前：按鈕顯示「+ 補寫 M/D 日誌」，點擊能開出表單並完整填寫一般工作內容+加班/油資，送出後日誌正確存到那個日期
- [ ] 切到 3 天前（超過視窗）：按鈕消失
- [ ] 補寫完成的日誌，馬上重新打開編輯：一般工作內容欄位鎖住，加班/油資欄位在 2 天視窗內仍可編輯
- [ ] 補寫過去日期的日誌後，確認通知訊息顯示的是補寫的那個日期（例如「新增了 7/19 工作日誌」），不是送出當下的日期；點通知能正確跳轉到補寫的那一天
- [ ] 主管視角：「+ 幫同事補加班/油資」入口跟行為完全沒被這次改動影響
