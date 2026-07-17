# 季度獎金統計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 naiship-system 新增一個只有 admin 能用的季度獎金統計功能，依 spec（`docs/superpowers/specs/2026-07-17--quarterly-bonus-statistics.md`）計算業務／設計師／工務／行政四角色的獎金建議值，支援手動覆蓋與已發放標記。

**Architecture:** 純計算邏輯抽到 `src/utils/bonusCalc.js`（可獨立單元測試）；新增兩個 Pinia store（`caseBonusData.js` 存每案件的獎金相關欄位、`bonusQuarters.js` 存每季計算結果與發放狀態）；`cases` collection 只加一個 `completedAt` 欄位；新頁面 `BonusView.vue` + 一個 Modal 元件 `CaseBonusForm.vue`。

**Tech Stack:** Vue 3 `<script setup>`、Pinia、Firebase Firestore（Web SDK v9 modular）、Tailwind CSS v4、Vitest。

---

## 檔案異動總覽

- 修改：`src/stores/cases.js`（`updateCase()` 自動寫入 `completedAt`）
- 修改：`src/components/cases/CaseEditModal.vue`（狀態切到 completed 時寫入 `completedAt`）
- 修改：`firestore.rules`（新增 `caseBonusData`、`bonusQuarters` 規則）
- 新增：`src/utils/bonusCalc.js`（純函式：級距、業務比例、利潤率、分帳、季別判斷、entries 組裝）
- 新增：`tests/utils/bonusCalc.test.js`
- 新增：`src/stores/caseBonusData.js`
- 新增：`src/stores/bonusQuarters.js`
- 修改：`src/router/index.js`（新增 `/bonus` 路由）
- 修改：`src/components/layout/NavBar.vue`（導覽列加「獎金統計」，位置在薪資單後、系統設定前）
- 新增：`src/views/BonusView.vue`
- 新增：`src/components/bonus/CaseBonusForm.vue`
- 新增：`src/components/bonus/RoleAssigneePicker.vue`（業務/設計師/工務三個角色共用的複選+分帳元件）

---

### Task 1: `cases.completedAt` 自動寫入

**Files:**
- Modify: `naiship-system/src/stores/cases.js:42-44`
- Modify: `naiship-system/src/components/cases/CaseEditModal.vue:274-280`

- [ ] **Step 1: 修改 `casesStore.updateCase()`，狀態轉為 completed 時自動補 `completedAt`**

把 `naiship-system/src/stores/cases.js` 第 42-44 行的 `updateCase` 改成：

```js
    async function updateCase(id, data) {
        const patch = { ...data, updatedAt: serverTimestamp() }
        if (data.status === 'completed') {
            const existing = cases.value.find(c => c.id === id)
            if (existing?.status !== 'completed') patch.completedAt = serverTimestamp()
        }
        return updateDoc(doc(db, 'cases', id), patch)
    }
```

這樣 `GanttTab.vue` 的 `markCaseComplete()`（呼叫 `casesStore.updateCase(id, { status: 'completed' })`）不用改就會自動拿到 `completedAt`。

- [ ] **Step 2: `CaseEditModal.vue` 的狀態下拉切到 completed 時也要補 `completedAt`**

`CaseEditModal.vue` 的 `save()` 沒有經過 `casesStore.updateCase()`，是直接組 `writeBatch`，要另外處理。找到第 274-280 行：

```js
        if (form.value.status !== originalStatus.value) {
            const existing = caseData.value?.statusHistory ?? []
            data.statusHistory = [
                ...existing,
                { status: form.value.status, changedAt: Timestamp.now(), changedBy: authStore.name ?? '' }
            ]
        }
```

改成：

```js
        if (form.value.status !== originalStatus.value) {
            const existing = caseData.value?.statusHistory ?? []
            data.statusHistory = [
                ...existing,
                { status: form.value.status, changedAt: Timestamp.now(), changedBy: authStore.name ?? '' }
            ]
            if (form.value.status === 'completed') {
                data.completedAt = serverTimestamp()
            }
        }
```

`serverTimestamp` 已經在這個檔案第 142 行 import 過，不用新增 import。

- [ ] **Step 3: 手動驗證（這兩個檔案沒有 component-mount 測試，沿用既有慣例）**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

用瀏覽器登入 admin 帳號，任選一個非 completed 狀態的測試案件，分別用兩條路徑各測一次：
1. `GanttTab.vue` 點「標記完工」按鈕
2. `CaseEditModal.vue` 編輯 Modal 把狀態下拉改成「已完工」存檔

兩種情況都去 Firebase Console 確認該案件文件多了 `completedAt` 欄位（Timestamp 型別，值接近當下時間）。測完把狀態改回原本的值（不留測試痕跡在正式資料）。

- [ ] **Step 4: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/stores/cases.js naiship-system/src/components/cases/CaseEditModal.vue
git commit -m "feat(cases): auto-record completedAt when status flips to completed"
```

---

### Task 2: Firestore rules 新增獎金相關 collection

**Files:**
- Modify: `naiship-system/firestore.rules:126-130`

- [ ] **Step 1: 在 `leaveRecords` 規則後面加兩條新規則**

找到 `naiship-system/firestore.rules` 第 127-129 行：

```
    match /leaveRecords/{docId} {
      allow read, write: if isAdmin();
    }
```

改成：

```
    match /leaveRecords/{docId} {
      allow read, write: if isAdmin();
    }
    match /caseBonusData/{caseId} {
      allow read, write: if isAdmin();
    }
    match /bonusQuarters/{quarterId} {
      allow read, write: if isAdmin();
    }
```

- [ ] **Step 2: 部署規則（這個專案的 rules 改動不能只改本機檔案，要另外跑指令才會生效）**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run deploy:rules`
Expected: 輸出顯示 `firestore: released rules ... to cloud.firestore` 成功訊息

- [ ] **Step 3: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/firestore.rules
git commit -m "feat(firestore): add admin-only rules for caseBonusData and bonusQuarters"
```

---

### Task 3: `bonusCalc.js` — 資格判斷、級距、業務比例獎金

**Files:**
- Create: `naiship-system/src/utils/bonusCalc.js`
- Test: `naiship-system/tests/utils/bonusCalc.test.js`

- [ ] **Step 1: 寫失敗的測試（資格判斷 + 級距 + 業務獎金）**

建立 `naiship-system/tests/utils/bonusCalc.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { isEligibleByAmount, calcTier, calcDesignerBonus, calcSalesBonus } from '@/utils/bonusCalc'

