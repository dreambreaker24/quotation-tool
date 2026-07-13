# 刪除預估金額 + 簽約金額提醒 + 補休明細 + 工作日誌權限重新設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 刪除案件裡沒有用途的「預估金額」欄位；案件狀態切換進「施工中」時，若簽約金額未填則擋下存檔；補休面板加上限管理者查看的明細功能；重新設計工作日誌的編輯／審核權限——一般內容限當天、加班與油資申請則有獨立的 2 天自助窗口，超過 2 天須由主管代發、且需 admin 核准。

**Architecture:** 前三項是局部、獨立的小改動。第四項把現有寫死在 `WorkJournalTab.vue`/`WorkJournalLogForm.vue`/`WorkJournalLogCard.vue` 裡、且已經失效的「後天 19:00 截止」邏輯，換成一個共用的純函式模組（`src/utils/workJournalDeadline.js`），依「日誌日期距今天數」統一判斷「一般內容能不能編輯」「加班/油資能不能自己補」「加班/油資由誰核准」，三個元件都改呼叫同一套函式，不再各自寫一套不一致的日期判斷。另外新增「主管代發」的建立/編輯入口，讓主管可以對別的員工、過去的日期，建立一筆只承載加班/油資的日誌。

**Tech Stack:** Vue 3 + Pinia + Firebase Firestore、Vitest

**執行位置：** 以下所有指令都在 `naiship-system/` 目錄下執行，所有檔案路徑都相對於這個目錄。

**對應 spec：** `docs/superpowers/specs/2026-07-13--case-amounts-and-worklog-permissions.md`

---

## 背景知識

- 「一般日誌內容」指 `caseEntries`（負責案件回報）、`otherItems`（其他工作項目）、`logAttachments`（附件）——不含 `overtimeItems`（加班）、`fuelExpenses`（油資）。
- `WorkJournalLogForm.vue` 的 `watch(() => props.show, ...)`（第 242-263 行）在表單開啟時，會把 `editingLog` 既有的 `caseEntries`/`otherItems` 內容回填進 `logEntries`/`otherItems` 這兩個 local ref——這代表就算模板上「隱藏」這些欄位的編輯區塊，底層資料仍然正確保留既有內容，`submitLog()` 送出時不會不小心把它們清空成空陣列。這個 plan 會利用這個特性：鎖住一般內容時，只需要在模板上不渲染對應區塊，不需要額外保護送出邏輯。
- Firestore 的日期比較全部要用台北時區的「日期字串」比較（不是用時間戳記算滿幾小時），比照 `src/stores/users.js` 第 8-10 行 `monthStr()` 已經在用的 `date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })` 手法。
- `补休` 累加欄位（`compensatoryHours`/`compensatoryHolidayHours`）每月被 `ensureMonthClosed()` 歸零重算（`src/stores/users.js` 第 55-77 行），所以明細查詢只需要查詢「本月」的 `workLogs`，不用查全部歷史。
- 這次不修改 `firestore.rules`，跟先前幾批一樣，角色限制都在前端 UI 層做。

---

## Task 1：刪除「預估金額」欄位

**Files:**
- Modify: `src/components/cases/CaseEditModal.vue`
- Modify: `src/components/cases/AddCaseModal.vue`
- Modify: `src/components/dashboard/StatsSection.vue`
- Modify: `src/composables/useExport.js`

- [ ] **Step 1: `CaseEditModal.vue` 移除預估金額欄位**

第 65-74 行：

```html
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">預估金額</label>
            <input v-model.number="form.estimatedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">簽約金額</label>
            <input v-model.number="form.signedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
        </div>
```

改成：

```html
        <div>
          <label class="text-xs text-gray-500 mb-1 block">簽約金額</label>
          <input v-model.number="form.signedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
        </div>
```

第 172-184 行 `form` 預設值，拿掉 `estimatedAmount: 0,`：

```js
const form = ref({
    name: '',
    address: '',
    companyId: 'south',
    status: 'negotiating',
    assignees: [''],
    estimatedAmount: 0,
    signedAmount: 0,
    startDate: '',
    endDate: '',
    signedDate: '',
    deadline: '',
})
```

改成：

```js
const form = ref({
    name: '',
    address: '',
    companyId: 'south',
    status: 'negotiating',
    assignees: [''],
    signedAmount: 0,
    startDate: '',
    endDate: '',
    signedDate: '',
    deadline: '',
})
```

第 192-204 行 `watch(caseData, ...)` 回填區塊，拿掉 `estimatedAmount: c.estimatedAmount ?? 0,`：

```js
    form.value = {
        name: c.name ?? '',
        address: c.address ?? '',
        companyId: c.companyId ?? 'south',
        status: c.status ?? 'negotiating',
        assignees: c.assignees?.length ? [...c.assignees] : (c.assigneeName ? c.assigneeName.split('、') : ['']),
        estimatedAmount: c.estimatedAmount ?? 0,
        signedAmount: c.signedAmount ?? 0,
        startDate: tsToDate(c.startDate),
        endDate: tsToDate(c.endDate),
        signedDate: tsToDate(c.signedDate),
        deadline: tsToDate(c.deadline),
    }
```

改成：

```js
    form.value = {
        name: c.name ?? '',
        address: c.address ?? '',
        companyId: c.companyId ?? 'south',
        status: c.status ?? 'negotiating',
        assignees: c.assignees?.length ? [...c.assignees] : (c.assigneeName ? c.assigneeName.split('、') : ['']),
        signedAmount: c.signedAmount ?? 0,
        startDate: tsToDate(c.startDate),
        endDate: tsToDate(c.endDate),
        signedDate: tsToDate(c.signedDate),
        deadline: tsToDate(c.deadline),
    }
```

第 220-233 行 `save()` 的 `data` 物件，拿掉 `estimatedAmount: form.value.estimatedAmount || 0,`：

```js
        const data = {
            name: form.value.name,
            address: form.value.address || '',
            companyId: form.value.companyId,
            status: form.value.status,
            assignees,
            assigneeName: assignees.join('、'),
            estimatedAmount: form.value.estimatedAmount || 0,
            signedAmount: form.value.signedAmount || 0,
            startDate: form.value.startDate ? Timestamp.fromDate(new Date(form.value.startDate)) : null,
            endDate: form.value.endDate ? Timestamp.fromDate(new Date(form.value.endDate)) : null,
            signedDate: form.value.signedDate ? Timestamp.fromDate(new Date(form.value.signedDate)) : null,
            deadline: form.value.deadline ? Timestamp.fromDate(new Date(form.value.deadline)) : null,
        }
```

改成：

```js
        const data = {
            name: form.value.name,
            address: form.value.address || '',
            companyId: form.value.companyId,
            status: form.value.status,
            assignees,
            assigneeName: assignees.join('、'),
            signedAmount: form.value.signedAmount || 0,
            startDate: form.value.startDate ? Timestamp.fromDate(new Date(form.value.startDate)) : null,
            endDate: form.value.endDate ? Timestamp.fromDate(new Date(form.value.endDate)) : null,
            signedDate: form.value.signedDate ? Timestamp.fromDate(new Date(form.value.signedDate)) : null,
            deadline: form.value.deadline ? Timestamp.fromDate(new Date(form.value.deadline)) : null,
        }
```

- [ ] **Step 2: `AddCaseModal.vue` 移除預估金額欄位**

第 58-67 行：

