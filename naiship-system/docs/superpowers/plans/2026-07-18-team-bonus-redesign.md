# 團隊獎金重新設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「季度獎金統計」功能裡的團隊獎金，從「每季四角色各一個手動數字、跟案件無關」改成「每案一包錢，由該案業務/設計師/工務參與人（去重）分享」。

**Architecture:** 沿用既有的 `splitBonus()` 分帳函式（不重寫分帳邏輯），資料從 `bonusQuarters/{quarter}.teamBonus` 搬到 `caseBonusData/{caseId}.teamBonusAmount`/`teamBonusSplit`，計算邏輯新增 `dedupeParticipants()`/`buildTeamBonusEntries()` 兩個純函式，併入既有的 `buildCaseBonusEntries()` 回傳結果。

**Tech Stack:** Vue 3 `<script setup>`、Pinia、Firebase Firestore（Web SDK v9 modular）、Tailwind CSS v4、Vitest。

---

## 檔案異動總覽

- 修改：`src/utils/bonusCalc.js`（新增 `dedupeParticipants`、`buildTeamBonusEntries`，`buildCaseBonusEntries` 併入團隊獎金 entries）
- 修改：`tests/utils/bonusCalc.test.js`（新增對應測試）
- 修改：`src/stores/caseBonusData.js`（`defaultCaseBonusData()` 新增 `teamBonusAmount`/`teamBonusSplit`）
- 修改：`src/stores/bonusQuarters.js`（`defaultQuarterData()` 移除 `teamBonus`）
- 修改：`src/views/BonusView.vue`（移除季度層級團隊獎金區塊、`roleLabel()` 加 `team`、拿掉 `teamBonus` 讀寫）
- 修改：`src/components/bonus/CaseBonusForm.vue`（新增團隊獎金總額輸入 + 參與人清單 + 分帳 UI）

---

### Task 1: `bonusCalc.js` — 參與人去重 + 團隊獎金 entries

**Files:**
- Modify: `naiship-system/src/utils/bonusCalc.js`
- Modify: `naiship-system/tests/utils/bonusCalc.test.js`

- [ ] **Step 1: 寫失敗的測試**

在 `tests/utils/bonusCalc.test.js` 檔案最後加：