describe('isEligibleByAmount', () => {
    it('案件金額剛好 50 萬時不合格（要求「超過」）', () => {
        expect(isEligibleByAmount(500000)).toBe(false)
    })
    it('案件金額超過 50 萬 1 元就合格', () => {
        expect(isEligibleByAmount(500001)).toBe(true)
    })
    it('沒有金額（0/null/undefined）不合格', () => {
        expect(isEligibleByAmount(0)).toBe(false)
        expect(isEligibleByAmount(null)).toBe(false)
        expect(isEligibleByAmount(undefined)).toBe(false)
    })
})

describe('calcTier', () => {
    it('未達門檻回傳 0 級', () => {
        expect(calcTier(500000)).toBe(0)
    })
    it('50~100 萬（含 100 萬整）算第 1 級', () => {
        expect(calcTier(500001)).toBe(1)
        expect(calcTier(1000000)).toBe(1)
    })
    it('超過 100 萬 1 元跳到第 2 級', () => {
        expect(calcTier(1000001)).toBe(2)
    })
    it('剛好 250~300 萬區間算第 5 級', () => {
        expect(calcTier(3000000)).toBe(5)
    })
    it('超過 300 萬依同樣級距繼續遞增（第 6 級）', () => {
        expect(calcTier(3000001)).toBe(6)
    })
    it('大型案件（3012 萬 2570 元）算到第 60 級', () => {
        expect(calcTier(30122570)).toBe(60)
    })
})

describe('calcDesignerBonus', () => {
    it('未達門檻回傳 0', () => {
        expect(calcDesignerBonus(500000)).toBe(0)
    })
    it('第 1 級是 3000 元', () => {
        expect(calcDesignerBonus(1000000)).toBe(3000)
    })
    it('第 4 級（200~250 萬）是 12000 元', () => {
        expect(calcDesignerBonus(2500000)).toBe(12000)
    })
})