```html
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">預估金額</label>
            <input v-model.number="caseForm.estimatedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">簽約金額</label>
            <input v-model.number="caseForm.signedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
        </div>
```

改成：

```html
        <div>
          <label class="text-xs text-gray-500 mb-1 block">簽約金額</label>
          <input v-model.number="caseForm.signedAmount" type="number" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
        </div>
```

第 121-127 行 `blankCase()`，拿掉 `estimatedAmount: 0, `：

```js
const blankCase = () => ({
    name: '', address: '',
    companyId: authStore.isManager ? (props.region ?? 'south') : (authStore.companyId || 'south'),
    assignees: [''], status: 'negotiating',
    estimatedAmount: 0, signedAmount: 0, startDate: '', endDate: '', signedDate: '',
    deadline: '', linkedClientId: ''
})
```

改成：

```js
const blankCase = () => ({
    name: '', address: '',
    companyId: authStore.isManager ? (props.region ?? 'south') : (authStore.companyId || 'south'),
    assignees: [''], status: 'negotiating',
    signedAmount: 0, startDate: '', endDate: '', signedDate: '',
    deadline: '', linkedClientId: ''
})
```

第 148-167 行 `submitCase()` 的 `data` 物件，拿掉 `estimatedAmount: caseForm.value.estimatedAmount || 0,`：

```js
    const data = {
        name: caseForm.value.name,
        address: caseForm.value.address || '',
        companyId: caseForm.value.companyId,
        status: caseForm.value.status,
        estimatedAmount: caseForm.value.estimatedAmount || 0,
        signedAmount: caseForm.value.signedAmount || 0,
        assignees,
        assigneeName: assignees.join('、'),
        assignedTo: authStore.user?.uid ?? '',
        startDate: caseForm.value.startDate ? Timestamp.fromDate(new Date(caseForm.value.startDate)) : null,
        endDate: caseForm.value.endDate ? Timestamp.fromDate(new Date(caseForm.value.endDate)) : null,
        signedDate: caseForm.value.signedDate ? Timestamp.fromDate(new Date(caseForm.value.signedDate)) : null,
        deadline: caseForm.value.deadline ? Timestamp.fromDate(new Date(caseForm.value.deadline)) : null,
        linkedClientId: caseForm.value.linkedClientId || null,
    }
```

改成：

```js
    const data = {
        name: caseForm.value.name,
        address: caseForm.value.address || '',
        companyId: caseForm.value.companyId,
        status: caseForm.value.status,
        signedAmount: caseForm.value.signedAmount || 0,
        assignees,
        assigneeName: assignees.join('、'),
        assignedTo: authStore.user?.uid ?? '',
        startDate: caseForm.value.startDate ? Timestamp.fromDate(new Date(caseForm.value.startDate)) : null,
        endDate: caseForm.value.endDate ? Timestamp.fromDate(new Date(caseForm.value.endDate)) : null,
        signedDate: caseForm.value.signedDate ? Timestamp.fromDate(new Date(caseForm.value.signedDate)) : null,
        deadline: caseForm.value.deadline ? Timestamp.fromDate(new Date(caseForm.value.deadline)) : null,
        linkedClientId: caseForm.value.linkedClientId || null,
    }
```

- [ ] **Step 3: `StatsSection.vue` 移除進件金額/洽談金額卡片**

第 5-12 行：

```html
      <div class="grid grid-cols-3 gap-3">
        <StatCard label="進件總數" :value="String(stats.totalCount)" />
        <StatCard label="洽談案件" :value="String(stats.negotiatingCount)" />
        <StatCard label="簽約案件" :value="String(stats.signedCount)" />
        <StatCard label="進件金額" :value="formatAmount(stats.totalAmount)" />
        <StatCard label="洽談金額" :value="formatAmount(stats.negotiatingAmount)" />
        <StatCard label="簽約金額" :value="formatAmount(stats.signedAmount)" />
      </div>
```

改成：

```html
      <div class="grid grid-cols-3 gap-3">
        <StatCard label="進件總數" :value="String(stats.totalCount)" />
        <StatCard label="洽談案件" :value="String(stats.negotiatingCount)" />
        <StatCard label="簽約案件" :value="String(stats.signedCount)" />
        <StatCard label="簽約金額" :value="formatAmount(stats.signedAmount)" />
      </div>
```

第 31-45 行 `stats` computed，拿掉 `totalAmount`/`negotiatingAmount`：

```js
const stats = computed(() => {
    const all = casesStore.cases.filter(c => {
        if (!props.year) return true
        const d = c.createdAt?.toDate?.()
        return !d || d.getFullYear() === props.year
    })
    return {
        totalCount: all.length,
        negotiatingCount: all.filter(c => c.status === 'negotiating').length,
        signedCount: all.filter(c => ['construction', 'pending_settlement', 'aftercare', 'completed'].includes(c.status)).length,
        totalAmount: all.reduce((s, c) => s + (c.estimatedAmount || 0), 0),
        negotiatingAmount: all.filter(c => c.status === 'negotiating').reduce((s, c) => s + (c.estimatedAmount || 0), 0),
        signedAmount: all.filter(c => c.signedAmount).reduce((s, c) => s + (c.signedAmount || 0), 0)
    }
})
```

改成：

```js
const stats = computed(() => {
    const all = casesStore.cases.filter(c => {
        if (!props.year) return true
        const d = c.createdAt?.toDate?.()
        return !d || d.getFullYear() === props.year
    })
    return {
        totalCount: all.length,
        negotiatingCount: all.filter(c => c.status === 'negotiating').length,
        signedCount: all.filter(c => ['construction', 'pending_settlement', 'aftercare', 'completed'].includes(c.status)).length,
        signedAmount: all.filter(c => c.signedAmount).reduce((s, c) => s + (c.signedAmount || 0), 0)
    }
})
```

- [ ] **Step 4: `useExport.js` 移除預估金額匯出欄位**

第 4-16 行：

```js
    function exportCases(cases) {
        const rows = cases.map(c => ({
            '案件名稱': c.name,
            '分區': { south: '南區', north: '北區', central: '中區' }[c.companyId] ?? c.companyId,
            '狀態': c.status,
            '負責人': c.assigneeName,
            '施工地址': c.address || '',
            '預估金額': c.estimatedAmount || 0,
            '簽約金額': c.signedAmount || 0,
            '開始日期': c.startDate?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
            '結束日期': c.endDate?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
            '完工期限': c.deadline?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
        }))
```

改成：

```js
    function exportCases(cases) {
        const rows = cases.map(c => ({
            '案件名稱': c.name,
            '分區': { south: '南區', north: '北區', central: '中區' }[c.companyId] ?? c.companyId,
            '狀態': c.status,
            '負責人': c.assigneeName,
            '施工地址': c.address || '',
            '簽約金額': c.signedAmount || 0,
            '開始日期': c.startDate?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
            '結束日期': c.endDate?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
            '完工期限': c.deadline?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
        }))
```

- [ ] **Step 5: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 6: 手動驗收**

1. `npm run dev`，開新增案件／編輯案件，確認「預估金額」欄位消失，只剩「簽約金額」單獨一欄
2. Dashboard 首頁總覽，確認只剩「進件總數／洽談案件／簽約案件／簽約金額」四張卡片
3. 案件進度頁匯出 Excel，確認欄位裡沒有「預估金額」

- [ ] **Step 7: Commit**