```js
import { dedupeParticipants, buildTeamBonusEntries } from '@/utils/bonusCalc'

describe('dedupeParticipants', () => {
    it('三個角色的人合併去重', () => {
        const bonusData = { salesPersonIds: ['u1', 'u2'], designerIds: ['u2', 'u3'], siteManagerIds: ['u3'] }
        expect(dedupeParticipants(bonusData)).toEqual(['u1', 'u2', 'u3'])
    })
    it('三個角色都沒人時回傳空陣列', () => {
        expect(dedupeParticipants({})).toEqual([])
    })
    it('只有一個角色有人時只回傳那個角色的人', () => {
        expect(dedupeParticipants({ designerIds: ['u5'] })).toEqual(['u5'])
    })
})

describe('buildTeamBonusEntries', () => {
    const usersById = { u1: { name: '柯其宏' }, u2: { name: '陳柏兆' } }

    it('金額為 0 時回傳空陣列（即使有參與人）', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { salesPersonIds: ['u1'], teamBonusAmount: 0 }
        expect(buildTeamBonusEntries(caseInfo, bonusData, usersById)).toEqual([])
    })
    it('沒有參與人時回傳空陣列（即使有金額）', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { teamBonusAmount: 10000 }
        expect(buildTeamBonusEntries(caseInfo, bonusData, usersById)).toEqual([])
    })
    it('單人參與時全拿', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { salesPersonIds: ['u1'], teamBonusAmount: 9000 }
        const entries = buildTeamBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toEqual([{
            role: 'team', personId: 'u1', personName: '柯其宏',
            caseId: 'c1', caseName: '測試案',
            suggestedAmount: 9000, finalAmount: 9000, paid: false,
        }])
    })
    it('同一人身兼業務+設計師只算一份，不會拿兩份', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { salesPersonIds: ['u1'], designerIds: ['u1'], teamBonusAmount: 10000 }
        const entries = buildTeamBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(1)
        expect(entries[0].suggestedAmount).toBe(10000)
    })
    it('兩人分屬不同角色時均分', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { salesPersonIds: ['u1'], designerIds: ['u2'], teamBonusAmount: 10000 }
        const entries = buildTeamBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(2)
        expect(entries[0].suggestedAmount + entries[1].suggestedAmount).toBe(10000)
        expect(entries.find(e => e.personId === 'u1').suggestedAmount).toBe(5000)
        expect(entries.find(e => e.personId === 'u2').suggestedAmount).toBe(5000)
    })
    it('有填自訂分比時依比例分配', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = {
            salesPersonIds: ['u1'], designerIds: ['u2'],
            teamBonusAmount: 10000, teamBonusSplit: { u1: 70, u2: 30 },
        }
        const entries = buildTeamBonusEntries(caseInfo, bonusData, usersById)
        expect(entries.find(e => e.personId === 'u1').suggestedAmount).toBe(7000)
        expect(entries.find(e => e.personId === 'u2').suggestedAmount).toBe(3000)
    })
})

describe('buildCaseBonusEntries 併入團隊獎金', () => {
    const usersById = { u1: { name: '柯其宏' } }

    it('團隊獎金 entries 會併入回傳陣列', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = {
            designContractAmount: 0, constructionContractAmount: 0,
            salesPersonIds: ['u1'], designerIds: [], siteManagerIds: [],
            miscExpenses: 0, teamBonusAmount: 5000,
        }
        const entries = buildCaseBonusEntries(caseInfo, bonusData, usersById)
        // designContractAmount/constructionContractAmount 都是 0，業務獎金算出 0 不會產生 sales entry，
        // 只會有團隊獎金這一筆
        expect(entries).toHaveLength(1)
        expect(entries[0]).toMatchObject({ role: 'team', personId: 'u1', suggestedAmount: 5000 })
    })
    it('沒有 teamBonusAmount 欄位時（既有舊資料相容）不影響原本三個角色的 entries', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = {
            designContractAmount: 1000000, constructionContractAmount: 0,
            salesPersonIds: ['u1'], designerIds: [], siteManagerIds: [],
            miscExpenses: 0,
        }
        const entries = buildCaseBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(1)
        expect(entries[0].role).toBe('sales')
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run tests/utils/bonusCalc.test.js`
Expected: FAIL，找不到 `dedupeParticipants`／`buildTeamBonusEntries`，或 `buildCaseBonusEntries 併入團隊獎金` 兩個測試失敗（現有 `buildCaseBonusEntries` 還沒併入團隊獎金邏輯）

- [ ] **Step 3: 在 `bonusCalc.js` 加上 `dedupeParticipants`／`buildTeamBonusEntries`，並修改 `buildCaseBonusEntries`**

在 `naiship-system/src/utils/bonusCalc.js` 裡，找到 `pushRoleEntries` 函式（目前在 `buildCaseBonusEntries` 之前），在它後面、`buildCaseBonusEntries` 定義之前插入：

```js
export function dedupeParticipants(bonusData) {
    const ids = [
        ...(bonusData.salesPersonIds || []),
        ...(bonusData.designerIds || []),
        ...(bonusData.siteManagerIds || []),
    ]
    return [...new Set(ids)]
}

export function buildTeamBonusEntries(caseInfo, bonusData, usersById = {}) {
    const participantIds = dedupeParticipants(bonusData)
    const amount = bonusData.teamBonusAmount || 0
    if (amount <= 0 || participantIds.length === 0) return []
    const split = splitBonus(amount, participantIds, bonusData.teamBonusSplit)
    return participantIds.map(uid => ({
        role: 'team',
        personId: uid,
        personName: usersById[uid]?.name || '',
        caseId: caseInfo.id,
        caseName: caseInfo.name,
        suggestedAmount: split[uid],
        finalAmount: split[uid],
        paid: false,
    }))
}
```