describe('calcSalesBonus', () => {
    it('未達 50 萬門檻回傳 0，不管設計/工程約金額多少', () => {
        expect(calcSalesBonus(1000000, 0, 500000)).toBe(0)
    })
    it('設計約金額 x 4% + 工程約金額 x 1.25%，不扣 5% 管銷', () => {
        expect(calcSalesBonus(1000000, 800000, 1800000)).toBe(1000000 * 0.04 + 800000 * 0.0125)
    })
    it('只有設計約金額也能算', () => {
        expect(calcSalesBonus(1000000, 0, 1000000)).toBe(1000000 * 0.04)
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run tests/utils/bonusCalc.test.js`
Expected: FAIL，錯誤訊息是找不到 `src/utils/bonusCalc.js` 模組

- [ ] **Step 3: 實作 `bonusCalc.js`（第一批函式）**

建立 `naiship-system/src/utils/bonusCalc.js`：

```js
export const THRESHOLD_AMOUNT = 500000
export const TIER_STEP = 500000
export const DESIGNER_TIER_BONUS = 3000
export const SITE_MANAGER_TIER_BONUS = 5000
export const MANAGEMENT_FEE_RATE = 0.05
export const MIN_PROFIT_MARGIN = 0.25
export const SALES_DESIGN_RATE = 0.04
export const SALES_CONSTRUCTION_RATE = 0.0125

export function isEligibleByAmount(signedAmount) {
    return (signedAmount || 0) > THRESHOLD_AMOUNT
}

export function calcTier(signedAmount) {
    if (!isEligibleByAmount(signedAmount)) return 0
    return Math.ceil((signedAmount - THRESHOLD_AMOUNT) / TIER_STEP)
}

export function calcDesignerBonus(signedAmount) {
    return calcTier(signedAmount) * DESIGNER_TIER_BONUS
}

export function calcSalesBonus(designContractAmount, constructionContractAmount, signedAmount) {
    if (!isEligibleByAmount(signedAmount)) return 0
    return (designContractAmount || 0) * SALES_DESIGN_RATE + (constructionContractAmount || 0) * SALES_CONSTRUCTION_RATE
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run tests/utils/bonusCalc.test.js`
Expected: PASS，18 個 test 全過

- [ ] **Step 5: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/utils/bonusCalc.js naiship-system/tests/utils/bonusCalc.test.js
git commit -m "feat(bonus): add eligibility, tier, and sales bonus calc functions"
```

---

### Task 4: `bonusCalc.js` — 利潤率、工務獎金、多人分帳

**Files:**
- Modify: `naiship-system/src/utils/bonusCalc.js`
- Modify: `naiship-system/tests/utils/bonusCalc.test.js`

- [ ] **Step 1: 加測試（利潤率 / 工務獎金 / 廠商成本加總 / 分帳）**

在 `tests/utils/bonusCalc.test.js` 檔案最後加：

```js
import { sumVendorCost, calcProfitMargin, calcSiteManagerBonus, splitBonus } from '@/utils/bonusCalc'

describe('sumVendorCost', () => {
    it('加總所有工種的 vendorCostItems', () => {
        const workTypes = [
            { vendorCostItems: [{ amount: 10000 }, { amount: 5000 }] },
            { vendorCostItems: [{ amount: 20000 }] },
        ]
        expect(sumVendorCost(workTypes)).toBe(35000)
    })
    it('沒有工種或空陣列回傳 0', () => {
        expect(sumVendorCost([])).toBe(0)
        expect(sumVendorCost(undefined)).toBe(0)
    })
})

describe('calcProfitMargin', () => {
    it('利潤 = 簽約金額 x 0.95 - 廠商成本 - 雜支，利潤率 = 利潤 / 簽約金額', () => {
        const margin = calcProfitMargin(1000000, 400000, 50000)
        expect(margin).toBeCloseTo((1000000 * 0.95 - 400000 - 50000) / 1000000, 6)
    })
    it('沒有簽約金額回傳 0，避免除以 0', () => {
        expect(calcProfitMargin(0, 100, 100)).toBe(0)
    })
})

describe('calcSiteManagerBonus', () => {
    it('利潤率剛好 25% 仍然發獎金', () => {
        const signedAmount = 1000000
        const profit = signedAmount * 0.25
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(3000)
    })
    it('利潤率低於 25%（24.99%）強制歸零', () => {
        const signedAmount = 1000000
        const profit = signedAmount * 0.2499
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(0)
    })
    it('未達 50 萬門檻直接 0，不看利潤率', () => {
        expect(calcSiteManagerBonus(400000, 0, 0)).toBe(0)
    })
    it('範例案例：簽約 30,122,570、利潤率 47% -> 300,000 元', () => {
        const signedAmount = 30122570
        const profit = signedAmount * 0.47
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(300000)
    })
})

describe('splitBonus', () => {
    it('沒有人負責回傳空物件', () => {
        expect(splitBonus(10000, [], {})).toEqual({})
    })
    it('單人負責拿全額', () => {
        expect(splitBonus(9000, ['u1'], {})).toEqual({ u1: 9000 })
    })
    it('兩人沒填分比時均分', () => {
        expect(splitBonus(10000, ['u1', 'u2'], {})).toEqual({ u1: 5000, u2: 5000 })
    })
    it('三人沒填分比時均分，餘數算給最後一人', () => {
        const result = splitBonus(10000, ['u1', 'u2', 'u3'], {})
        expect(result.u1 + result.u2 + result.u3).toBe(10000)
        expect(result.u1).toBe(3333)
        expect(result.u2).toBe(3333)
        expect(result.u3).toBe(3334)
    })
    it('有填自訂分比時依比例分配', () => {
        expect(splitBonus(10000, ['u1', 'u2'], { u1: 70, u2: 30 })).toEqual({ u1: 7000, u2: 3000 })
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run tests/utils/bonusCalc.test.js`
Expected: FAIL，找不到 `sumVendorCost`／`calcProfitMargin`／`calcSiteManagerBonus`／`splitBonus`

- [ ] **Step 3: 在 `bonusCalc.js` 加上這四個函式**

在 `naiship-system/src/utils/bonusCalc.js` 檔案最後加：

```js
export function sumVendorCost(workTypes) {
    return (workTypes || []).reduce((sum, wt) =>
        sum + (wt.vendorCostItems || []).reduce((s, i) => s + (i.amount || 0), 0), 0)
}

export function calcProfitMargin(signedAmount, vendorCostTotal, miscExpenses) {
    if (!signedAmount) return 0
    const profit = signedAmount * (1 - MANAGEMENT_FEE_RATE) - (vendorCostTotal || 0) - (miscExpenses || 0)
    return profit / signedAmount
}

export function calcSiteManagerBonus(signedAmount, vendorCostTotal, miscExpenses) {
    if (!isEligibleByAmount(signedAmount)) return 0
    const margin = calcProfitMargin(signedAmount, vendorCostTotal, miscExpenses)
    if (margin < MIN_PROFIT_MARGIN) return 0
    return calcTier(signedAmount) * SITE_MANAGER_TIER_BONUS
}

export function splitBonus(totalAmount, personIds, splitMap) {
    const ids = personIds || []
    if (ids.length === 0) return {}
    const hasCustomSplit = !!splitMap && ids.every(id => typeof splitMap[id] === 'number')
    const percents = hasCustomSplit
        ? ids.map(id => splitMap[id])
        : ids.map(() => Math.floor(100 / ids.length))
    if (!hasCustomSplit) {
        const distributed = percents.reduce((s, p) => s + p, 0)
        percents[percents.length - 1] += 100 - distributed
    }
    const result = {}
    ids.forEach((id, i) => {
        result[id] = Math.round(totalAmount * percents[i] / 100)
    })
    return result
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run tests/utils/bonusCalc.test.js`
Expected: PASS，全部 test 過

- [ ] **Step 5: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/utils/bonusCalc.js naiship-system/tests/utils/bonusCalc.test.js
git commit -m "feat(bonus): add profit margin, site manager bonus, and multi-person split"
```

---

### Task 5: `bonusCalc.js` — 季別判斷 + entries 組裝

**Files:**
- Modify: `naiship-system/src/utils/bonusCalc.js`
- Modify: `naiship-system/tests/utils/bonusCalc.test.js`

- [ ] **Step 1: 加測試（季別 key / 季別範圍判斷 / entries 組裝 / 行政 entry）**

在 `tests/utils/bonusCalc.test.js` 檔案最後加：

```js
import { dateToQuarterKey, isCompletedInQuarter, buildCaseBonusEntries, buildAdminEntry } from '@/utils/bonusCalc'

describe('dateToQuarterKey', () => {
    it('4/5/6 月都算 Q2', () => {
        expect(dateToQuarterKey(new Date(2026, 3, 1))).toBe('2026-Q2')
        expect(dateToQuarterKey(new Date(2026, 4, 15))).toBe('2026-Q2')
        expect(dateToQuarterKey(new Date(2026, 5, 30))).toBe('2026-Q2')
    })
    it('1 月算前一年 Q4 的隔壁，也就是當年 Q1', () => {
        expect(dateToQuarterKey(new Date(2026, 0, 1))).toBe('2026-Q1')
    })
    it('12 月算 Q4', () => {
        expect(dateToQuarterKey(new Date(2026, 11, 31))).toBe('2026-Q4')
    })
})

describe('isCompletedInQuarter', () => {
    it('completedAt 是 Firestore Timestamp 型別（有 toDate 方法）也能判斷', () => {
        const fakeTimestamp = { toDate: () => new Date(2026, 4, 10) }
        expect(isCompletedInQuarter(fakeTimestamp, '2026-Q2')).toBe(true)
        expect(isCompletedInQuarter(fakeTimestamp, '2026-Q1')).toBe(false)
    })
    it('沒有 completedAt 一律回傳 false', () => {
        expect(isCompletedInQuarter(null, '2026-Q2')).toBe(false)
        expect(isCompletedInQuarter(undefined, '2026-Q2')).toBe(false)
    })
})

describe('buildCaseBonusEntries', () => {
    const usersById = { u1: { name: '柯其宏' }, u2: { name: '陳柏兆' } }

    it('業務/設計師/工務都沒指定負責人時，entries 是空陣列', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = { designContractAmount: 0, constructionContractAmount: 0, salesPersonIds: [], designerIds: [], siteManagerIds: [], miscExpenses: 0 }
        expect(buildCaseBonusEntries(caseInfo, bonusData, usersById)).toEqual([])
    })

    it('三個角色都有指定負責人時各自產生 entry', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = {
            designContractAmount: 1000000, constructionContractAmount: 0,
            salesPersonIds: ['u1'], designerIds: ['u1'], siteManagerIds: ['u1'],
            miscExpenses: 0,
        }
        const entries = buildCaseBonusEntries(caseInfo, bonusData, usersById)
        expect(entries.map(e => e.role)).toEqual(['sales', 'designer', 'siteManager'])
        expect(entries[0]).toMatchObject({ personId: 'u1', personName: '柯其宏', caseId: 'c1', suggestedAmount: 40000, finalAmount: 40000, paid: false })
        expect(entries[1]).toMatchObject({ suggestedAmount: 3000 })
        expect(entries[2]).toMatchObject({ suggestedAmount: 3000 })
    })

    it('多人負責同一角色時各自成一筆 entry，金額依分帳', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = {
            designContractAmount: 1000000, constructionContractAmount: 0,
            salesPersonIds: ['u1', 'u2'], designerIds: [], siteManagerIds: [],
            salesSplit: {}, miscExpenses: 0,
        }
        const entries = buildCaseBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(2)
        expect(entries[0].suggestedAmount + entries[1].suggestedAmount).toBe(40000)
    })

    it('未達 50 萬門檻時即使有指定負責人也不產生 entry', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 400000, workTypes: [] }
        const bonusData = { designContractAmount: 400000, constructionContractAmount: 0, salesPersonIds: ['u1'], designerIds: ['u1'], siteManagerIds: ['u1'], miscExpenses: 0 }
        expect(buildCaseBonusEntries(caseInfo, bonusData, usersById)).toEqual([])
    })
})

