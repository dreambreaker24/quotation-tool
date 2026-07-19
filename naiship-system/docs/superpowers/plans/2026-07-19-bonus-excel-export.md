# 季度獎金統計 Excel 匯出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「季度獎金統計」頁面的「本季發放彙總」表格新增「匯出 Excel」按鈕，匯出目前選定季度的發放彙總資料。

**Architecture:** 沿用 `src/composables/useExport.js` 既有的 `exportCases`/`exportClients`/`exportPettyCash` 寫法，新增一個同款的 `exportBonusSummary(entries, quarterKey)` 函式，`BonusView.vue` 新增一顆按鈕呼叫它。

**Tech Stack:** Vue 3 `<script setup>`、`xlsx` npm 套件、Tailwind CSS v4。

---

## 檔案異動總覽

- 修改：`src/composables/useExport.js`（新增 `exportBonusSummary`）
- 修改：`src/views/BonusView.vue`（「本季發放彙總」標題列加「匯出 Excel」按鈕）

這兩個檔案改動緊密相關（按鈕要呼叫剛新增的函式），且都沒有專屬單元測試（既有慣例），範圍小，合併成一個 task。

---

### Task 1: 新增 `exportBonusSummary` 並接上匯出按鈕

**Files:**
- Modify: `naiship-system/src/composables/useExport.js`
- Modify: `naiship-system/src/views/BonusView.vue`

- [ ] **Step 1: 在 `useExport.js` 新增 `exportBonusSummary` 函式**

找到 `naiship-system/src/composables/useExport.js` 裡的 `exportPettyCash` 函式結尾：

```js
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, `零用金${yearMonth}`)
        XLSX.writeFile(wb, `奈拾零用金_${yearMonth}.xlsx`)
    }

    return { exportCases, exportClients, exportPettyCash }
}
```

改成（在 `exportPettyCash` 函式後面、`return` 之前插入新函式，並把 `return` 那行加上 `exportBonusSummary`）：

```js
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, `零用金${yearMonth}`)
        XLSX.writeFile(wb, `奈拾零用金_${yearMonth}.xlsx`)
    }

    function exportBonusSummary(entries, quarterKey) {
        const ROLE_LABELS = { sales: '業務', designer: '設計師', siteManager: '工務', admin: '行政', team: '團隊' }
        const rows = entries.map(e => ({
            '角色': ROLE_LABELS[e.role] || e.role,
            '對象': e.personName || '',
            '案件': e.caseName || '—',
            '建議金額': e.suggestedAmount || 0,
            '實發金額': e.finalAmount || 0,
            '已發放': e.paid ? '已發放' : '未發放',
            '發放時間': e.paidAt?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
            '發放人': e.paidBy || '',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '發放彙總')
        XLSX.writeFile(wb, `奈拾季度獎金_${quarterKey}_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.xlsx`)
    }

    return { exportCases, exportClients, exportPettyCash, exportBonusSummary }
}
```

- [ ] **Step 2: `BonusView.vue` 匯入 `useExport` 並加上按鈕**

在 `naiship-system/src/views/BonusView.vue` 的 `<script setup>`，找到：

```js
import { useToast } from '@/composables/useToast'
```

改成（在它後面加一行 import）：

```js
import { useToast } from '@/composables/useToast'
import { useExport } from '@/composables/useExport'
```

找到：

```js
const { toast } = useToast()
```

改成（在它後面加一行）：

```js
const { toast } = useToast()
const { exportBonusSummary } = useExport()
```

在檔案最後（`saveQuarterData` 函式之後）加一個新函式：

```js
function exportBonus() {
    exportBonusSummary(allEntries.value, selectedQuarter.value)
}
```

- [ ] **Step 3: 在「本季發放彙總」標題列加按鈕**

找到 `<template>` 裡的：

```vue
    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-gray-700">本季發放彙總</h2>
        <div class="flex gap-3">
          <button @click="recalculate" class="text-xs text-blue-600 hover:underline">重新試算</button>
          <button @click="saveQuarterData" :disabled="savingQuarter" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">
            {{ savingQuarter ? '儲存中…' : '儲存本季資料' }}
          </button>
        </div>
      </div>
```

改成（在「重新試算」跟「儲存本季資料」中間插入匯出按鈕，樣式比照 `PettyCashView.vue` 既有的匯出按鈕外框風格）：

```vue
    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-gray-700">本季發放彙總</h2>
        <div class="flex gap-3">
          <button @click="recalculate" class="text-xs text-blue-600 hover:underline">重新試算</button>
          <button @click="exportBonus" class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">
            匯出 Excel
          </button>
          <button @click="saveQuarterData" :disabled="savingQuarter" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">
            {{ savingQuarter ? '儲存中…' : '儲存本季資料' }}
          </button>
        </div>
      </div>
```

- [ ] **Step 4: Build 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run`
Expected: 所有既有測試依然 PASS（這兩個檔案都沒有專屬單元測試，跑全套確認沒連帶壞掉別的，應該還是 167 個測試通過）

- [ ] **Step 5: 確認沒有其他遺漏**

Run: `cd "C:\AI助理 Claude\naiship-system" && grep -n "exportBonusSummary" src/composables/useExport.js src/views/BonusView.vue`
Expected: 兩個檔案都要有輸出——`useExport.js` 裡有函式定義跟 `return` 陳述式各一次共兩筆，`BonusView.vue` 裡有 import 解構跟 `exportBonus()` 函式內呼叫各一次共兩筆

- [ ] **Step 6: 自我檢查**

確認只有這兩個檔案被改動。確認 `useExport.js` 其他三個既有函式（`exportCases`/`exportClients`/`exportPettyCash`）完全沒被動到。確認 `BonusView.vue` 除了 import、`const { exportBonusSummary }`、新的 `exportBonus()` 函式、還有模板裡新增的一顆按鈕之外，沒有改到其他任何地方（`recalculate`/`saveQuarterData`/`togglePaid` 等既有函式都要維持原樣）。

- [ ] **Step 7: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/composables/useExport.js naiship-system/src/views/BonusView.vue
git commit -m "feat(bonus): add Excel export for quarterly bonus payout summary"
```

## Reporting

Report DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED at the top, with commit hash and build/test output. Note that manual browser verification（真的下載檔案、打開確認欄位跟資料正確）is deferred to 柏 in the trial preview, not part of this task.

---

## 執行後檢查清單（對照 spec「測試」章節，柏會在試用版親自驗證）

- [ ] 選一季有資料的季度，點「匯出 Excel」，確認下載的 `.xlsx` 檔案欄位/資料跟畫面表格一致（角色中文名稱、已發放狀態文字、金額數字都正確）
- [ ] 已發放的項目確認「發放時間」「發放人」兩欄有值，未發放的項目這兩欄是空的
- [ ] 沒有 entries 的季度點擊「匯出 Excel」，確認不會報錯（產生一份只有欄位標題、沒有資料列的空白 Excel 即可）
- [ ] 檔名格式確認是 `奈拾季度獎金_2026-Q3_20260719.xlsx` 這種格式（季度代碼+今天日期）