然後修改現有的 `buildCaseBonusEntries` 函式，把：

```js
export function buildCaseBonusEntries(caseInfo, bonusData, usersById = {}) {
    const entries = []
    const vendorCostTotal = sumVendorCost(caseInfo.workTypes)

    const salesAmount = calcSalesBonus(bonusData.designContractAmount, bonusData.constructionContractAmount, caseInfo.signedAmount)
    pushRoleEntries(entries, 'sales', salesAmount, bonusData.salesPersonIds, bonusData.salesSplit, usersById, caseInfo)

    const designerAmount = calcDesignerBonus(caseInfo.signedAmount)
    pushRoleEntries(entries, 'designer', designerAmount, bonusData.designerIds, bonusData.designerSplit, usersById, caseInfo)

    const siteManagerAmount = calcSiteManagerBonus(caseInfo.signedAmount, vendorCostTotal, bonusData.miscExpenses)
    pushRoleEntries(entries, 'siteManager', siteManagerAmount, bonusData.siteManagerIds, bonusData.siteManagerSplit, usersById, caseInfo)

    return entries
}
```

改成（唯一差異是回傳前多一行併入團隊獎金 entries）：

```js
export function buildCaseBonusEntries(caseInfo, bonusData, usersById = {}) {
    const entries = []
    const vendorCostTotal = sumVendorCost(caseInfo.workTypes)

    const salesAmount = calcSalesBonus(bonusData.designContractAmount, bonusData.constructionContractAmount, caseInfo.signedAmount)
    pushRoleEntries(entries, 'sales', salesAmount, bonusData.salesPersonIds, bonusData.salesSplit, usersById, caseInfo)

    const designerAmount = calcDesignerBonus(caseInfo.signedAmount)
    pushRoleEntries(entries, 'designer', designerAmount, bonusData.designerIds, bonusData.designerSplit, usersById, caseInfo)

    const siteManagerAmount = calcSiteManagerBonus(caseInfo.signedAmount, vendorCostTotal, bonusData.miscExpenses)
    pushRoleEntries(entries, 'siteManager', siteManagerAmount, bonusData.siteManagerIds, bonusData.siteManagerSplit, usersById, caseInfo)

    entries.push(...buildTeamBonusEntries(caseInfo, bonusData, usersById))

    return entries
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run tests/utils/bonusCalc.test.js`
Expected: PASS，全部測試過（既有 41 個 + 這次新增的 9 個）

- [ ] **Step 5: 跑整個專案的既有測試，確認沒有改壞其他東西**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run`
Expected: 所有既有測試 + 這次新增的測試全部 PASS（156 + 9 = 165 個）

- [ ] **Step 6: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/utils/bonusCalc.js naiship-system/tests/utils/bonusCalc.test.js
git commit -m "feat(bonus): add per-case team bonus participant dedup and entry builder"
```

---

### Task 2: `caseBonusData.js` — 新增團隊獎金欄位

**Files:**
- Modify: `naiship-system/src/stores/caseBonusData.js`

- [ ] **Step 1: 在 `defaultCaseBonusData()` 加兩個欄位**

找到 `naiship-system/src/stores/caseBonusData.js` 的 `defaultCaseBonusData()`：

```js
export function defaultCaseBonusData() {
    return {
        designContractAmount: 0,
        constructionContractAmount: 0,
        salesPersonIds: [], salesSplit: {},
        designerIds: [], designerSplit: {},
        siteManagerIds: [], siteManagerSplit: {},
        miscExpenses: 0,
        qualitativeChecks: {
            sales: { 達成簽約: false, 案件資訊: false, 簽約後交接: false },
            designer: { 丈量: false, 提案: false, 設計: false, 與業主收款: false, 廠商收取發票: false },
            siteManager: { 品質: false, 工程進度: false, 無重大客訴: false, 無嚴重追加錯誤: false, 收尾驗收: false },
        },
        notes: '',
    }
}
```