describe('buildAdminEntry', () => {
    it('沒有指定發放對象回傳 null', () => {
        expect(buildAdminEntry({ leadCount: 30, signedCount: 5, leadThresholds: [], signedBonusPerCase: 1000, assignedToUid: '', assignedToName: '' })).toBeNull()
    })
    it('進件量門檻取符合資格中最高一級，加上簽約量獎金', () => {
        const target = {
            leadCount: 45, signedCount: 3,
            leadThresholds: [{ count: 30, amount: 2000 }, { count: 60, amount: 5000 }],
            signedBonusPerCase: 1000, assignedToUid: 'u2', assignedToName: '陳柏兆',
        }
        const entry = buildAdminEntry(target)
        expect(entry).toMatchObject({ role: 'admin', personId: 'u2', personName: '陳柏兆', suggestedAmount: 2000 + 3000, finalAmount: 5000, paid: false })
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run tests/utils/bonusCalc.test.js`
Expected: FAIL，找不到 `dateToQuarterKey`／`isCompletedInQuarter`／`buildCaseBonusEntries`／`buildAdminEntry`

- [ ] **Step 3: 在 `bonusCalc.js` 加上這四個函式**

在 `naiship-system/src/utils/bonusCalc.js` 檔案最後加：

```js
export function dateToQuarterKey(date) {
    if (!date) return null
    const [y, m] = date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).split('-').map(Number)
    const q = Math.floor((m - 1) / 3) + 1
    return `${y}-Q${q}`
}

export function isCompletedInQuarter(completedAt, quarterKey) {
    if (!completedAt) return false
    const date = completedAt.toDate ? completedAt.toDate() : new Date(completedAt)
    return dateToQuarterKey(date) === quarterKey
}

function pushRoleEntries(entries, role, amount, personIds, splitMap, usersById, caseInfo) {
    if (amount <= 0 || !personIds?.length) return
    const split = splitBonus(amount, personIds, splitMap)
    personIds.forEach(uid => entries.push({
        role,
        personId: uid,
        personName: usersById[uid]?.name || '',
        caseId: caseInfo.id,
        caseName: caseInfo.name,
        suggestedAmount: split[uid],
        finalAmount: split[uid],
        paid: false,
    }))
}

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

export function buildAdminEntry(adminTarget) {
    const { leadCount, signedCount, leadThresholds, signedBonusPerCase, assignedToUid, assignedToName } = adminTarget
    if (!assignedToUid) return null
    const leadBonus = (leadThresholds || [])
        .filter(t => (leadCount || 0) >= t.count)
        .reduce((max, t) => Math.max(max, t.amount), 0)
    const signedBonus = (signedCount || 0) * (signedBonusPerCase || 0)
    const suggestedAmount = leadBonus + signedBonus
    return {
        role: 'admin',
        personId: assignedToUid,
        personName: assignedToName || '',
        suggestedAmount,
        finalAmount: suggestedAmount,
        paid: false,
    }
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run tests/utils/bonusCalc.test.js`
Expected: PASS，全部 test 過

- [ ] **Step 5: 跑整個專案的既有測試，確認沒有改壞其他東西**

Run: `cd "C:\AI助理 Claude\naiship-system" && npx vitest run`
Expected: 所有既有測試 + 這次新增的 bonusCalc 測試全部 PASS

- [ ] **Step 6: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/utils/bonusCalc.js naiship-system/tests/utils/bonusCalc.test.js
git commit -m "feat(bonus): add quarter helpers and entries builder for bonus calc"
```

---

### Task 6: `caseBonusData` store

**Files:**
- Create: `naiship-system/src/stores/caseBonusData.js`

- [ ] **Step 1: 建立 store**

建立 `naiship-system/src/stores/caseBonusData.js`：

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

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

export const useCaseBonusDataStore = defineStore('caseBonusData', () => {
    const cache = ref({})

    async function fetchData(caseId) {
        if (cache.value[caseId]) return cache.value[caseId]
        const snap = await getDoc(doc(db, 'caseBonusData', caseId))
        const data = snap.exists() ? { ...defaultCaseBonusData(), ...snap.data() } : defaultCaseBonusData()
        cache.value[caseId] = data
        return data
    }

    async function saveData(caseId, data) {
        const authStore = useAuthStore()
        await setDoc(doc(db, 'caseBonusData', caseId), {
            ...data,
            updatedAt: serverTimestamp(),
            updatedBy: authStore.name ?? '',
        }, { merge: true })
        cache.value[caseId] = { ...cache.value[caseId], ...data }
    }

    function cleanup() {
        cache.value = {}
    }

    return { cache, fetchData, saveData, cleanup }
})
```

- [ ] **Step 2: 確認 build 過（純新增檔案，沒有既有測試需要跑，這個 store 的行為會在 Task 9 接上 UI 後端到端驗證）**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

- [ ] **Step 3: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/stores/caseBonusData.js
git commit -m "feat(bonus): add caseBonusData store"
```

---

### Task 7: `bonusQuarters` store

**Files:**
- Create: `naiship-system/src/stores/bonusQuarters.js`

- [ ] **Step 1: 建立 store**

建立 `naiship-system/src/stores/bonusQuarters.js`：

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

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

export const useBonusQuartersStore = defineStore('bonusQuarters', () => {
    const current = ref(null)

    async function fetchQuarter(quarterKey) {
        const snap = await getDoc(doc(db, 'bonusQuarters', quarterKey))
        current.value = snap.exists() ? { ...defaultQuarterData(), ...snap.data() } : defaultQuarterData()
        return current.value
    }

    async function saveQuarter(quarterKey, data) {
        const authStore = useAuthStore()
        const patch = { ...data, lastCalculatedAt: serverTimestamp(), lastCalculatedBy: authStore.name ?? '' }
        await setDoc(doc(db, 'bonusQuarters', quarterKey), patch, { merge: true })
        current.value = { ...current.value, ...data }
    }

    async function markEntryPaid(quarterKey, entryIndex, paid) {
        const authStore = useAuthStore()
        const docRef = doc(db, 'bonusQuarters', quarterKey)
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef)
            const data = snap.data() ?? defaultQuarterData()
            const entries = [...(data.entries || [])]
            if (!entries[entryIndex]) throw new Error('entry not found')
            entries[entryIndex] = {
                ...entries[entryIndex],
                paid,
                paidAt: paid ? serverTimestamp() : null,
                paidBy: paid ? (authStore.name ?? '') : '',
            }
            tx.set(docRef, { ...data, entries }, { merge: true })
        })
        if (current.value) {
            const entries = [...current.value.entries]
            entries[entryIndex] = { ...entries[entryIndex], paid, paidBy: paid ? (authStore.name ?? '') : '' }
            current.value = { ...current.value, entries }
        }
    }

    function cleanup() {
        current.value = null
    }

    return { current, fetchQuarter, saveQuarter, markEntryPaid, cleanup }
})
```

用 `runTransaction` 包住「讀最新 entries → 改單一筆 → 寫回」，避免柏自己開兩個分頁同時標記不同筆已發放時互相覆蓋整個 `entries` 陣列。

- [ ] **Step 2: 確認 build 過**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

- [ ] **Step 3: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/stores/bonusQuarters.js
git commit -m "feat(bonus): add bonusQuarters store with transactional paid-marking"
```

---

### Task 8: 路由 + 導覽列

**Files:**
- Modify: `naiship-system/src/router/index.js:14-17`
- Modify: `naiship-system/src/components/layout/NavBar.vue:46-53`

- [ ] **Step 1: 新增路由**

`naiship-system/src/router/index.js` 第 14-17 行後面（`/payslip` 路由後面）加：

```js
  {
    path: '/bonus', name: 'bonus', component: () => import('@/views/BonusView.vue'),
    meta: { requireAdmin: true }
  }
```

- [ ] **Step 2: 導覽列加連結**

`naiship-system/src/components/layout/NavBar.vue` 第 52 行：

```js
  ...(auth.isAdmin ? [{ to: '/payslip', label: '薪資單' }, { to: '/settings', label: '系統設定' }] : [])
```

改成：

```js
  ...(auth.isAdmin ? [{ to: '/payslip', label: '薪資單' }, { to: '/bonus', label: '獎金統計' }, { to: '/settings', label: '系統設定' }] : [])
```

（`BonusView.vue` 還沒建立，這一步會讓 nav 連到一個還不存在的元件，屬於暫時性的建置錯誤，Task 9 建立該檔案後就會恢復正常——如果中途要跑 build 驗證，先跳過這個 task 的 build 驗證，等 Task 9 一起驗證即可）

- [ ] **Step 3: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/router/index.js naiship-system/src/components/layout/NavBar.vue
git commit -m "feat(bonus): add /bonus route and nav link (admin only)"
```

---

### Task 9: `BonusView.vue` — 頁面骨架 + 完工案件清單

**Files:**
- Create: `naiship-system/src/views/BonusView.vue`

- [ ] **Step 1: 建立頁面骨架**

建立 `naiship-system/src/views/BonusView.vue`：

```vue
<template>
  <main class="flex-1 overflow-y-auto px-4 py-6 max-w-5xl mx-auto w-full">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-bold text-gray-800">季度獎金統計</h1>
      <select v-model="selectedQuarter" class="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
        <option v-for="q in quarterOptions" :key="q" :value="q">{{ q }}</option>
      </select>
    </div>

    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <h2 class="text-sm font-bold text-gray-700 mb-3">本季完工案件（業務／設計師／工務）</h2>
      <div v-if="eligibleCases.length === 0" class="text-sm text-gray-400 py-4 text-center">這一季沒有完工案件</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-400 text-xs border-b border-gray-100">
            <th class="py-2 font-medium">案件</th>
            <th class="font-medium">簽約金額</th>
            <th class="font-medium">資格</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in eligibleCases" :key="c.id" class="border-b border-gray-50">
            <td class="py-2">{{ c.name }}</td>
            <td>{{ (c.signedAmount || 0).toLocaleString() }}</td>
            <td>
              <span v-if="isEligibleByAmount(c.signedAmount)" class="text-green-600">符合</span>
              <span v-else class="text-gray-400">未達 50 萬</span>
            </td>
            <td class="text-right">
              <button @click="editingCaseId = c.id" class="text-xs text-blue-600 hover:underline">編輯獎金資料</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <CaseBonusForm v-if="editingCaseId" :case-id="editingCaseId"
      :case-info="eligibleCases.find(c => c.id === editingCaseId)"
      @close="editingCaseId = null" />
  </main>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { isEligibleByAmount, dateToQuarterKey, isCompletedInQuarter } from '@/utils/bonusCalc'
import CaseBonusForm from '@/components/bonus/CaseBonusForm.vue'

const casesStore = useCasesStore()

onMounted(() => {
    casesStore.subscribe(['north', 'central', 'south'])
})

const quarterOptions = computed(() => {
    const current = dateToQuarterKey(new Date())
    const [y, qStr] = current.split('-Q')
    const year = Number(y)
    const q = Number(qStr)
    const options = []
    for (let i = 0; i < 8; i++) {
        const totalQ = year * 4 + (q - 1) - i
        const oy = Math.floor(totalQ / 4)
        const oq = (totalQ % 4) + 1
        options.push(`${oy}-Q${oq}`)
    }
    return options
})

const selectedQuarter = ref(dateToQuarterKey(new Date()))

const eligibleCases = computed(() =>
    casesStore.cases.filter(c => isCompletedInQuarter(c.completedAt, selectedQuarter.value))
)

const editingCaseId = ref(null)
</script>
```

- [ ] **Step 2: 建立一個先什麼都不做的 `CaseBonusForm.vue` 佔位元件，讓這個檔案先能 build 過**

建立 `naiship-system/src/components/bonus/CaseBonusForm.vue`：

```vue
<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-gray-800">{{ caseInfo?.name }}｜獎金資料</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <p class="text-sm text-gray-400">（Task 10 補完整表單內容）</p>
    </div>
  </div>
</template>
<script setup>
defineProps({ caseId: String, caseInfo: Object })
defineEmits(['close'])
</script>
```

- [ ] **Step 3: Build 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

- [ ] **Step 4: 瀏覽器手動驗證頁面骨架**

用 admin 帳號登入，導覽列點「獎金統計」，確認：
- 頁面正常顯示，季度下拉有選項（含當季）
- 選一個有已知測試完工案件的季度，案件清單正確顯示（金額 > 50 萬顯示綠色「符合」，否則灰色「未達 50 萬」）
- 點「編輯獎金資料」跳出目前的佔位 Modal，點 ✕ 能關閉

- [ ] **Step 5: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/views/BonusView.vue naiship-system/src/components/bonus/CaseBonusForm.vue
git commit -m "feat(bonus): add BonusView page skeleton with eligible-case list"
```

---

### Task 10: `CaseBonusForm.vue` — 完整表單內容

**Files:**
- Modify: `naiship-system/src/components/bonus/CaseBonusForm.vue`

- [ ] **Step 1: 補完整表單（金額欄位／三角色負責人複選＋分帳／工務雜支／質化條件勾選／即時試算顯示／備註）**

把 `naiship-system/src/components/bonus/CaseBonusForm.vue` 整份改成：

```vue
<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-gray-800">{{ caseInfo?.name }}｜獎金資料</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <div v-if="loading" class="text-sm text-gray-400 py-4 text-center">載入中…</div>

      <div v-else class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">設計約金額</label>
            <input v-model.number="form.designContractAmount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">工程約金額</label>
            <input v-model.number="form.constructionContractAmount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>

        <RoleAssigneePicker label="業務負責人" v-model="form.salesPersonIds" v-model:split="form.salesSplit" />
        <div class="text-xs text-gray-500">業務建議獎金：{{ salesAmount.toLocaleString() }} 元</div>

        <RoleAssigneePicker label="設計師負責人" v-model="form.designerIds" v-model:split="form.designerSplit" />
        <div class="text-xs text-gray-500">設計師建議獎金：{{ designerAmount.toLocaleString() }} 元</div>

        <RoleAssigneePicker label="工務負責人" v-model="form.siteManagerIds" v-model:split="form.siteManagerSplit" />
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工務雜支</label>
          <input v-model.number="form.miscExpenses" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div class="text-xs" :class="profitMargin < 0.25 ? 'text-red-600' : 'text-gray-500'">
          利潤率：{{ (profitMargin * 100).toFixed(1) }}%
          <span v-if="profitMargin < 0.25">（未達 25%，工務獎金強制為 0）</span>
        </div>
        <div class="text-xs text-gray-500">工務建議獎金：{{ siteManagerAmount.toLocaleString() }} 元</div>

        <div v-for="role in ['sales', 'designer', 'siteManager']" :key="role">
          <div class="text-xs text-gray-500 mb-1">{{ roleLabel(role) }}條件</div>
          <div class="flex flex-wrap gap-3">
            <label v-for="key in Object.keys(form.qualitativeChecks[role])" :key="key" class="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" v-model="form.qualitativeChecks[role][key]" class="rounded">
              {{ key }}
            </label>
          </div>
        </div>

        <div>
          <label class="text-xs text-gray-500 mb-1 block">備註</label>
          <textarea v-model="form.notes" rows="2" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"></textarea>
        </div>

        <button @click="save" :disabled="saving" class="text-sm text-white px-4 py-2 rounded-lg" style="background:#1e2533">
          {{ saving ? '儲存中…' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useCaseBonusDataStore, defaultCaseBonusData } from '@/stores/caseBonusData'
import { useToast } from '@/composables/useToast'
import {
    calcSalesBonus, calcDesignerBonus, calcSiteManagerBonus,
    calcProfitMargin, sumVendorCost,
} from '@/utils/bonusCalc'
import RoleAssigneePicker from './RoleAssigneePicker.vue'

const props = defineProps({ caseId: String, caseInfo: Object })
const emit = defineEmits(['close'])

const store = useCaseBonusDataStore()
const { toast } = useToast()
const loading = ref(true)
const saving = ref(false)
const form = reactive(defaultCaseBonusData())

onMounted(async () => {
    const data = await store.fetchData(props.caseId)
    Object.assign(form, data)
    loading.value = false
})

const vendorCostTotal = computed(() => sumVendorCost(props.caseInfo?.workTypes))

const salesAmount = computed(() =>
    calcSalesBonus(form.designContractAmount, form.constructionContractAmount, props.caseInfo?.signedAmount))
const designerAmount = computed(() => calcDesignerBonus(props.caseInfo?.signedAmount))
const profitMargin = computed(() =>
    calcProfitMargin(props.caseInfo?.signedAmount, vendorCostTotal.value, form.miscExpenses))
const siteManagerAmount = computed(() =>
    calcSiteManagerBonus(props.caseInfo?.signedAmount, vendorCostTotal.value, form.miscExpenses))

function roleLabel(role) {
    return { sales: '業務', designer: '設計師', siteManager: '工務' }[role]
}

async function save() {
    saving.value = true
    try {
        await store.saveData(props.caseId, { ...form })
        toast('已儲存')
        emit('close')
    } finally {
        saving.value = false
    }
}
</script>
```

- [ ] **Step 2: 建立 `RoleAssigneePicker.vue`（角色複選 + 分帳輸入，三個角色共用同一個元件）**

建立 `naiship-system/src/components/bonus/RoleAssigneePicker.vue`：

```vue
<template>
  <div>
    <label class="text-xs text-gray-500 mb-1 block">{{ label }}</label>
    <div class="flex flex-wrap gap-2 mb-2">
      <label v-for="u in usersStore.users" :key="u.id" class="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-full px-2 py-1">
        <input type="checkbox" :checked="modelValue.includes(u.id)" @change="toggle(u.id)" class="rounded">
        {{ u.name }}
      </label>
    </div>
    <div v-if="modelValue.length > 1" class="flex flex-wrap gap-2">
      <div v-for="uid in modelValue" :key="uid" class="flex items-center gap-1 text-xs text-gray-500">
        {{ userName(uid) }}
        <input type="number" min="0" max="100" :value="split[uid] ?? defaultPercent"
          @input="setSplit(uid, $event.target.value)"
          class="w-14 border border-gray-200 rounded px-1 py-0.5 text-xs">%
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { useUsersStore } from '@/stores/users'

const props = defineProps({
    label: String,
    modelValue: { type: Array, default: () => [] },
    split: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'update:split'])

const usersStore = useUsersStore()
const defaultPercent = computed(() => props.modelValue.length ? Math.floor(100 / props.modelValue.length) : 0)

function userName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? uid
}

function toggle(uid) {
    const next = props.modelValue.includes(uid)
        ? props.modelValue.filter(id => id !== uid)
        : [...props.modelValue, uid]
    emit('update:modelValue', next)
}

function setSplit(uid, value) {
    emit('update:split', { ...props.split, [uid]: Number(value) || 0 })
}
</script>
```

- [ ] **Step 3: Build 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

- [ ] **Step 4: 瀏覽器手動驗證（真實 Firestore，用測試案件）**

找一個測試案件（或臨時建一個，測完刪除），走一遍：
1. 打開獎金統計頁 → 選到該案件所在季度 → 點「編輯獎金資料」
2. 填設計約/工程約金額，確認「業務建議獎金」即時算出 4%/1.25% 加總
3. 勾選「設計師負責人」單人，確認「設計師建議獎金」依級距算對
4. 勾選「工務負責人」+ 填雜支，確認利潤率跟工務建議獎金即時更新；故意把雜支填很高讓利潤率低於 25%，確認顯示紅字且工務建議獎金變 0
5. 勾兩個人當「業務負責人」，確認出現分帳百分比輸入框，改分比後總和不是 100 的情況先不用特別擋（這次沒設計阻擋邏輯，畫面上金額分配依填的百分比計算）
6. 勾幾個質化條件、填備註 → 按「儲存」→ 關閉 Modal 重新打開，確認資料都保留（含勾選狀態）
7. 去 Firebase Console 確認 `caseBonusData/{caseId}` 文件內容正確、`cases/{caseId}` 本體完全沒被動到
8. 測完把這份 `caseBonusData` 測試文件刪除乾淨

- [ ] **Step 5: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/components/bonus/CaseBonusForm.vue naiship-system/src/components/bonus/RoleAssigneePicker.vue
git commit -m "feat(bonus): implement case bonus data form with live calc preview"
```

---

### Task 11: 行政獎金 + 團隊獎金 + 已發放彙總表

**Files:**
- Modify: `naiship-system/src/views/BonusView.vue`

- [ ] **Step 1: 在 `BonusView.vue` 加行政／團隊獎金區塊與彙總表**

在 `naiship-system/src/views/BonusView.vue` 的 `<template>` 裡，`<CaseBonusForm ... />` 那一行後面加：

```vue
    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <h2 class="text-sm font-bold text-gray-700 mb-3">行政獎金</h2>
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">本季進件量</label>
          <input v-model.number="quarterForm.adminTarget.leadCount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">本季簽約量</label>
          <input v-model.number="quarterForm.adminTarget.signedCount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
      </div>
      <div class="mb-3">
        <label class="text-xs text-gray-500 mb-1 block">進件量門檻（達標金額，可新增多級）</label>
        <div v-for="(t, i) in quarterForm.adminTarget.leadThresholds" :key="i" class="flex gap-2 mb-1">
          <input v-model.number="t.count" type="number" min="0" placeholder="件數" class="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1">
          <input v-model.number="t.amount" type="number" min="0" placeholder="金額" class="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1">
          <button @click="quarterForm.adminTarget.leadThresholds.splice(i, 1)" class="text-xs text-red-500">刪除</button>
        </div>
        <button @click="quarterForm.adminTarget.leadThresholds.push({ count: 0, amount: 0 })" class="text-xs text-blue-600">+ 新增門檻</button>
      </div>
      <div class="mb-3">
        <label class="text-xs text-gray-500 mb-1 block">每成交一件獎金</label>
        <input v-model.number="quarterForm.adminTarget.signedBonusPerCase" type="number" min="0" class="w-40 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>
      <div>
        <label class="text-xs text-gray-500 mb-1 block">發放對象</label>
        <select v-model="quarterForm.adminTarget.assignedToUid" @change="onAdminAssigneeChange" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
          <option value="">— 選擇 —</option>
          <option v-for="u in usersStore.users" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
      </div>
      <div class="text-xs text-gray-500 mt-2">行政建議獎金：{{ adminEntry ? adminEntry.suggestedAmount.toLocaleString() : 0 }} 元</div>
    </section>

    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <h2 class="text-sm font-bold text-gray-700 mb-3">團隊獎金（手動輸入）</h2>
      <div class="grid grid-cols-4 gap-3">
        <div v-for="role in ['sales', 'designer', 'siteManager', 'admin']" :key="role">
          <label class="text-xs text-gray-500 mb-1 block">{{ roleLabel(role) }}</label>
          <input v-model.number="quarterForm.teamBonus[role]" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
      </div>
    </section>

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
      <div v-if="allEntries.length === 0" class="text-sm text-gray-400 py-4 text-center">目前沒有可發放的項目</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-400 text-xs border-b border-gray-100">
            <th class="py-2 font-medium">角色</th>
            <th class="font-medium">對象</th>
            <th class="font-medium">案件</th>
            <th class="font-medium">建議金額</th>
            <th class="font-medium">實發金額</th>
            <th class="font-medium">已發放</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in allEntries" :key="i" class="border-b border-gray-50">
            <td class="py-2">{{ roleLabel(e.role) }}</td>
            <td>{{ e.personName }}</td>
            <td>{{ e.caseName || '—' }}</td>
            <td>{{ e.suggestedAmount.toLocaleString() }}</td>
            <td>
              <input v-model.number="e.finalAmount" :disabled="e.paid" type="number" min="0" class="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 disabled:bg-gray-50 disabled:text-gray-400">
            </td>
            <td>
              <input type="checkbox" :checked="e.paid" @change="togglePaid(i, $event.target.checked)" class="rounded">
            </td>
          </tr>
        </tbody>
      </table>
    </section>
```

- [ ] **Step 2: 補 `<script setup>` 邏輯**

在 `naiship-system/src/views/BonusView.vue` 的 `<script setup>` 裡，把 import 區改成：

```js
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { useUsersStore } from '@/stores/users'
import { useCaseBonusDataStore } from '@/stores/caseBonusData'
import { useBonusQuartersStore, defaultQuarterData } from '@/stores/bonusQuarters'
import { useToast } from '@/composables/useToast'
import {
    isEligibleByAmount, dateToQuarterKey, isCompletedInQuarter,
    buildCaseBonusEntries, buildAdminEntry,
} from '@/utils/bonusCalc'
import CaseBonusForm from '@/components/bonus/CaseBonusForm.vue'

const casesStore = useCasesStore()
const usersStore = useUsersStore()
const caseBonusDataStore = useCaseBonusDataStore()
const bonusQuartersStore = useBonusQuartersStore()
const { toast } = useToast()

onMounted(() => {
    casesStore.subscribe(['north', 'central', 'south'])
})
```

在檔案最後（`const editingCaseId = ref(null)` 之後）加：

```js
const quarterForm = reactive(defaultQuarterData())
const caseEntries = ref([])
const savingQuarter = ref(false)

// 切季度：先把 Firestore 存的資料（含之前已標記的發放狀態）原樣載入 caseEntries，
// 再用 recalculate() 重新試算「未發放」的項目金額。分兩步是刻意的——
// 不能直接把 recalculate() 的結果當初始值，否則案件的 caseBonusData 還沒
// fetch 完成前 caseEntries 會暫時是空陣列，如果這時候使用者手滑點了旁邊
// 其他欄位觸發存檔，會把 Firestore 裡本來有的已發放紀錄整批洗掉。
async function loadQuarter(q) {
    const data = await bonusQuartersStore.fetchQuarter(q)
    quarterForm.adminTarget = data.adminTarget
    quarterForm.teamBonus = data.teamBonus
    caseEntries.value = data.entries || []
    await recalculate()
}

watch(selectedQuarter, loadQuarter, { immediate: true })

function onAdminAssigneeChange() {
    const u = usersStore.users.find(u => u.id === quarterForm.adminTarget.assignedToUid)
    quarterForm.adminTarget.assignedToName = u?.name ?? ''
}

const adminEntry = computed(() => buildAdminEntry(quarterForm.adminTarget))

function roleLabel(role) {
    return { sales: '業務', designer: '設計師', siteManager: '工務', admin: '行政' }[role]
}

// 只更新記憶體內的 caseEntries，不寫 Firestore——存檔動作完全交給
// 「儲存本季資料」按鈕（saveQuarterData），避免自動存檔在資料還沒載入
// 完成的空檔覆蓋掉已經存在雲端的資料。
async function recalculate() {
    const usersById = Object.fromEntries(usersStore.users.map(u => [u.id, u]))
    const results = []
    for (const c of eligibleCases.value) {
        const bonusData = await caseBonusDataStore.fetchData(c.id)
        results.push(...buildCaseBonusEntries(c, bonusData, usersById))
    }
    const admin = buildAdminEntry(quarterForm.adminTarget)
    if (admin) results.push(admin)
    // 已發放的項目維持鎖定金額，不被新試算覆蓋
    const existingPaid = caseEntries.value.filter(e => e.paid)
    caseEntries.value = [
        ...existingPaid,
        ...results.filter(r => !existingPaid.some(p => p.role === r.role && p.personId === r.personId && p.caseId === r.caseId)),
    ]
}

watch(eligibleCases, recalculate)

const allEntries = computed(() => caseEntries.value)

async function togglePaid(index, paid) {
    await bonusQuartersStore.markEntryPaid(selectedQuarter.value, index, paid)
    caseEntries.value[index] = { ...caseEntries.value[index], paid }
    toast(paid ? '已標記發放' : '已取消發放標記')
}

async function saveQuarterData() {
    savingQuarter.value = true
    try {
        await bonusQuartersStore.saveQuarter(selectedQuarter.value, {
            adminTarget: quarterForm.adminTarget,
            teamBonus: quarterForm.teamBonus,
            entries: caseEntries.value,
        })
        toast('已儲存本季資料')
    } finally {
        savingQuarter.value = false
    }
}
```

- [ ] **Step 3: Build 驗證**

Run: `cd "C:\AI助理 Claude\naiship-system" && npm run build`
Expected: build 成功無錯誤

- [ ] **Step 4: 瀏覽器手動驗證（真實 Firestore）**

延續 Task 10 的測試案件（金額 > 50 萬、已填業務/設計師/工務負責人）：
1. 打開獎金統計頁選到對應季度，確認「本季發放彙總」表格出現剛剛填的案件對應的業務/設計師/工務三筆
2. 填行政區塊（進件量、門檻、發放對象）、團隊獎金任一數字，點「儲存本季資料」，重新整理頁面後確認這些欄位都還在（目前團隊獎金沒有出現在彙總表，這是預期行為——spec 定義團隊獎金是獨立手動欄位，不併入 entries 清單）；確認彙總表多一筆「行政」列，金額算對
3. 把某一筆「實發金額」改成跟建議金額不同的數字，勾選「已發放」（這一步會立刻寫入 Firestore，不用等按「儲存本季資料」），確認：
   - Firebase Console 上 `bonusQuarters/{quarter}` 文件該筆 entry 的 `paid:true`、`paidAt`、`paidBy` 有正確寫入
   - 該筆金額輸入框變成 disabled 不能再改
   - 點「重新試算」後，這筆已發放的項目金額跟實發金額都沒有被蓋掉（其他未發放項目正常重新計算）
4. 取消勾選「已發放」，確認金額輸入框恢復可編輯
5. 切到別的季度再切回來，確認剛剛的已發放標記、行政/團隊獎金欄位都正確從 Firestore 還原（驗證 `loadQuarter` 沒有意外把資料清空）
6. 測完把 `bonusQuarters/{quarter}` 這份測試文件、`caseBonusData` 測試文件都刪除乾淨

- [ ] **Step 5: Commit**

```bash
cd "C:\AI助理 Claude"
git add naiship-system/src/views/BonusView.vue
git commit -m "feat(bonus): add admin/team bonus sections and quarterly payout summary"
```

---

## 執行後檢查清單（對照 spec「測試」章節）

- [ ] 完工日期落在指定季度區間內外的案件正確納入/排除（Task 9 Step 4、Task 5 單元測試已覆蓋）
- [ ] 業務金額拆兩筆計算正確（Task 3 單元測試 + Task 10 手動驗證）
- [ ] 工務利潤率低於 25% 強制歸零（Task 4 單元測試 + Task 10 手動驗證）
- [ ] 多人負責角色分帳總和等於建議金額（Task 4／Task 5 單元測試）
- [ ] 已發放鎖定後 finalAmount 無法再改（Task 11 手動驗證）
- [ ] `npx vitest run` 全專案測試通過（Task 5 Step 5 已執行一次，建議整個 plan 跑完後再跑一次確認沒有迴歸）