```bash
git add src/components/cases/CaseEditModal.vue src/components/cases/AddCaseModal.vue src/components/dashboard/StatsSection.vue src/composables/useExport.js
git commit -m "feat(cases): remove unused estimatedAmount field from forms, dashboard and export"
```

---

## Task 2：簽約金額狀態切換擋下機制

**Files:**
- Create: `src/utils/caseStatusRules.js`
- Modify: `src/components/cases/CaseEditModal.vue`
- Test: `tests/utils/caseStatusRules.test.js`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/utils/caseStatusRules.test.js`：

```js
// naiship-system/tests/utils/caseStatusRules.test.js
import { describe, it, expect } from 'vitest'
import { isMissingSignedAmountForConstruction } from '@/utils/caseStatusRules'

describe('isMissingSignedAmountForConstruction', () => {
    it('blocks when switching into construction with no signed amount', () => {
        expect(isMissingSignedAmountForConstruction('construction', 'negotiating', 0)).toBe(true)
    })
    it('blocks when switching into construction with empty signed amount', () => {
        expect(isMissingSignedAmountForConstruction('construction', 'drafting', null)).toBe(true)
    })
    it('allows when switching into construction with a signed amount filled', () => {
        expect(isMissingSignedAmountForConstruction('construction', 'negotiating', 500000)).toBe(false)
    })
    it('allows editing an already-construction case with no signed amount (not a new transition)', () => {
        expect(isMissingSignedAmountForConstruction('construction', 'construction', 0)).toBe(false)
    })
    it('allows switching to any other status regardless of signed amount', () => {
        expect(isMissingSignedAmountForConstruction('drafting', 'negotiating', 0)).toBe(false)
        expect(isMissingSignedAmountForConstruction('lost', 'negotiating', 0)).toBe(false)
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/utils/caseStatusRules.test.js`
Expected: FAIL — 找不到 `@/utils/caseStatusRules`

- [ ] **Step 3: 建立純函式**

建立 `src/utils/caseStatusRules.js`：

```js
export function isMissingSignedAmountForConstruction(newStatus, originalStatus, signedAmount) {
    return newStatus === 'construction' && originalStatus !== 'construction' && !signedAmount
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/utils/caseStatusRules.test.js`
Expected: PASS（5 個測試）

- [ ] **Step 5: `CaseEditModal.vue` 加入狀態切換擋下**

在 import 區塊（第 126-134 行）加入：

```js
import { isMissingSignedAmountForConstruction } from '@/utils/caseStatusRules'
```

`save()` 函式（第 215-217 行）：

```js
async function save() {
    if (!form.value.name || saving.value) return
    saving.value = true
```

改成：

```js
async function save() {
    if (!form.value.name || saving.value) return
    if (isMissingSignedAmountForConstruction(form.value.status, originalStatus.value, form.value.signedAmount)) {
        toast('請先填寫簽約金額才能切換為施工中', 'error')
        return
    }
    saving.value = true
```

- [ ] **Step 6: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 7: 手動驗收**

1. `npm run dev`，開一張洽談中、簽約金額空白的案件，編輯把狀態切成「施工中」直接按儲存，確認出現「請先填寫簽約金額才能切換為施工中」提示且沒有存檔（視窗沒關閉）
2. 補填簽約金額後再存檔，確認可以正常切換並關閉視窗
3. 已經是施工中的案件，簽約金額留空只改別的欄位存檔，確認不會被擋（因為不是「新切換進入」）

- [ ] **Step 8: Commit**

```bash
git add src/utils/caseStatusRules.js tests/utils/caseStatusRules.test.js src/components/cases/CaseEditModal.vue
git commit -m "feat(cases): block transition to construction status when signed amount is missing"
```

---

## Task 3：補休明細按鈕（限 admin）

**Files:**
- Modify: `src/stores/workLogs.js`
- Modify: `src/components/cases/CompensatoryPanel.vue`
- Test: `tests/stores/workLogs.test.js`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/stores/workLogs.test.js`：

```js
// naiship-system/tests/stores/workLogs.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('@/stores/users', () => ({ useUsersStore: () => ({ ensureMonthClosed: vi.fn() }) }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(),
    doc: vi.fn(),
    serverTimestamp: vi.fn(() => 'ts'),
    Timestamp: {
        fromDate: vi.fn(d => ({ toDate: () => d })),
    },
    arrayUnion: vi.fn(),
    increment: vi.fn(n => ({ __increment: n })),
}))

import { useWorkLogsStore } from '@/stores/workLogs'
import { getDocs } from 'firebase/firestore'

function fakeLog(overtimeItems) {
    return { data: () => ({ userName: 'test', date: { toDate: () => new Date('2026-07-05') }, overtimeItems }) }
}

describe('fetchApprovedOvertimeDetail', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('returns only approved weekday items when type is weekday', async () => {
        getDocs.mockResolvedValue({
            docs: [
                fakeLog([
                    { type: '平日', hours: 3, reason: '趕工', approved: true },
                    { type: '平日', hours: 2, reason: '未審', approved: null },
                    { type: '休息日', hours: 4, reason: '假日支援', approved: true },
                ]),
            ],
        })
        const store = useWorkLogsStore()
        const result = await store.fetchApprovedOvertimeDetail('u1', 'weekday')
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ hours: 3, reason: '趕工' })
    })

    it('returns only approved holiday items when type is holiday', async () => {
        getDocs.mockResolvedValue({
            docs: [
                fakeLog([
                    { type: '平日', hours: 3, reason: '趕工', approved: true },
                    { type: '休息日', hours: 4, reason: '假日支援', approved: true },
                ]),
            ],
        })
        const store = useWorkLogsStore()
        const result = await store.fetchApprovedOvertimeDetail('u1', 'holiday')
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ hours: 4, reason: '假日支援' })
    })

    it('returns an empty array when nothing is approved', async () => {
        getDocs.mockResolvedValue({
            docs: [fakeLog([{ type: '平日', hours: 3, reason: '趕工', approved: false }])],
        })
        const store = useWorkLogsStore()
        const result = await store.fetchApprovedOvertimeDetail('u1', 'weekday')
        expect(result).toEqual([])
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/stores/workLogs.test.js`
Expected: FAIL — `store.fetchApprovedOvertimeDetail is not a function`

- [ ] **Step 3: 實作 `fetchApprovedOvertimeDetail`**

在 `src/stores/workLogs.js` 的 `fetchMonthlyAttendance`（第 155-173 行）之後加入：

```js
    async function fetchApprovedOvertimeDetail(userId, type) {
        const now = new Date()
        const y = now.getFullYear()
        const m = now.getMonth()
        const start = Timestamp.fromDate(new Date(y, m, 1))
        const end = Timestamp.fromDate(new Date(y, m + 1, 0, 23, 59, 59, 999))
        const q = query(
            collection(db, 'workLogs'),
            where('userId', '==', userId),
            where('date', '>=', start),
            where('date', '<=', end),
        )
        const snap = await getDocs(q)
        const entries = []
        snap.docs.forEach(d => {
            const data = d.data()
            const date = data.date?.toDate?.() ?? null
            ;(data.overtimeItems || []).forEach(item => {
                if (item.approved !== true) return
                const isHoliday = item.type === '休息日'
                if (type === 'holiday' && !isHoliday) return
                if (type === 'weekday' && isHoliday) return
                entries.push({ date, hours: item.hours || 0, reason: item.reason || '' })
            })
        })
        return entries.sort((a, b) => (a.date ?? 0) - (b.date ?? 0))
    }
```

把 `return` 陳述式（第 177-184 行）：

```js
    return {
        logs, pendingLogs,
        subscribe, subscribePending, cleanupPending,
        addLog, updateLog, addReply,
        approveFuel, approveOvertimeItem,
        fetchMonthlyKm, fetchMonthlyOvertimeHours, fetchMonthlyAttendance,
        unsubscribe: cleanup
    }
```

改成：

```js
    return {
        logs, pendingLogs,
        subscribe, subscribePending, cleanupPending,
        addLog, updateLog, addReply,
        approveFuel, approveOvertimeItem,
        fetchMonthlyKm, fetchMonthlyOvertimeHours, fetchMonthlyAttendance, fetchApprovedOvertimeDetail,
        unsubscribe: cleanup
    }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/stores/workLogs.test.js`
Expected: PASS（3 個測試）

- [ ] **Step 5: `CompensatoryPanel.vue` 加上明細按鈕**

第 16-29 行（平日補休區塊）：

```html
        <!-- 平日補休 -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">平日補休</span>
            <span class="text-base font-bold text-red-500">{{ getHours(name, 'compensatoryHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">H</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openEdit(name, 'compensatoryHours', '平日補休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'compensatoryHours', '平日補休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>
```

改成：

```html
        <!-- 平日補休 -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">平日補休</span>
            <span class="text-base font-bold text-red-500">{{ getHours(name, 'compensatoryHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">H</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openDetail(name, 'weekday', '平日補休')"
              class="text-[10px] text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-400">明細</button>
            <button @click="openEdit(name, 'compensatoryHours', '平日補休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'compensatoryHours', '平日補休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>
```

第 30-43 行（休息日補休區塊）：

```html
        <!-- 休息日補休 -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">休息日補休</span>
            <span class="text-base font-bold text-red-500">{{ getHours(name, 'compensatoryHolidayHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">H</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openEdit(name, 'compensatoryHolidayHours', '休息日補休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'compensatoryHolidayHours', '休息日補休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>
```

改成：

```html
        <!-- 休息日補休 -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[10px] text-gray-400">休息日補休</span>
            <span class="text-base font-bold text-red-500">{{ getHours(name, 'compensatoryHolidayHours') }}</span>
            <span class="text-xs font-semibold text-gray-400">H</span>
          </div>
          <div v-if="authStore.isAdmin" class="flex gap-1">
            <button @click="openDetail(name, 'holiday', '休息日補休')"
              class="text-[10px] text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-400">明細</button>
            <button @click="openEdit(name, 'compensatoryHolidayHours', '休息日補休')"
              class="text-[10px] text-white px-1.5 py-0.5 rounded" style="background:#1e2533">調整</button>
            <button @click="confirmReset(name, 'compensatoryHolidayHours', '休息日補休')"
              class="text-[10px] text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50">歸零</button>
          </div>
        </div>
```

在「調整 Modal」（第 63-80 行）之後加入明細 Modal：

```html
  <!-- 明細 Modal -->
  <div v-if="detailName" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ detailLabel }}明細 — {{ detailName }}（本月）</h3>
        <button @click="detailName = null" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div v-if="detailLoading" class="text-xs text-gray-400 text-center py-4">載入中…</div>
      <div v-else-if="detailEntries.length === 0" class="text-xs text-gray-400 text-center py-4">本月尚無已核准的加班記錄</div>
      <div v-else class="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
        <div v-for="(e, i) in detailEntries" :key="i" class="flex items-center justify-between text-xs border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
          <span class="text-gray-600">{{ formatDetailDate(e.date) }}</span>
          <span class="font-semibold text-gray-800">{{ e.hours }} 小時</span>
          <span class="text-gray-400 truncate ml-2 flex-1 text-right">{{ e.reason }}</span>
        </div>
      </div>
      <div class="flex justify-end mt-4">
        <button @click="detailName = null" class="text-sm text-gray-400 px-4 py-2">關閉</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 6: `CompensatoryPanel.vue` 加上明細邏輯**

在 import 區塊（第 82-86 行）加入 workLogs store：

```js
import { ref, watch } from 'vue'
import { useUsersStore, prevMonthStr } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
```

改成：

```js
import { ref, watch } from 'vue'
import { useUsersStore, prevMonthStr } from '@/stores/users'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
```

在 `const usersStore = useUsersStore()`（第 91 行）之後加入：

```js
const logsStore = useWorkLogsStore()
```

在 `const lastMonthBalances = ref({})`（第 99 行）之後加入：

```js
const detailName = ref(null)
const detailType = ref('')
const detailLabel = ref('')
const detailEntries = ref([])
const detailLoading = ref(false)
```

在 `openEdit()` 函式（第 127-132 行）之後加入：

```js
async function openDetail(name, type, label) {
    detailName.value = name
    detailType.value = type
    detailLabel.value = label
    detailEntries.value = []
    detailLoading.value = true
    try {
        const user = usersStore.users.find(u => u.name === name)
        if (user) detailEntries.value = await logsStore.fetchApprovedOvertimeDetail(user.id, type)
    } finally {
        detailLoading.value = false
    }
}

function formatDetailDate(date) {
    if (!date) return ''
    return `${date.getMonth() + 1}/${date.getDate()}`
}
```

- [ ] **Step 7: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 8: 手動驗收**

1. `npm run dev`，登入 admin，進「工作日誌」旁的補休面板（確認實際路徑，通常在 Dashboard 或案件進度頁）
2. 找一位本月有已核准加班的員工，點「明細」，確認列出的逐筆日期/時數/原因加總起來等於面板顯示的累計數字
3. 登出換一般員工帳號，確認完全看不到「明細」「調整」「歸零」這些按鈕
4. 找一位本月沒有已核准加班的員工，點明細，確認顯示「本月尚無已核准的加班記錄」而不是報錯

- [ ] **Step 9: Commit**

```bash
git add src/stores/workLogs.js tests/stores/workLogs.test.js src/components/cases/CompensatoryPanel.vue
git commit -m "feat(compensatory): add admin-only detail breakdown for overtime hours"
```

---

## Task 4：工作日誌權限共用純函式

**Files:**
- Create: `src/utils/workJournalDeadline.js`
- Test: `tests/utils/workJournalDeadline.test.js`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/utils/workJournalDeadline.test.js`：

```js
// naiship-system/tests/utils/workJournalDeadline.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { daysSince, canEditGeneralContent, canSelfEditOvertimeFuel, canApproveOvertimeFuel } from '@/utils/workJournalDeadline'

// 2026-07-13 12:00 台北時間
const MOCK_NOW = new Date('2026-07-13T04:00:00Z')

function tsDate(isoDate) {
    return { toDate: () => new Date(`${isoDate}T00:00:00`) }
}

describe('daysSince', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('is 0 for today', () => {
        expect(daysSince(tsDate('2026-07-13'))).toBe(0)
    })
    it('is 2 for two days ago', () => {
        expect(daysSince(tsDate('2026-07-11'))).toBe(2)
    })
    it('is 3 for three days ago', () => {
        expect(daysSince(tsDate('2026-07-10'))).toBe(3)
    })
})

describe('canEditGeneralContent', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('is true only when the log date is today', () => {
        expect(canEditGeneralContent(tsDate('2026-07-13'))).toBe(true)
        expect(canEditGeneralContent(tsDate('2026-07-12'))).toBe(false)
    })
})

describe('canSelfEditOvertimeFuel', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('is true within 2 days, false beyond', () => {
        expect(canSelfEditOvertimeFuel(tsDate('2026-07-13'))).toBe(true)
        expect(canSelfEditOvertimeFuel(tsDate('2026-07-11'))).toBe(true)
        expect(canSelfEditOvertimeFuel(tsDate('2026-07-10'))).toBe(false)
    })
})

describe('canApproveOvertimeFuel', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('within 2 days: any manager can approve', () => {
        expect(canApproveOvertimeFuel(tsDate('2026-07-11'), false, true)).toBe(true)
        expect(canApproveOvertimeFuel(tsDate('2026-07-11'), false, false)).toBe(false)
    })
    it('beyond 2 days: only admin can approve, even if manager', () => {
        expect(canApproveOvertimeFuel(tsDate('2026-07-10'), false, true)).toBe(false)
        expect(canApproveOvertimeFuel(tsDate('2026-07-10'), true, true)).toBe(true)
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/utils/workJournalDeadline.test.js`
Expected: FAIL — 找不到 `@/utils/workJournalDeadline`

- [ ] **Step 3: 建立共用函式**

建立 `src/utils/workJournalDeadline.js`：

```js
function taipeiDateStr(date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

export function daysSince(logDate) {
    if (!logDate) return Infinity
    const d = logDate.toDate?.() ?? new Date(logDate)
    const logMs = new Date(`${taipeiDateStr(d)}T00:00:00`).getTime()
    const todayMs = new Date(`${taipeiDateStr(new Date())}T00:00:00`).getTime()
    return Math.round((todayMs - logMs) / 86400000)
}

export function canEditGeneralContent(logDate) {
    return daysSince(logDate) === 0
}

export function canSelfEditOvertimeFuel(logDate) {
    return daysSince(logDate) <= 2
}

export function canApproveOvertimeFuel(logDate, isAdmin, isManager) {
    return daysSince(logDate) <= 2 ? isManager : isAdmin
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/utils/workJournalDeadline.test.js`
Expected: PASS（8 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/utils/workJournalDeadline.js tests/utils/workJournalDeadline.test.js
git commit -m "feat(workJournal): add shared date-based permission rules"
```

---

## Task 5：`WorkJournalTab.vue` 拆分編輯權限

**Files:**
- Modify: `src/components/cases/WorkJournalTab.vue`

- [ ] **Step 1: import 共用函式**

在 import 區塊（第 98-107 行）加入：

```js
import { canEditGeneralContent, canSelfEditOvertimeFuel } from '@/utils/workJournalDeadline'
```

- [ ] **Step 2: 拆分 `canEditLog`**

第 156-166 行：

```js
function isTodayDate(ts) {
    if (!ts) return false
    const d = ts.toDate?.() ?? new Date(ts)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function canEditLog(log) {
    if (authStore.isManager) return true
    return log.userId === authStore.user?.uid && isTodayDate(log.date)
}
```

改成：

```js
function canEditContentFor(log) {
    return canEditGeneralContent(log.date)
}

function canEditOvertimeFuelFor(log) {
    if (authStore.isManager) return true
    return log.userId === authStore.user?.uid && canSelfEditOvertimeFuel(log.date)
}
```

- [ ] **Step 3: 卡片 `can-edit` 改成兩個條件其一，並多傳一個 admin 判斷**

第 47-58 行：

```html
      <WorkJournalLogCard
        v-for="log in displayedLogs"
        :key="log.id"
        :log="log"
        :can-edit="canEditLog(log)"
        :is-manager="authStore.isManager"
        @edit="openEditForm"
        @approve-fuel="approveFuel"
        @approve-overtime-item="approveOvertimeItem"
        @reply="handleReply"
        @preview="handlePreview"
      />
```

改成：

```html
      <WorkJournalLogCard
        v-for="log in displayedLogs"
        :key="log.id"
        :log="log"
        :can-edit="canEditContentFor(log) || canEditOvertimeFuelFor(log)"
        :is-manager="authStore.isManager"
        :is-admin="authStore.isAdmin"
        @edit="openEditForm"
        @approve-fuel="approveFuel"
        @approve-overtime-item="approveOvertimeItem"
        @reply="handleReply"
        @preview="handlePreview"
      />
```

- [ ] **Step 4: 表單開啟時傳入權限旗標**

第 89-95 行：

```html
  <WorkJournalLogForm
    :show="showLogForm"
    :editing-log="editingLog"
    :region="region"
    @close="showLogForm = false; editingLog = null"
    @submitted="showLogForm = false; editingLog = null"
  />
```

改成：

```html
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

（`editingLog` 是 `null` 時代表填今日新日誌，兩項權限都直接給 `true`，跟現況行為一致。）

- [ ] **Step 5: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤（`WorkJournalLogCard`/`WorkJournalLogForm` 這時還沒接收新 prop，Vue 對多餘/未宣告的 prop 只會是 runtime 警告，不影響 build）

- [ ] **Step 6: Commit**

```bash
git add src/components/cases/WorkJournalTab.vue
git commit -m "refactor(workJournal): split edit permission into content vs overtime/fuel rules"
```

---

## Task 6：`WorkJournalLogForm.vue` 依權限鎖定區塊

**Files:**
- Modify: `src/components/cases/WorkJournalLogForm.vue`

- [ ] **Step 1: 加入新 props，移除死碼 `isAfterDeadline`**

第 194 行：

```js
const props = defineProps({ show: Boolean, editingLog: Object, region: String })
```

改成：

```js
const props = defineProps({
    show: Boolean, editingLog: Object, region: String,
    canEditContent: { type: Boolean, default: true },
    canEditOvertimeFuel: { type: Boolean, default: true },
})
```

第 233-240 行，刪掉整段 `isAfterDeadline`：

```js
const isAfterDeadline = computed(() => {
    const now = new Date()
    const logDate = props.editingLog?.date?.toDate?.() ?? new Date()
    const deadline = new Date(logDate)
    deadline.setDate(deadline.getDate() + 2)
    deadline.setHours(19, 0, 0, 0)
    return now >= deadline
})
```

- [ ] **Step 2: 一般內容區塊用 `canEditContent` 包住**

第 15-24 行（負責案件回報）：

```html
      <!-- 負責案件 -->
      <div v-if="myCases.length > 0" class="mb-4">
        <div class="text-xs font-semibold text-gray-600 mb-2">負責案件回報</div>
        <div v-for="c in myCases" :key="c.id" class="border border-gray-100 rounded-xl p-3 mb-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 mb-2 inline-block">{{ c.name }}</span>
          <textarea v-model="logEntries[c.id]" rows="2"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="今日工作回報..."></textarea>
        </div>
      </div>
```

改成：

```html
      <!-- 負責案件 -->
      <div v-if="canEditContent && myCases.length > 0" class="mb-4">
        <div class="text-xs font-semibold text-gray-600 mb-2">負責案件回報</div>
        <div v-for="c in myCases" :key="c.id" class="border border-gray-100 rounded-xl p-3 mb-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 mb-2 inline-block">{{ c.name }}</span>
          <textarea v-model="logEntries[c.id]" rows="2"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="今日工作回報..."></textarea>
        </div>
      </div>
```

第 26-39 行（其他工作項目）：

```html
      <!-- 其他工作項目 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600">其他工作項目</div>
          <button @click="addOtherItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <div v-if="otherItems.length === 0" class="text-xs text-gray-400 py-1">無其他工作（可點右上新增）</div>
        <div v-for="(item, idx) in otherItems" :key="idx" class="flex items-start gap-2 mb-2">
          <textarea v-model="otherItems[idx].content" rows="2"
            class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="描述工作內容..."></textarea>
          <button @click="otherItems.splice(idx, 1)" class="text-red-400 hover:text-red-600 mt-2">✕</button>
        </div>
      </div>
```

改成：

```html
      <!-- 其他工作項目 -->
      <div v-if="canEditContent" class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600">其他工作項目</div>
          <button @click="addOtherItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <div v-if="otherItems.length === 0" class="text-xs text-gray-400 py-1">無其他工作（可點右上新增）</div>
        <div v-for="(item, idx) in otherItems" :key="idx" class="flex items-start gap-2 mb-2">
          <textarea v-model="otherItems[idx].content" rows="2"
            class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none"
            placeholder="描述工作內容..."></textarea>
          <button @click="otherItems.splice(idx, 1)" class="text-red-400 hover:text-red-600 mt-2">✕</button>
        </div>
      </div>
```

第 150-165 行（附件）：

```html
      <!-- 附件 -->
      <div class="border border-gray-200 rounded-xl p-4 bg-gray-50/50 mt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600">附件（選填）</div>
          <button @click="logAttachInput.click()" class="text-xs" style="color:#c9a96e">+ 選擇檔案</button>
        </div>
        <div v-if="logAttachFiles.length" class="flex gap-2 flex-wrap">
          <div v-for="(f, i) in logAttachFiles" :key="i" class="relative">
            <img v-if="f.preview" :src="f.preview" class="w-12 h-12 rounded object-cover">
            <div v-else class="w-12 h-12 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
            <button @click="logAttachFiles.splice(i, 1)"
              class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
          </div>
        </div>
        <div v-else class="text-[11px] text-gray-300">無附件</div>
      </div>
```

改成：

```html
      <!-- 附件 -->
      <div v-if="canEditContent" class="border border-gray-200 rounded-xl p-4 bg-gray-50/50 mt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600">附件（選填）</div>
          <button @click="logAttachInput.click()" class="text-xs" style="color:#c9a96e">+ 選擇檔案</button>
        </div>
        <div v-if="logAttachFiles.length" class="flex gap-2 flex-wrap">
          <div v-for="(f, i) in logAttachFiles" :key="i" class="relative">
            <img v-if="f.preview" :src="f.preview" class="w-12 h-12 rounded object-cover">
            <div v-else class="w-12 h-12 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
            <button @click="logAttachFiles.splice(i, 1)"
              class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
          </div>
        </div>
        <div v-else class="text-[11px] text-gray-300">無附件</div>
      </div>
```

- [ ] **Step 3: 油資/加班區塊改用 `canEditOvertimeFuel`，移除死碼截止訊息**

第 41-52 行（申請油資的標題列與截止訊息）：

```html
      <!-- 申請油資 -->
      <div class="border border-amber-200 rounded-xl p-4 bg-amber-50/50">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-semibold text-amber-700">申請油資（選填）</div>
          <button v-if="!isAfterDeadline || editingLog" @click="addFuelItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <div v-if="editingLog?.fuelApproved" class="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-2">
          ✓ 油資已核准，無法修改
        </div>
        <div v-else-if="isAfterDeadline && !editingLog" class="text-xs text-center text-red-500 py-2 bg-red-50 rounded-lg">
          油資申請已截止（截止至後天 19:00）
        </div>
        <template v-if="!editingLog?.fuelApproved && (!isAfterDeadline || editingLog)">
```

改成：

```html
      <!-- 申請油資 -->
      <div class="border border-amber-200 rounded-xl p-4 bg-amber-50/50">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-semibold text-amber-700">申請油資（選填）</div>
          <button v-if="canEditOvertimeFuel" @click="addFuelItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <div v-if="editingLog?.fuelApproved" class="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-2">
          ✓ 油資已核准，無法修改
        </div>
        <div v-else-if="!canEditOvertimeFuel" class="text-xs text-center text-red-500 py-2 bg-red-50 rounded-lg">
          油資申請已超過補請期限（事發日 2 天內），請聯絡主管協助補提出
        </div>
        <template v-if="!editingLog?.fuelApproved && canEditOvertimeFuel">
```

第 91-118 行（申請加班的標題列與截止訊息）：

```html
      <!-- 申請加班 -->
      <div class="border border-purple-200 rounded-xl p-4 bg-purple-50/50 mt-3">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-semibold text-purple-700">申請加班（選填）</div>
          <button v-if="!editingLog?.overtimeApproved && (!isAfterDeadline || editingLog)" @click="addOvertimeItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <!-- 已審核項目（唯讀顯示） -->
        <div v-for="(ot, i) in decidedOvertimeItems" :key="'decided-'+i"
          class="border rounded-xl p-3 mb-2 bg-white text-xs text-gray-600"
          :class="ot.approved ? 'border-green-200' : 'border-red-200'">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div><span class="text-gray-400">原因：</span>{{ ot.reason }}</div>
              <div class="text-purple-600 font-semibold mt-0.5">{{ ot.type || '平日' }} 加班 {{ ot.hours }} 小時</div>
            </div>
            <span :class="ot.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'"
              class="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
              {{ ot.approved ? '✓ 已同意' : '✕ 不同意' }}
            </span>
          </div>
        </div>
        <div v-if="editingLog?.overtimeApproved" class="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-2">
          ✓ 加班已全部審核完畢
        </div>
        <div v-else-if="isAfterDeadline && !editingLog" class="text-xs text-center text-red-500 py-2 bg-red-50 rounded-lg">
          加班申請已截止（截止至後天 19:00）
        </div>
        <div v-else-if="overtimeItems.length === 0 && decidedOvertimeItems.length === 0" class="text-xs text-gray-400 py-1">無加班申請（可點右上新增）</div>
```

改成：

```html
      <!-- 申請加班 -->
      <div class="border border-purple-200 rounded-xl p-4 bg-purple-50/50 mt-3">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-semibold text-purple-700">申請加班（選填）</div>
          <button v-if="!editingLog?.overtimeApproved && canEditOvertimeFuel" @click="addOvertimeItem" class="text-xs" style="color:#c9a96e">+ 新增</button>
        </div>
        <!-- 已審核項目（唯讀顯示） -->
        <div v-for="(ot, i) in decidedOvertimeItems" :key="'decided-'+i"
          class="border rounded-xl p-3 mb-2 bg-white text-xs text-gray-600"
          :class="ot.approved ? 'border-green-200' : 'border-red-200'">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div><span class="text-gray-400">原因：</span>{{ ot.reason }}</div>
              <div class="text-purple-600 font-semibold mt-0.5">{{ ot.type || '平日' }} 加班 {{ ot.hours }} 小時</div>
            </div>
            <span :class="ot.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'"
              class="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
              {{ ot.approved ? '✓ 已同意' : '✕ 不同意' }}
            </span>
          </div>
        </div>
        <div v-if="editingLog?.overtimeApproved" class="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-2">
          ✓ 加班已全部審核完畢
        </div>
        <div v-else-if="!canEditOvertimeFuel" class="text-xs text-center text-red-500 py-2 bg-red-50 rounded-lg">
          加班申請已超過補請期限（事發日 2 天內），請聯絡主管協助補提出
        </div>
        <div v-else-if="overtimeItems.length === 0 && decidedOvertimeItems.length === 0" class="text-xs text-gray-400 py-1">無加班申請（可點右上新增）</div>
```

- [ ] **Step 4: `submitLog()` 移除對 `canAddFuel`／`isAfterDeadline` 的依賴**

第 290-297 行：

```js
async function submitLog() {
    const caseEntries = myCases.value
        .filter(c => logEntries.value[c.id]?.trim())
        .map(c => ({ caseId: c.id, caseName: c.name, content: logEntries.value[c.id].trim() }))
    const other = otherItems.value.filter(i => i.content.trim()).map(i => ({ content: i.content.trim() }))
    const canAddFuel = !isAfterDeadline.value || !!props.editingLog
    const hasFuel = canAddFuel && fuelItems.value.some(f => f.reason.trim())
    if (!props.editingLog && caseEntries.length === 0 && other.length === 0 && !hasFuel) return
    if (submitting.value) return
    submitting.value = true
```

改成：

```js
async function submitLog() {
    const caseEntries = props.canEditContent
        ? myCases.value
            .filter(c => logEntries.value[c.id]?.trim())
            .map(c => ({ caseId: c.id, caseName: c.name, content: logEntries.value[c.id].trim() }))
        : []
    const other = props.canEditContent
        ? otherItems.value.filter(i => i.content.trim()).map(i => ({ content: i.content.trim() }))
        : []
    const hasFuel = props.canEditOvertimeFuel && fuelItems.value.some(f => f.reason.trim())
    if (!props.editingLog && caseEntries.length === 0 && other.length === 0 && !hasFuel) return
    if (submitting.value) return
    submitting.value = true
```

（新建日誌時 `props.canEditContent`／`props.canEditOvertimeFuel` 從 `WorkJournalTab.vue` 傳進來的預設值都是 `true`，這段邏輯行為不變；只有編輯一筆「一般內容鎖住」的舊日誌時，`caseEntries`/`other` 才會強制變成空陣列——但因為 `updateData` 組法本身在「值為空陣列」跟「原本就沒有內容」時存的結果一樣，不會誤刪原有內容，只是不會再讓使用者在這個畫面改到它。）

- [ ] **Step 5: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 6: Commit**

```bash
git add src/components/cases/WorkJournalLogForm.vue
git commit -m "feat(workJournal): lock general content to same-day, gate overtime/fuel by shared rule"
```

---

## Task 7：`WorkJournalLogCard.vue` 審核按鈕改依天數判斷

**Files:**
- Modify: `src/components/cases/WorkJournalLogCard.vue`

- [ ] **Step 1: 加入 `isAdmin` prop 與共用函式**

第 182-186 行：

```js
const props = defineProps({
    log: Object,
    canEdit: Boolean,
    isManager: Boolean,
})
```

改成：

```js
const props = defineProps({
    log: Object,
    canEdit: Boolean,
    isManager: Boolean,
    isAdmin: Boolean,
})
```

在 import 區塊（第 173-177 行）加入：

```js
import { canApproveOvertimeFuel } from '@/utils/workJournalDeadline'
```

在 `pendingOvertimeCount` computed（第 197-199 行）之後加入：

```js
const canApprove = computed(() => canApproveOvertimeFuel(props.log.date, props.isAdmin, props.isManager))
```

- [ ] **Step 2: 油資確認按鈕改用 `canApprove`**

第 57-62 行：

```html
        <div class="flex items-center gap-2">
          <span v-if="log.fuelApproved" class="text-[10px] text-green-600 font-semibold">✓ 已確認</span>
          <button v-else-if="isManager" @click="$emit('approve-fuel', log.id)"
            class="text-[11px] text-white px-2.5 py-1 rounded-lg" style="background:#22c55e">✓ 確認油資</button>
          <span v-else class="text-[10px] text-amber-500 font-semibold">待主管確認</span>
        </div>
```

改成：

```html
        <div class="flex items-center gap-2">
          <span v-if="log.fuelApproved" class="text-[10px] text-green-600 font-semibold">✓ 已確認</span>
          <button v-else-if="canApprove" @click="$emit('approve-fuel', log.id)"
            class="text-[11px] text-white px-2.5 py-1 rounded-lg" style="background:#22c55e">✓ 確認油資</button>
          <span v-else class="text-[10px] text-amber-500 font-semibold">待主管確認</span>
        </div>
```

- [ ] **Step 3: 加班核准按鈕改用 `canApprove`**

第 111-123 行：

```html
          <div class="flex-shrink-0">
            <span v-if="ot.approved === true"
              class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">✓ 同意</span>
            <span v-else-if="ot.approved === false"
              class="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">✕ 不同意</span>
            <div v-else-if="isManager" class="flex gap-1">
              <button @click="$emit('approve-overtime-item', log, i, true)"
                class="text-[11px] text-white px-2 py-0.5 rounded-lg" style="background:#22c55e">✓ 同意</button>
              <button @click="$emit('approve-overtime-item', log, i, false)"
                class="text-[11px] text-white px-2 py-0.5 rounded-lg" style="background:#ef4444">✕ 不同意</button>
            </div>
            <span v-else class="text-[10px] text-purple-400">待審核</span>
          </div>
```

改成：

```html
          <div class="flex-shrink-0">
            <span v-if="ot.approved === true"
              class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">✓ 同意</span>
            <span v-else-if="ot.approved === false"
              class="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">✕ 不同意</span>
            <div v-else-if="canApprove" class="flex gap-1">
              <button @click="$emit('approve-overtime-item', log, i, true)"
                class="text-[11px] text-white px-2 py-0.5 rounded-lg" style="background:#22c55e">✓ 同意</button>
              <button @click="$emit('approve-overtime-item', log, i, false)"
                class="text-[11px] text-white px-2 py-0.5 rounded-lg" style="background:#ef4444">✕ 不同意</button>
            </div>
            <span v-else class="text-[10px] text-purple-400">待審核</span>
          </div>
```

- [ ] **Step 4: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 5: Commit**

```bash
git add src/components/cases/WorkJournalLogCard.vue
git commit -m "feat(workJournal): gate overtime/fuel approval by days-since-log-date, admin-only beyond 2 days"
```

---

## Task 8：主管代發補建日誌能力

**Files:**
- Modify: `src/stores/workLogs.js`
- Modify: `src/components/cases/WorkJournalTab.vue`
- Test: `tests/stores/workLogs.test.js`

- [ ] **Step 1: 寫失敗測試**

在 `tests/stores/workLogs.test.js` 檔案末尾加入：

```js
describe('findLogForUserDate / createProxyLog', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('findLogForUserDate returns null when no log exists for that user/date', async () => {
        getDocs.mockResolvedValue({ empty: true, docs: [] })
        const store = useWorkLogsStore()
        const result = await store.findLogForUserDate('u1', new Date('2026-07-10'))
        expect(result).toBeNull()
    })

    it('findLogForUserDate returns the existing log when found', async () => {
        getDocs.mockResolvedValue({
            empty: false,
            docs: [{ id: 'log1', data: () => ({ userId: 'u1', date: { toDate: () => new Date('2026-07-10') } }) }],
        })
        const store = useWorkLogsStore()
        const result = await store.findLogForUserDate('u1', new Date('2026-07-10'))
        expect(result).toMatchObject({ id: 'log1', userId: 'u1' })
    })

    it('createProxyLog creates a minimal log document for the target user', async () => {
        const { addDoc } = await import('firebase/firestore')
        const store = useWorkLogsStore()
        await store.createProxyLog('u2', '昆霖', 'south', new Date('2026-07-10'))
        expect(addDoc).toHaveBeenCalledTimes(1)
        const [, data] = addDoc.mock.calls[0]
        expect(data).toMatchObject({ userId: 'u2', userName: '昆霖', companyId: 'south' })
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/stores/workLogs.test.js`
Expected: FAIL — `store.findLogForUserDate is not a function`

- [ ] **Step 3: 實作 `findLogForUserDate`／`createProxyLog`**

在 `src/stores/workLogs.js` 的 `fetchApprovedOvertimeDetail` 之後加入：

```js
    async function findLogForUserDate(userId, date) {
        const start = new Date(date); start.setHours(0, 0, 0, 0)
        const end = new Date(date); end.setHours(23, 59, 59, 999)
        const q = query(
            collection(db, 'workLogs'),
            where('userId', '==', userId),
            where('date', '>=', Timestamp.fromDate(start)),
            where('date', '<=', Timestamp.fromDate(end)),
        )
        const snap = await getDocs(q)
        if (snap.empty) return null
        const d = snap.docs[0]
        return { id: d.id, ...d.data() }
    }

    async function createProxyLog(userId, userName, companyId, date) {
        return addLog({ userId, userName, companyId, date: Timestamp.fromDate(date) })
    }
```

把 `return` 陳述式改成：

```js
    return {
        logs, pendingLogs,
        subscribe, subscribePending, cleanupPending,
        addLog, updateLog, addReply,
        approveFuel, approveOvertimeItem,
        fetchMonthlyKm, fetchMonthlyOvertimeHours, fetchMonthlyAttendance, fetchApprovedOvertimeDetail,
        findLogForUserDate, createProxyLog,
        unsubscribe: cleanup
    }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/stores/workLogs.test.js`
Expected: PASS（9 個測試）

- [ ] **Step 5: `WorkJournalTab.vue` 加上主管代發入口**

在 import 區塊加入 `Timestamp`：

```js
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as XLSX from 'xlsx'
import { useWorkLogsStore } from '@/stores/workLogs'
```

改成：

```js
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as XLSX from 'xlsx'
import { Timestamp } from 'firebase/firestore'
import { useWorkLogsStore } from '@/stores/workLogs'
```

在 `const viewMode = ref('day')`（第 122 行）之後加入：

```js
const showProxyPicker = ref(false)
const proxyForm = ref({ userId: '', date: '' })
const proxySubmitting = ref(false)

const todayStr = computed(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function openProxyPicker() {
    proxyForm.value = { userId: '', date: todayStr.value }
    showProxyPicker.value = true
}

async function submitProxyPicker() {
    if (!proxyForm.value.userId || !proxyForm.value.date || proxySubmitting.value) return
    proxySubmitting.value = true
    try {
        const targetUser = usersStore.users.find(u => u.id === proxyForm.value.userId)
        const dateObj = new Date(`${proxyForm.value.date}T00:00:00`)
        let log = await logsStore.findLogForUserDate(proxyForm.value.userId, dateObj)
        if (!log) {
            const docRef = await logsStore.createProxyLog(proxyForm.value.userId, targetUser?.name ?? '', props.region, dateObj)
            log = { id: docRef.id, userId: proxyForm.value.userId, userName: targetUser?.name ?? '', companyId: props.region, date: Timestamp.fromDate(dateObj) }
        }
        showProxyPicker.value = false
        editingLog.value = log
        showLogForm.value = true
    } catch {
        toast('補建日誌失敗，請重試', 'error')
    } finally {
        proxySubmitting.value = false
    }
}
```

在「+ 填寫今日日誌」按鈕（第 40-43 行）之後加入新按鈕：

```html
          <button v-if="isToday" @click="openLogForm"
            class="text-sm text-white px-4 py-2 rounded-lg w-full lg:w-auto min-h-[40px] font-semibold" style="background:#1e2533">
            + 填寫今日日誌
          </button>
```

改成：

```html
          <button v-if="isToday" @click="openLogForm"
            class="text-sm text-white px-4 py-2 rounded-lg w-full lg:w-auto min-h-[40px] font-semibold" style="background:#1e2533">
            + 填寫今日日誌
          </button>
          <button v-if="authStore.isManager" @click="openProxyPicker"
            class="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg w-full lg:w-auto min-h-[40px] font-semibold hover:border-gray-400">
            + 幫同事補加班/油資
          </button>
```

在 `WorkJournalLogForm`（第 89-96 行，Task 5 改完後的樣子）之後加入補建挑選 Modal：

```html
  <!-- 主管代發：選同事與日期 -->
  <div v-if="showProxyPicker" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">幫同事補加班/油資申請</h3>
        <button @click="showProxyPicker = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">同事 *</label>
          <select v-model="proxyForm.userId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 選擇同事 —</option>
            <option v-for="u in usersStore.users.filter(u => u.companyId === region)" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">日期 *</label>
          <input v-model="proxyForm.date" type="date" :max="todayStr"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showProxyPicker = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitProxyPicker" :disabled="proxySubmitting || !proxyForm.userId || !proxyForm.date"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ proxySubmitting ? '處理中…' : '下一步' }}
        </button>
      </div>
    </div>
  </div>
```

- [ ] **Step 6: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 7: 手動驗收**

1. `npm run dev`，登入主管或 admin 帳號，進工作日誌，確認「+ 幫同事補加班/油資」按鈕出現（一般員工帳號應該看不到）
2. 選一位同事、選一個 3 天前完全沒有日誌的日期，點下一步，確認開啟的表單只有「申請油資」「申請加班」兩個區塊，沒有「負責案件回報」「其他工作項目」「附件」
3. 填一筆加班送出，確認送出後可以在該同事名下、那個日期看到這筆日誌，且審核按鈕（依 Task 7）只有 admin 看得到
4. 選同一位同事、選「今天」，確認流程一樣可以走（不限定一定要過去日期）

- [ ] **Step 8: Commit**

```bash
git add src/stores/workLogs.js tests/stores/workLogs.test.js src/components/cases/WorkJournalTab.vue
git commit -m "feat(workJournal): allow managers to backfill overtime/fuel-only logs for other employees"
```

---

## Task 9：完整驗收

**Files:** 無新增/修改，純驗收

- [ ] **Step 1: 跑完整測試套件**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 2: Build 確認**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 3: 端到端手動驗收**

1. 重新過一次 Task 1、2、3、8 各自的手動驗收步驟，確認彼此沒有互相影響
2. 工作日誌整體流程：
   - 今天填的日誌，今天之內可以自由編輯任何內容（含加班/油資）
   - 過了今天（隔天起），一般內容鎖住——包含用主管帳號登入也改不動
   - 本人在事發日 2 天內，還能補加班/油資到既有日誌或完全空白的日誌
   - 事發日第 3 天起，本人完全看不到加班/油資的「+新增」，只能靠主管用「+ 幫同事補加班/油資」處理
   - 事發日 2 天內的加班，任一主管都能核准；第 3 天起，只有 admin 看得到核准按鈕，其他主管看到「待審核」但按不了
3. 全部通過後，回報柏這批（連同先前的廠商比價／工種選單／多施作位置）已經準備好，等他在測試版驗收

- [ ] **Step 4: 部署（需要柏明確說「上線」才能執行）**

這個 plan 沒有改 `firestore.rules`。

Run: `npm run deploy`

**在柏明確表示可以上線之前，不要執行這個指令。**