改成（在 `miscExpenses: 0,` 後面加兩行）：

```js
export function defaultCaseBonusData() {
    return {
        designContractAmount: 0,
        constructionContractAmount: 0,
        salesPersonIds: [], salesSplit: {},
        designerIds: [], designerSplit: {},
        siteManagerIds: [], siteManagerSplit: {},
        miscExpenses: 0,
        teamBonusAmount: 0, teamBonusSplit: {},
        qualitativeChecks: {
            sales: { 達成簽約: false, 案件資訊: false, 簽約後交接: false },
            designer: { 丈量: false, 提案: false, 設計: false, 與業主收款: false, 廠商收取發票: false },
            siteManager: { 品質: false, 工程進度: false, 無重大客訴: false, 無嚴重追加錯誤: false, 收尾驗收: false },
        },
        notes: '',
    }
}
```

- [ ] **Step 2: 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run`
Expected: 所有測試依然 PASS（這個檔案沒有專屬單元測試，跑全套確認沒連帶壞掉別的）

- [ ] **Step 3: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/stores/caseBonusData.js
git commit -m "feat(bonus): add teamBonusAmount/teamBonusSplit to case bonus data defaults"
```

---

### Task 3: `bonusQuarters.js` — 移除季度層級團隊獎金欄位

**Files:**
- Modify: `naiship-system/src/stores/bonusQuarters.js`

- [ ] **Step 1: 從 `defaultQuarterData()` 移除 `teamBonus`**

找到 `naiship-system/src/stores/bonusQuarters.js` 的：

```js
export function defaultQuarterData() {
    return {
        entries: [],
        adminTarget: {
            leadCount: 0, signedCount: 0,
            leadThresholds: [],
            signedBonusPerCase: 1000,
            assignedToUid: '', assignedToName: '',
        },
        teamBonus: { sales: 0, designer: 0, siteManager: 0, admin: 0 },
    }
}
```

改成（拿掉最後一行 `teamBonus`，注意上一行 `assignedToName: '',` 後面的逗號要留著，物件最後一個屬性 `adminTarget` 後面不加逗號）：

```js
export function defaultQuarterData() {
    return {
        entries: [],
        adminTarget: {
            leadCount: 0, signedCount: 0,
            leadThresholds: [],
            signedBonusPerCase: 1000,
            assignedToUid: '', assignedToName: '',
        },
    }
}
```

- [ ] **Step 2: 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤（這一步之後 `BonusView.vue` 還在讀寫 `teamBonus`，但因為 JS 對不存在的物件屬性讀取是 `undefined`、寫入是正常賦值，不會讓 build 失敗——Task 4 才會清掉那些引用）

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run`
Expected: 所有測試依然 PASS

- [ ] **Step 3: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/stores/bonusQuarters.js
git commit -m "feat(bonus): remove quarter-level teamBonus field, replaced by per-case team bonus"
```

---

### Task 4: `BonusView.vue` — 移除季度層級團隊獎金區塊

**Files:**
- Modify: `naiship-system/src/views/BonusView.vue`

- [ ] **Step 1: 移除「團隊獎金（手動輸入）」整個 `<section>`**

找到 `naiship-system/src/views/BonusView.vue` 裡的這個區塊（目前在「行政獎金」`<section>` 之後、「本季發放彙總」`<section>` 之前）：

```vue
    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <h2 class="text-sm font-bold text-gray-700 mb-3">團隊獎金（手動輸入）</h2>
      <div class="grid grid-cols-4 gap-3">
        <div v-for="role in ['sales', 'designer', 'siteManager', 'admin']" :key="role">
          <label class="text-xs text-gray-500 mb-1 block">{{ roleLabel(role) }}</label>
          <input v-model.number="quarterForm.teamBonus[role]" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
      </div>
    </section>

```

整段刪除（含前後空行，讓「行政獎金」`</section>` 後面直接接「本季發放彙總」`<section>`）。

- [ ] **Step 2: `roleLabel()` 加上 `team` 對應**

找到：

```js
function roleLabel(role) {
    return { sales: '業務', designer: '設計師', siteManager: '工務', admin: '行政' }[role]
}
```

改成：

```js
function roleLabel(role) {
    return { sales: '業務', designer: '設計師', siteManager: '工務', admin: '行政', team: '團隊' }[role]
}
```

- [ ] **Step 3: `loadQuarter()` 拿掉 `teamBonus` 賦值**

找到：

```js
async function loadQuarter(q) {
    const data = await bonusQuartersStore.fetchQuarter(q)
    quarterForm.adminTarget = data.adminTarget
    quarterForm.teamBonus = data.teamBonus
    caseEntries.value = data.entries || []
    await recalculate()
}
```

改成（拿掉 `quarterForm.teamBonus = data.teamBonus` 這一行）：

```js
async function loadQuarter(q) {
    const data = await bonusQuartersStore.fetchQuarter(q)
    quarterForm.adminTarget = data.adminTarget
    caseEntries.value = data.entries || []
    await recalculate()
}
```

- [ ] **Step 4: `saveQuarterData()` 拿掉 `teamBonus` 欄位**

找到：

```js
async function saveQuarterData() {
    savingQuarter.value = true
    try {
        await bonusQuartersStore.saveQuarter(selectedQuarter.value, {
            adminTarget: quarterForm.adminTarget,
            teamBonus: quarterForm.teamBonus,
            entries: caseEntries.value,
        })
        toast('已儲存本季資料')
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        savingQuarter.value = false
    }
}
```

改成（拿掉 `teamBonus: quarterForm.teamBonus,` 這一行）：

```js
async function saveQuarterData() {
    savingQuarter.value = true
    try {
        await bonusQuartersStore.saveQuarter(selectedQuarter.value, {
            adminTarget: quarterForm.adminTarget,
            entries: caseEntries.value,
        })
        toast('已儲存本季資料')
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        savingQuarter.value = false
    }
}
```

- [ ] **Step 5: 確認整個檔案沒有其他 `teamBonus` 殘留引用**

Run: `cd "C:\AI助理 Claude\naiship-system" && grep -n "teamBonus" src/views/BonusView.vue`
Expected: 沒有任何輸出（完全找不到 `teamBonus` 字樣，代表清乾淨了；`quarterForm.teamBonus`／`v-for="role in ['sales', 'designer', 'siteManager', 'admin']"` 那個區塊都已經不在了）

- [ ] **Step 6: Build 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run`
Expected: 所有測試依然 PASS

- [ ] **Step 7: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/views/BonusView.vue
git commit -m "feat(bonus): remove quarter-level team bonus section from BonusView"
```

---

### Task 5: `CaseBonusForm.vue` — 新增團隊獎金總額 + 參與人分帳 UI

**Files:**
- Modify: `naiship-system/src/components/bonus/CaseBonusForm.vue`

- [ ] **Step 1: 加上團隊獎金區塊（金額輸入 + 參與人清單 + 分帳）**

在 `naiship-system/src/components/bonus/CaseBonusForm.vue` 的 `<template>` 裡，找到工務區塊結尾（「工務建議獎金」那一行）：

```vue
        <div class="text-xs text-gray-500">工務建議獎金：{{ siteManagerAmount.toLocaleString() }} 元</div>

        <div v-for="role in ['sales', 'designer', 'siteManager']" :key="role">
```

在這兩行中間插入團隊獎金區塊：

```vue
        <div class="text-xs text-gray-500">工務建議獎金：{{ siteManagerAmount.toLocaleString() }} 元</div>

        <div>
          <label class="text-xs text-gray-500 mb-1 block">團隊獎金總額</label>
          <input v-model.number="form.teamBonusAmount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div v-if="teamParticipantIds.length === 0" class="text-xs text-gray-400">尚未指定任何角色負責人，無法分配團隊獎金</div>
        <div v-else class="flex flex-col gap-1.5">
          <div class="text-xs text-gray-500">團隊獎金參與人（自動合併業務/設計師/工務負責人，同一人不重複計算）</div>
          <div v-for="uid in teamParticipantIds" :key="uid" class="flex items-center gap-2 text-xs text-gray-600">
            <span class="flex-1">{{ participantName(uid) }}</span>
            <span v-if="teamParticipantIds.length > 1" class="flex items-center gap-1">
              <input type="number" min="0" max="100" :value="form.teamBonusSplit[uid] ?? teamDefaultPercent"
                @input="setTeamSplit(uid, $event.target.value)"
                class="w-14 border border-gray-200 rounded px-1 py-0.5 text-xs">%
            </span>
            <span class="w-16 text-right">{{ (teamSplitPreview[uid] || 0).toLocaleString() }} 元</span>
          </div>
        </div>

        <div v-for="role in ['sales', 'designer', 'siteManager']" :key="role">
```

- [ ] **Step 2: `<script setup>` 補邏輯**

把現有的 import 區：

```js
import { ref, reactive, computed, onMounted } from 'vue'
import { useCaseBonusDataStore, defaultCaseBonusData } from '@/stores/caseBonusData'
import { useToast } from '@/composables/useToast'
import {
    calcSalesBonus, calcDesignerBonus, calcSiteManagerBonus,
    calcProfitMargin, sumVendorCost,
} from '@/utils/bonusCalc'
import RoleAssigneePicker from './RoleAssigneePicker.vue'
```

改成（加入 `useUsersStore` 跟三個新的 `bonusCalc` 函式）：

```js
import { ref, reactive, computed, onMounted } from 'vue'
import { useCaseBonusDataStore, defaultCaseBonusData } from '@/stores/caseBonusData'
import { useUsersStore } from '@/stores/users'
import { useToast } from '@/composables/useToast'
import {
    calcSalesBonus, calcDesignerBonus, calcSiteManagerBonus,
    calcProfitMargin, sumVendorCost, dedupeParticipants, splitBonus,
} from '@/utils/bonusCalc'
import RoleAssigneePicker from './RoleAssigneePicker.vue'
```

在 `const store = useCaseBonusDataStore()` 那一行後面加：

```js
const usersStore = useUsersStore()
```

在檔案最後（`siteManagerAmount` 那個 computed 之後、`function roleLabel` 之前）加：

```js
const teamParticipantIds = computed(() => dedupeParticipants(form))
const teamDefaultPercent = computed(() =>
    teamParticipantIds.value.length ? Math.floor(100 / teamParticipantIds.value.length) : 0)
const teamSplitPreview = computed(() =>
    splitBonus(form.teamBonusAmount || 0, teamParticipantIds.value, form.teamBonusSplit))

function participantName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? uid
}

function setTeamSplit(uid, value) {
    form.teamBonusSplit = { ...form.teamBonusSplit, [uid]: Number(value) || 0 }
}
```

- [ ] **Step 3: Build 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run`
Expected: 所有測試依然 PASS（這個檔案沒有專屬單元測試，沿用專案既有慣例，跑全套確認沒連帶壞掉別的）

- [ ] **Step 4: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/components/bonus/CaseBonusForm.vue
git commit -m "feat(bonus): add per-case team bonus amount and participant split UI"
```

---

## 執行後檢查清單（對照 spec「測試」章節，柏會在試用版親自驗證）

- [ ] 案件填業務+設計師（同一人）+ 工務（另一人）+ 團隊獎金金額，參與人清單只列 2 人（不是 3 人）、均分金額正確
- [ ] 手動調整其中一人的分比，金額跟著變、加總仍等於團隊獎金總額
- [ ] 儲存後彙總表出現對應「團隊」角色的 entries，人數跟金額正確
- [ ] 標記其中一筆已發放，鎖定行為跟業務/設計師/工務一致
- [ ] 案件完全沒指定角色負責人時，團隊獎金欄位可填但不產生 entries，畫面提示正確顯示
- [ ] 季度發放彙總頁面不再出現舊版「團隊獎金（手動輸入）」區塊
