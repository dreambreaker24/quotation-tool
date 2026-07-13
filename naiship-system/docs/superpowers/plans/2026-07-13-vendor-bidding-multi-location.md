# 廠商比價功能 + 工種選單簡化 + 同工種多施作位置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 案件詳情頁「工程安排」tab 前面新增「廠商比價」tab，讓多家廠商各自上傳報價單／預估金額，管理層確認贏家後自動生成正式工種；同時移除工種選單的「自訂」輸入，並讓同一筆工種可以記錄多個施作位置各自的進場／退場日期。

**Architecture:** 比價資料存在新的 `cases/{caseId}/bidRequests/{bidId}` 子集合，透過新 store `bidRequests.js`（仿照現有 `caseTasks.js` 的子集合訂閱模式）管理，跟正式的 `cases/{caseId}.workTypes` 陣列完全分離，直到管理層按下「確認贏家」才由一個純函式 `buildWinningWorkType()` 產生新的正式工種物件並附加進 `workTypes` 陣列——這個轉換函式不碰 Firestore，方便單元測試。工種選單移除自訂選項，改成純下拉；`workType` 物件新增 `locations[]` 陣列記錄多施作位置，UI 模式比照既有的 `vendorCostItems` 動態列。

**Tech Stack:** Vue 3 + Pinia + Firebase Firestore、Vitest

**執行位置：** 以下所有指令都在 `naiship-system/` 目錄下執行，所有檔案路徑都相對於這個目錄。

**對應 spec：** `docs/superpowers/specs/2026-07-13--vendor-bidding-multi-location.md`

---

## 背景知識

- 工種資料存在 `cases/{caseId}.workTypes` 陣列欄位（不是子集合），每筆物件的完整結構定義在 `src/components/cases/WorkTypePanel.vue` 的 `submitForm()`（第 1025-1062 行）。
- 工種選單目前的選項來自寫死常數 `WORK_CATEGORIES`（`src/constants/workCategories.js`），選單有 `__custom__` sentinel 值代表「自訂」，選了會多顯示一個文字輸入框（`WorkTypePanel.vue:266-269`）。這個 sentinel 值在檔案裡總共出現在 6 個地方（選單選項、輸入框顯示條件、廠商提示文字、`onCategoryChange`、`regionVendors`、`openEdit` 回填邏輯），移除時要全部一起改。
- 廠商資料來自 Firestore `vendors` collection（透過 `useVendorsStore`），沒有自訂選項，只能從已建檔資料選——這個部分不用改。
- 報價單／施工照片存在 `cases/{caseId}/photos` 子集合，用 `type` 欄位區分用途（`vendor_quote`、`wt_construction`），用 `workTypeId` 欄位反向關聯到 `workTypes[]` 裡的某一筆。這個 plan 會新增第三種 `type: 'bid_quote'`，用 `bidRequestId` + `bidEntryId` 關聯到比價需求裡的某一筆報價。
- 上傳檔案共用邏輯在 `src/composables/useStorage.js`：`uploadPhoto(file, type)` 上傳、`validateUploadFile(file)` 驗證（單檔限制 10MB）。檔案格式限制統一用 `accept="image/jpeg,image/jpg,image/png,image/webp,.pdf"`。
- **Firestore 陣列欄位裡不能塞 `serverTimestamp()`**（Firestore 已知限制，sentinel 值無法解析進陣列元素）。這個專案既有的陣列欄位（`vendorCostItems`、`vendorPayments`）都刻意避開這個問題，沒有在陣列元素裡存 timestamp。新的 `bids[]` 陣列一樣要避開，改用 `new Date().toISOString()` 存純字串。子集合文件本身的頂層欄位（例如 `bidRequests/{bidId}.createdAt`）不在陣列裡，可以正常用 `serverTimestamp()`。
- 權限model：這個專案的角色限制都是前端 UI 層擋（`authStore.isAdmin` / `authStore.isManager`），沒有針對個別操作寫細粒度的 Firestore rules。`firestore.rules` 裡 `cases/{caseId}` 底下有一條萬用規則 `match /{subcollection}/{docId} { allow read, write: if isSignedIn() }`（`firestore.rules:29-32`），已經涵蓋新的 `bidRequests` 子集合，**不需要修改 `firestore.rules`**。「確認贏家」按鈕只需要在 `BidRequestPanel.vue` 用 `v-if="authStore.isManager"` 擋，跟其餘專案的作法一致（`authStore.isManager` 定義已包含 admin，見 `src/stores/auth.js:15`）。
- 這個專案目前沒有 `WorkTypePanel.vue` 的完整元件測試（`@vue/test-utils` 有裝、也有用在別的元件，但這裡刻意不做），純邏輯改抽成獨立函式測試——延續 `src/utils/leaveConversion.js`（`hoursToDays`）的既有模式：能抽成不碰 Firestore、不碰 Vue 響應式系統的純函式就抽出來寫 Vitest，UI 互動本身用手動驗收。這個 plan 裡 `buildWinningWorkType`、`bidRequests` store CRUD、工種選單的舊資料判斷邏輯（`isLegacyCategoryName`）都照這個模式處理。
- `firebase-admin` 已安裝在 `devDependencies`，`scripts/` 目錄有既有的一次性資料腳本範例（`scripts/list-users.mjs`），用 `firebase-admin-key.json`（本機憑證檔，未進版控）連線。

---

## Task 1：抽出 WT_COLORS 共用常數

**Files:**
- Create: `src/constants/workTypeColors.js`
- Modify: `src/components/cases/WorkTypePanel.vue:527-538`（import 區塊）、`WorkTypePanel.vue:765`（移除本地常數）

- [ ] **Step 1: 建立共用常數檔**

建立 `src/constants/workTypeColors.js`：

```js
export const WT_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316']
```

- [ ] **Step 2: `WorkTypePanel.vue` 改用共用常數**

在 `src/components/cases/WorkTypePanel.vue` 的 import 區塊（第 527-537 行）：

```js
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { useVendorsStore } from '@/stores/vendors'
```

改成：

```js
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { WT_COLORS } from '@/constants/workTypeColors'
import { useVendorsStore } from '@/stores/vendors'
```

刪掉第 765 行的本地定義：

```js
const WT_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316']
```

- [ ] **Step 3: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 4: Commit**

```bash
git add src/constants/workTypeColors.js src/components/cases/WorkTypePanel.vue
git commit -m "refactor(worktype): extract WT_COLORS into shared constant"
```

---

## Task 2：`workType` 新增 locations[] 多施作位置

**Files:**
- Modify: `src/components/cases/WorkTypePanel.vue`

- [ ] **Step 1: `form` 預設值加上 `locations`**

第 572-577 行：

```js
const form = ref({
    name: '', vendorId: '', startDate: '', endDate: '',
    hasQuote: false, hasSchedule: false,
    vendorCostItems: [], vendorCostFree: false,
    costIncludesTax: false,
})
```

改成：

```js
const form = ref({
    name: '', vendorId: '', startDate: '', endDate: '',
    hasQuote: false, hasSchedule: false,
    vendorCostItems: [], vendorCostFree: false,
    costIncludesTax: false, locations: [],
})
```

- [ ] **Step 2: 新增 `addLocation`/`removeLocation` 函式**

在第 783-788 行 `addVendorCostItem`/`removeVendorCostItem` 之後加入：

```js
function addLocation() {
    form.value.locations.push({ id: `loc_${Date.now()}`, label: '', startDate: '', endDate: '', note: '' })
}
function removeLocation(i) {
    form.value.locations.splice(i, 1)
}
```

- [ ] **Step 3: `openAdd()` 重置表單加上 `locations`**

第 987-998 行：

```js
function openAdd() {
    editingIdx.value = null
    selectedCategory.value = ''
    vendorSearch.value = ''
    form.value = {
        name: '', vendorId: '', startDate: '', endDate: '',
        hasQuote: false, hasSchedule: false,
        vendorCostItems: [], vendorCostFree: false,
        costIncludesTax: false,
    }
    showForm.value = true
}
```

改成：

```js
function openAdd() {
    editingIdx.value = null
    selectedCategory.value = ''
    vendorSearch.value = ''
    form.value = {
        name: '', vendorId: '', startDate: '', endDate: '',
        hasQuote: false, hasSchedule: false,
        vendorCostItems: [], vendorCostFree: false,
        costIncludesTax: false, locations: [],
    }
    showForm.value = true
}
```

- [ ] **Step 4: `openEdit()` 回填 `locations`**

第 1000-1017 行的 `form.value = {...}` 區塊：

```js
    form.value = {
        name: wt.name,
        vendorId: wt.vendorId || '',
        startDate: wt.startDate || '',
        endDate: wt.endDate || '',
        hasQuote: wt.hasQuote || false,
        hasSchedule: wt.hasSchedule || false,
        vendorCostItems: normalizeItems(wt.vendorCostItems, wt.vendorCost, 'vc'),
        vendorCostFree: wt.vendorCostFree || false,
        costIncludesTax: wt.costIncludesTax || false,
    }
```

改成：

```js
    form.value = {
        name: wt.name,
        vendorId: wt.vendorId || '',
        startDate: wt.startDate || '',
        endDate: wt.endDate || '',
        hasQuote: wt.hasQuote || false,
        hasSchedule: wt.hasSchedule || false,
        vendorCostItems: normalizeItems(wt.vendorCostItems, wt.vendorCost, 'vc'),
        vendorCostFree: wt.vendorCostFree || false,
        costIncludesTax: wt.costIncludesTax || false,
        locations: (wt.locations || []).map(l => ({ ...l })),
    }
```

- [ ] **Step 5: `submitForm()` 存檔加上 `locations`**

第 1031-1047 行的 `entry` 物件：

```js
        const entry = {
            id: existing ? existing.id : `wt_${Date.now()}`,
            name: form.value.name,
            vendorId: form.value.vendorId || '',
            vendorName: vendor?.name ?? '',
            startDate: form.value.startDate || '',
            endDate: form.value.endDate || '',
            hasQuote: form.value.hasQuote || false,
            hasSchedule: form.value.hasSchedule || false,
            vendorCostItems: form.value.vendorCostFree ? [] : form.value.vendorCostItems.filter(i => i.description || i.amount > 0),
            vendorCostFree: form.value.vendorCostFree || false,
            costIncludesTax: form.value.costIncludesTax || false,
            color: existing ? existing.color : WT_COLORS[workTypes.value.length % WT_COLORS.length],
            vendorPayments: existing?.vendorPayments ?? [],
            done: existing?.done ?? false,
            invoiceReceived: existing?.invoiceReceived ?? false,
        }
```

改成：

```js
        const entry = {
            id: existing ? existing.id : `wt_${Date.now()}`,
            name: form.value.name,
            vendorId: form.value.vendorId || '',
            vendorName: vendor?.name ?? '',
            startDate: form.value.startDate || '',
            endDate: form.value.endDate || '',
            hasQuote: form.value.hasQuote || false,
            hasSchedule: form.value.hasSchedule || false,
            vendorCostItems: form.value.vendorCostFree ? [] : form.value.vendorCostItems.filter(i => i.description || i.amount > 0),
            vendorCostFree: form.value.vendorCostFree || false,
            costIncludesTax: form.value.costIncludesTax || false,
            color: existing ? existing.color : WT_COLORS[workTypes.value.length % WT_COLORS.length],
            vendorPayments: existing?.vendorPayments ?? [],
            done: existing?.done ?? false,
            invoiceReceived: existing?.invoiceReceived ?? false,
            locations: form.value.locations.filter(l => l.label),
        }
```

- [ ] **Step 6: 表單 Modal 加上「施作位置」區塊**

在第 350 行（`vendorCostItems` 區塊的 `</div>` 之後）、第 351 行（`含稅`/`已提供報價單` checkbox 區塊之前）插入：

```html
        <div>
          <label class="text-xs text-gray-500 font-medium mb-1 block">施作位置（選填）</label>
          <div class="flex flex-col gap-1.5">
            <div v-for="(loc, i) in form.locations" :key="loc.id"
              class="border border-gray-100 rounded-lg p-2 bg-gray-50/60">
              <div class="flex gap-1.5 mb-1.5">
                <input v-model="loc.label" type="text" placeholder="位置（例：浴室）"
                  class="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
                <button type="button" @click="removeLocation(i)"
                  class="text-[10px] text-red-400 hover:text-red-600 px-1 flex-shrink-0">✕</button>
              </div>
              <div class="grid grid-cols-2 gap-1.5 mb-1.5">
                <input :value="loc.startDate" type="date"
                  @input="loc.startDate = $event.target.value"
                  class="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
                <input :value="loc.endDate" type="date"
                  @input="loc.endDate = $event.target.value"
                  class="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
              </div>
              <input v-model="loc.note" type="text" placeholder="備註"
                class="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
            </div>
            <button type="button" @click="addLocation"
              class="text-[11px] border border-dashed border-gray-200 rounded-lg py-1.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors w-full">
              + 新增施作位置
            </button>
          </div>
        </div>
```

- [ ] **Step 7: 主列表卡片顯示施作位置（唯讀）**

在第 243 行（施工照片區塊的 `</div>` 之後、工種卡片 `</div>` 之前，即第 244 行前）插入：

```html
        <div v-if="wt.locations?.length" class="mt-2 pt-2 border-t border-gray-100">
          <div class="text-[10px] text-gray-400 font-medium mb-1">施作位置</div>
          <div class="flex flex-col gap-1">
            <div v-for="loc in wt.locations" :key="loc.id" class="text-[11px] text-gray-600 flex items-center gap-2">
              <span class="font-medium">{{ loc.label }}</span>
              <span v-if="loc.startDate" class="text-gray-400">
                {{ loc.startDate }}<template v-if="loc.endDate"> ～ {{ loc.endDate }}</template>
              </span>
            </div>
          </div>
        </div>
```

- [ ] **Step 8: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 9: 手動驗收**

1. `npm run dev`，進任一案件詳情頁「工程安排」
2. 新增或編輯一筆工種，展開「施作位置」，新增 2 筆位置（各填位置名稱＋不同的進場/退場日期），儲存
3. 確認工種卡片下方出現「施作位置」區塊，顯示剛才輸入的 2 筆資料
4. 確認甘特圖畫面沒有變化（locations 不影響甘特圖渲染）
5. 再次編輯這筆工種，確認 2 筆位置資料正確回填，刪除其中一筆後儲存，確認只剩 1 筆

- [ ] **Step 10: Commit**

```bash
git add src/components/cases/WorkTypePanel.vue
git commit -m "feat(worktype): add multi-location tracking with individual start/end dates"
```

---

## Task 3：工種選單移除自訂功能

**Files:**
- Modify: `src/components/cases/WorkTypePanel.vue`
- Create: `src/utils/workTypeCategory.js`
- Test: `tests/utils/workTypeCategory.test.js`
- Create（選用，一次性稽核腳本）: `scripts/audit-worktype-names.mjs`

- [ ] **Step 1: 稽核現有資料是否有非標準工種名稱**

建立 `scripts/audit-worktype-names.mjs`：

```js
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const WORK_CATEGORIES = ['材料行', '建材行', '廚具', '油漆', '清運拆除', '泥作', '木工', '水電', '玻璃', '鐵工', '工程', '清潔', '系統櫃', '冷氣', '貼膜', '地板', '軟裝', '其他']

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

const snap = await db.collection('cases').get()
let count = 0
snap.docs.forEach(d => {
    const workTypes = d.data().workTypes || []
    workTypes.forEach(wt => {
        if (wt.name && !WORK_CATEGORIES.includes(wt.name)) {
            count++
            console.log(`  案件 ${d.id}（${d.data().name || ''}）工種「${wt.name}」不在標準清單內`)
        }
    })
})
console.log(`共 ${count} 筆非標準工種名稱`)
process.exit(0)
```

Run: `node scripts/audit-worktype-names.mjs`
Expected: 印出案件清單與總數。**如果本機沒有 `firebase-admin-key.json` 憑證檔，這個腳本會直接報錯——此時跳過這一步，直接往下走**，因為 Step 3-4 加的 UI fallback 本來就會妥善處理任何非標準名稱，不會因為沒有稽核數字而讓程式出錯。把稽核結果（或「憑證檔不存在，已略過」）記錄在這個 task 的完成回報裡。

- [ ] **Step 2: 寫「舊資料判斷邏輯」的失敗測試**

建立 `tests/utils/workTypeCategory.test.js`：

```js
// naiship-system/tests/utils/workTypeCategory.test.js
import { describe, it, expect } from 'vitest'
import { isLegacyCategoryName } from '@/utils/workTypeCategory'

describe('isLegacyCategoryName', () => {
    const categories = ['水電', '泥作']

    it('is true when no category selected and the name is outside the list', () => {
        expect(isLegacyCategoryName('', '窗簾', categories)).toBe(true)
    })
    it('is false when a standard category is selected', () => {
        expect(isLegacyCategoryName('水電', '水電', categories)).toBe(false)
    })
    it('is false when the name is empty', () => {
        expect(isLegacyCategoryName('', '', categories)).toBe(false)
    })
    it('is false when the name matches a standard category even without an active selection', () => {
        expect(isLegacyCategoryName('', '水電', categories)).toBe(false)
    })
})
```

Run: `npx vitest run tests/utils/workTypeCategory.test.js`
Expected: FAIL — 找不到 `@/utils/workTypeCategory`

- [ ] **Step 3: 建立純函式**

建立 `src/utils/workTypeCategory.js`：

```js
export function isLegacyCategoryName(selectedCategory, formName, categories) {
    return !selectedCategory && !!formName && !categories.includes(formName)
}
```

Run: `npx vitest run tests/utils/workTypeCategory.test.js`
Expected: PASS（4 個測試）

- [ ] **Step 4: 選單移除自訂選項**

第 258-269 行：

```html
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工種 *</label>
          <select v-model="selectedCategory" @change="onCategoryChange" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 請選擇工種 —</option>
            <option v-for="cat in WORK_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
            <option value="__custom__">自訂…</option>
          </select>
        </div>
        <div v-if="selectedCategory === '__custom__'">
          <label class="text-xs text-gray-500 mb-1 block">自訂名稱 *</label>
          <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="輸入工種名稱">
        </div>
```

改成：

```html
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工種 *</label>
          <select v-model="selectedCategory" @change="onCategoryChange" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 請選擇工種 —</option>
            <option v-for="cat in WORK_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
          </select>
          <div v-if="isLegacyCustomName" class="mt-1.5 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
            舊資料：{{ form.name }}（不在標準清單內）
            <button type="button" @click="clearLegacyCustomName" class="ml-1 underline hover:text-amber-800">改選標準分類</button>
          </div>
        </div>
```

- [ ] **Step 5: `WorkTypePanel.vue` 改用 `isLegacyCategoryName`，加上 `clearLegacyCustomName`**

在 `src/components/cases/WorkTypePanel.vue` 的 import 區塊（Task 1 改完後的樣子）加入：

```js
import { isLegacyCategoryName } from '@/utils/workTypeCategory'
```

第 794-799 行：

```js
const selectedCategory = ref('')
function onCategoryChange() {
    const val = selectedCategory.value
    if (val && val !== '__custom__') form.value.name = val
    else if (val === '__custom__') form.value.name = ''
}
```

改成：

```js
const selectedCategory = ref('')
function onCategoryChange() {
    if (selectedCategory.value) form.value.name = selectedCategory.value
}
const isLegacyCustomName = computed(() => isLegacyCategoryName(selectedCategory.value, form.value.name, WORK_CATEGORIES))
function clearLegacyCustomName() {
    form.value.name = ''
}
```

- [ ] **Step 6: 廠商提示文字移除 `__custom__` 判斷**

第 294-296 行：

```html
          <p v-if="regionVendors.length === 0" class="text-[11px] text-gray-400 mt-1">
            {{ selectedCategory && selectedCategory !== '__custom__' ? `尚無「${selectedCategory}」廠商，請至設定新增` : '尚無廠商，請至設定 › 廠商管理新增' }}
          </p>
```

改成：

```html
          <p v-if="regionVendors.length === 0" class="text-[11px] text-gray-400 mt-1">
            {{ selectedCategory ? `尚無「${selectedCategory}」廠商，請至設定新增` : '尚無廠商，請至設定 › 廠商管理新增' }}
          </p>
```

- [ ] **Step 7: `regionVendors` 移除 `__custom__` 判斷**

第 967-973 行：

```js
const regionVendors = computed(() => {
    const vendors = vendorsStore.vendors.filter(v => !v.companyId || v.companyId === caseData.value?.companyId)
    if (!selectedCategory.value || selectedCategory.value === '__custom__') return vendors
    const standardCategories = WORK_CATEGORIES.filter(c => c !== '其他')
    if (selectedCategory.value === '其他') return vendors.filter(v => !standardCategories.includes(v.specialty))
    return vendors.filter(v => v.specialty === selectedCategory.value)
})
```

改成：

```js
const regionVendors = computed(() => {
    const vendors = vendorsStore.vendors.filter(v => !v.companyId || v.companyId === caseData.value?.companyId)
    if (!selectedCategory.value) return vendors
    const standardCategories = WORK_CATEGORIES.filter(c => c !== '其他')
    if (selectedCategory.value === '其他') return vendors.filter(v => !standardCategories.includes(v.specialty))
    return vendors.filter(v => v.specialty === selectedCategory.value)
})
```

- [ ] **Step 8: `openEdit()` 回填邏輯移除 `__custom__`**

第 1003 行：

```js
    selectedCategory.value = WORK_CATEGORIES.includes(wt.name) ? wt.name : (wt.name ? '__custom__' : '')
```

改成：

```js
    selectedCategory.value = WORK_CATEGORIES.includes(wt.name) ? wt.name : ''
```

- [ ] **Step 9: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 10: 手動驗收**

1. `npm run dev`，新增工種，確認選單只剩固定 18 種分類，沒有「自訂…」選項
2. 如果 Step 1 稽核有找到非標準名稱的案件，開啟該案件編輯對應工種，確認畫面顯示「舊資料：OOO（不在標準清單內）」提示，不報錯、資料不消失；點擊「改選標準分類」，確認提示消失、可以正常從下拉選單挑一個標準分類存檔
3. 如果 Step 1 沒資料可測，就新增一筆工種存成標準分類，正常編輯確認沒有出現舊資料提示

- [ ] **Step 11: Commit**

```bash
git add src/components/cases/WorkTypePanel.vue src/utils/workTypeCategory.js tests/utils/workTypeCategory.test.js scripts/audit-worktype-names.mjs
git commit -m "feat(worktype): remove custom category input, dropdown-only selection"
```

---

## Task 4：`bidRequests` store（廠商比價資料層）

**Files:**
- Create: `src/stores/bidRequests.js`
- Test: `tests/stores/bidRequests.test.js`

- [ ] **Step 1: 寫 `buildWinningWorkType` 的失敗測試**

建立 `tests/stores/bidRequests.test.js`：

```js
// naiship-system/tests/stores/bidRequests.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    doc: vi.fn(),
    serverTimestamp: vi.fn(() => 'ts'),
}))

import { useBidRequestsStore, buildWinningWorkType } from '@/stores/bidRequests'
import { updateDoc, deleteDoc, getDocs } from 'firebase/firestore'

describe('buildWinningWorkType', () => {
    const bidRequest = {
        id: 'br1',
        category: '水電',
        bids: [
            { id: 'bid1', vendorId: 'v1', vendorName: '阿明水電', quoteAmount: 50000, includesTax: true, note: '含材料' },
            { id: 'bid2', vendorId: 'v2', vendorName: '志明水電', quoteAmount: 45000, includesTax: false, note: '' },
        ],
    }

    it('builds a workType entry from the winning bid', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid1', 0)
        expect(wt.name).toBe('水電')
        expect(wt.vendorId).toBe('v1')
        expect(wt.vendorName).toBe('阿明水電')
        expect(wt.hasQuote).toBe(true)
        expect(wt.costIncludesTax).toBe(true)
        expect(wt.vendorCostItems).toEqual([
            { id: expect.any(String), description: '水電', amount: 50000, note: '含材料' }
        ])
        expect(wt.locations).toEqual([])
        expect(wt.done).toBe(false)
    })

    it('leaves vendorCostItems empty when quoteAmount is 0', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid2', 0)
        expect(wt.vendorCostItems).toEqual([])
    })

    it('cycles color by existing work type count', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid1', 9)
        expect(wt.color).toBe('#f59e0b') // index 9 % 8 = 1
    })

    it('throws when the winning bid id does not exist', () => {
        expect(() => buildWinningWorkType(bidRequest, 'missing', 0)).toThrow()
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/stores/bidRequests.test.js`
Expected: FAIL — 找不到 `@/stores/bidRequests`

- [ ] **Step 3: 建立 `buildWinningWorkType` 與 store 骨架**

建立 `src/stores/bidRequests.js`：

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { WT_COLORS } from '@/constants/workTypeColors'

export function buildWinningWorkType(bidRequest, winningBidId, existingWorkTypesCount) {
    const winner = (bidRequest.bids || []).find(b => b.id === winningBidId)
    if (!winner) throw new Error('winning bid not found')
    return {
        id: `wt_${Date.now()}`,
        name: bidRequest.category,
        vendorId: winner.vendorId,
        vendorName: winner.vendorName,
        startDate: '',
        endDate: '',
        hasQuote: true,
        hasSchedule: false,
        vendorCostItems: winner.quoteAmount > 0
            ? [{ id: `vc_${Date.now()}`, description: bidRequest.category, amount: winner.quoteAmount, note: winner.note || '' }]
            : [],
        vendorCostFree: false,
        costIncludesTax: winner.includesTax || false,
        color: WT_COLORS[existingWorkTypesCount % WT_COLORS.length],
        vendorPayments: [],
        done: false,
        invoiceReceived: false,
        locations: [],
    }
}

export const useBidRequestsStore = defineStore('bidRequests', () => {
    const bidRequests = ref([])
    let unsubscribe = null

    function subscribe(caseId) {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        bidRequests.value = []
        if (!caseId) return
        const q = query(collection(db, 'cases', caseId, 'bidRequests'), orderBy('createdAt', 'asc'))
        unsubscribe = onSnapshot(q, snap => {
            bidRequests.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        })
    }

    function cleanup() { if (unsubscribe) { unsubscribe(); unsubscribe = null } }

    return { bidRequests, subscribe, cleanup }
})
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/stores/bidRequests.test.js`
Expected: PASS（4 個測試）

- [ ] **Step 5: 寫 store CRUD 的失敗測試**

在 `tests/stores/bidRequests.test.js` 檔案末尾加入：

```js
describe('useBidRequestsStore actions', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    it('addBid appends a new bid to the matching bidRequest', async () => {
        const store = useBidRequestsStore()
        store.bidRequests = [{ id: 'br1', category: '水電', bids: [] }]
        await store.addBid('case1', 'br1', { vendorId: 'v1', vendorName: '阿明水電', quoteAmount: 50000, includesTax: true, note: '' })
        expect(updateDoc).toHaveBeenCalledTimes(1)
        const [, data] = updateDoc.mock.calls[0]
        expect(data.bids).toHaveLength(1)
        expect(data.bids[0]).toMatchObject({ vendorId: 'v1', vendorName: '阿明水電', quoteAmount: 50000 })
        expect(data.bids[0].id).toMatch(/^bid_/)
    })

    it('markConverted writes status, winningBidId and convertedWorkTypeId', async () => {
        const store = useBidRequestsStore()
        await store.markConverted('case1', 'br1', 'bid1', 'wt1')
        expect(updateDoc).toHaveBeenCalledWith(undefined, {
            status: 'converted', winningBidId: 'bid1', convertedWorkTypeId: 'wt1',
        })
    })

    it('repointQuotePhotos updates every photo id to vendor_quote with the new workTypeId', async () => {
        const store = useBidRequestsStore()
        await store.repointQuotePhotos('case1', ['p1', 'p2'], 'wt1')
        expect(updateDoc).toHaveBeenCalledTimes(2)
        expect(updateDoc.mock.calls[0][1]).toEqual({ type: 'vendor_quote', workTypeId: 'wt1' })
    })

    it('deleteBidRequest deletes associated photos then the bidRequest doc', async () => {
        getDocs.mockResolvedValueOnce({ docs: [{ ref: 'photoRef1' }, { ref: 'photoRef2' }] })
        const store = useBidRequestsStore()
        await store.deleteBidRequest('case1', 'br1')
        expect(deleteDoc).toHaveBeenCalledWith('photoRef1')
        expect(deleteDoc).toHaveBeenCalledWith('photoRef2')
        expect(deleteDoc).toHaveBeenCalledTimes(3) // 2 photos + the bidRequest doc itself
    })
})
```

- [ ] **Step 6: 執行測試確認失敗**

Run: `npx vitest run tests/stores/bidRequests.test.js`
Expected: FAIL — `store.addBid is not a function`（其餘同理）

- [ ] **Step 7: 補完 store 的 CRUD 方法**

把 `src/stores/bidRequests.js` 的 `return { bidRequests, subscribe, cleanup }` 之前補上：

```js
    async function addBidRequest(caseId, category, note, createdBy) {
        return addDoc(collection(db, 'cases', caseId, 'bidRequests'), {
            category, note: note || '', status: 'open', bids: [],
            createdBy, createdAt: serverTimestamp(),
        })
    }

    async function addBid(caseId, bidRequestId, bidData) {
        const br = bidRequests.value.find(b => b.id === bidRequestId)
        if (!br) return
        const newBid = { id: `bid_${Date.now()}`, quotePhotoIds: [], submittedAt: new Date().toISOString(), ...bidData }
        const updatedBids = [...(br.bids || []), newBid]
        await updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), { bids: updatedBids })
        return newBid.id
    }

    async function appendQuotePhotoId(caseId, bidRequestId, bidEntryId, photoId) {
        const br = bidRequests.value.find(b => b.id === bidRequestId)
        if (!br) return
        const updatedBids = br.bids.map(b =>
            b.id === bidEntryId ? { ...b, quotePhotoIds: [...(b.quotePhotoIds || []), photoId] } : b
        )
        await updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), { bids: updatedBids })
    }

    async function removeQuotePhotoId(caseId, bidRequestId, bidEntryId, photoId) {
        await deleteDoc(doc(db, 'cases', caseId, 'photos', photoId))
        const br = bidRequests.value.find(b => b.id === bidRequestId)
        if (!br) return
        const updatedBids = br.bids.map(b =>
            b.id === bidEntryId ? { ...b, quotePhotoIds: (b.quotePhotoIds || []).filter(id => id !== photoId) } : b
        )
        await updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), { bids: updatedBids })
    }

    async function markConverted(caseId, bidRequestId, winningBidId, convertedWorkTypeId) {
        return updateDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId), {
            status: 'converted', winningBidId, convertedWorkTypeId,
        })
    }

    async function repointQuotePhotos(caseId, photoIds, workTypeId) {
        await Promise.all((photoIds || []).map(pid =>
            updateDoc(doc(db, 'cases', caseId, 'photos', pid), { type: 'vendor_quote', workTypeId })
        ))
    }

    async function deleteBidRequest(caseId, bidRequestId) {
        const photoSnap = await getDocs(query(collection(db, 'cases', caseId, 'photos'), where('bidRequestId', '==', bidRequestId)))
        await Promise.all(photoSnap.docs.map(d => deleteDoc(d.ref)))
        await deleteDoc(doc(db, 'cases', caseId, 'bidRequests', bidRequestId))
    }
```

並把 `return` 陳述式改成：

```js
    return {
        bidRequests, subscribe, cleanup,
        addBidRequest, addBid, appendQuotePhotoId, removeQuotePhotoId,
        markConverted, repointQuotePhotos, deleteBidRequest,
    }
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npx vitest run tests/stores/bidRequests.test.js`
Expected: PASS（8 個測試）

- [ ] **Step 9: Commit**

```bash
git add src/stores/bidRequests.js tests/stores/bidRequests.test.js
git commit -m "feat(bidRequests): add store for vendor bid comparison data"
```

---

## Task 5：`BidRequestPanel.vue` 廠商比價 UI

**Files:**
- Create: `src/components/cases/BidRequestPanel.vue`

- [ ] **Step 1: 建立元件**

建立 `src/components/cases/BidRequestPanel.vue`：

```vue
<template>
  <div class="border-t border-gray-200 bg-white px-5 py-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(201,169,110,0.15);color:#c9a96e">廠商比價</span>
      </div>
      <button @click="openCreateForm" class="text-xs px-3 py-1.5 rounded-lg text-white" style="background:#1e2533">+ 新增比價需求</button>
    </div>

    <div v-if="bidRequests.length === 0" class="text-xs text-gray-400 py-3 text-center">
      尚無比價需求，點擊右上新增
    </div>

    <div v-else class="flex flex-col gap-3">
      <div v-for="br in bidRequests" :key="br.id" class="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-gray-800">{{ br.category }}</span>
            <span v-if="br.status === 'converted'" class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">已確認</span>
            <span v-else class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">比價中</span>
          </div>
          <button v-if="br.status !== 'converted'" @click="confirmDeleteBidRequest(br.id)" class="text-[11px] text-red-400 hover:text-red-600">刪除</button>
        </div>
        <p v-if="br.note" class="text-[11px] text-gray-400 mb-2">{{ br.note }}</p>

        <div v-if="(br.bids || []).length === 0" class="text-[11px] text-gray-300 py-2">尚無廠商報價</div>
        <div v-else class="flex flex-col gap-1.5 mb-2">
          <div v-for="bid in br.bids" :key="bid.id"
            class="border rounded-lg p-2 bg-white flex items-center flex-wrap gap-2"
            :class="br.winningBidId === bid.id ? 'border-green-300' : 'border-gray-100'">
            <span class="text-xs font-medium text-gray-700 flex-shrink-0">{{ bid.vendorName }}</span>
            <span class="text-xs text-gray-600">${{ (bid.quoteAmount || 0).toLocaleString() }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              :class="bid.includesTax ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'">
              {{ bid.includesTax ? '含稅' : '未稅' }}
            </span>
            <span v-if="br.winningBidId === bid.id" class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium">贏家</span>
            <button v-if="br.status !== 'converted'" @click="triggerQuoteUpload(br.id, bid.id)"
              class="ml-auto text-[10px] border border-dashed border-gray-200 rounded px-2 py-0.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
              + 報價單
            </button>
            <div v-if="quotePhotos[bid.id]?.length" class="flex gap-1 w-full">
              <div v-for="item in quotePhotos[bid.id]" :key="item.id" class="relative group">
                <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                  class="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-[8px] text-red-600 font-bold">PDF</a>
                <img v-else :src="item.url" class="w-8 h-8 rounded object-cover">
                <button v-if="br.status !== 'converted'" @click="deleteQuotePhoto(br.id, bid.id, item)"
                  class="absolute -top-1 -right-1 w-3 h-3 bg-gray-600 text-white rounded-full text-[7px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500">✕</button>
              </div>
            </div>
            <p v-if="bid.note" class="text-[10px] text-gray-400 w-full">{{ bid.note }}</p>
          </div>
        </div>

        <template v-if="br.status !== 'converted'">
          <button v-if="addingBidFor !== br.id" @click="openAddBid(br)"
            class="text-[11px] border border-dashed border-gray-200 rounded-lg py-1.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors w-full">
            + 新增廠商報價
          </button>

          <div v-else class="border border-gray-100 rounded-lg p-2.5 bg-white flex flex-col gap-2 mt-1.5">
            <div class="relative">
              <input v-model="vendorSearch" @focus="showVendorDropdown = true" @blur="hideVendorDropdown"
                type="text" placeholder="搜尋廠商名稱…"
                class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
              <div v-if="showVendorDropdown"
                class="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                <button v-for="v in filteredVendorList(br.category)" :key="v.id" type="button"
                  @mousedown.prevent="selectVendor(v)"
                  class="w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                  :class="bidForm.vendorId === v.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'">
                  {{ v.name }}
                </button>
                <div v-if="filteredVendorList(br.category).length === 0" class="px-2.5 py-1.5 text-xs text-gray-300">找不到符合廠商</div>
              </div>
            </div>
            <div class="flex gap-2">
              <input v-model.number="bidForm.quoteAmount" type="number" min="0" placeholder="報價金額"
                class="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
              <label class="flex items-center gap-1 text-xs text-gray-600 flex-shrink-0">
                <input type="checkbox" v-model="bidForm.includesTax" class="rounded">含稅
              </label>
            </div>
            <input v-model="bidForm.note" type="text" placeholder="備註（選填）"
              class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1">
            <div class="flex justify-end gap-2">
              <button @click="addingBidFor = null" class="text-xs text-gray-400 px-3 py-1.5">取消</button>
              <button @click="submitBid(br)" :disabled="savingBid || !bidForm.vendorId"
                class="text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-60" style="background:#1e2533">
                {{ savingBid ? '儲存中…' : '新增報價' }}
              </button>
            </div>
          </div>

          <template v-if="(br.bids || []).length > 0">
            <div v-if="confirmingBidRequestId !== br.id" class="mt-1.5">
              <button v-if="authStore.isManager" @click="openConfirmWinner(br)"
                class="text-[11px] px-3 py-1.5 rounded-lg text-white w-full" style="background:#c9a96e">
                確認贏家
              </button>
            </div>
            <div v-else class="border border-amber-200 rounded-lg p-2.5 bg-amber-50/50 mt-1.5 flex flex-col gap-2">
              <label v-for="bid in br.bids" :key="bid.id" class="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="radio" :value="bid.id" v-model="selectedWinnerId" class="accent-amber-600">
                {{ bid.vendorName }} — ${{ (bid.quoteAmount || 0).toLocaleString() }}{{ bid.includesTax ? '（含稅）' : '（未稅）' }}
              </label>
              <div class="flex justify-end gap-2 mt-1">
                <button @click="confirmingBidRequestId = null" class="text-xs text-gray-400 px-3 py-1.5">取消</button>
                <button @click="confirmWinner(br)" :disabled="!selectedWinnerId || confirming"
                  class="text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-60" style="background:#1e2533">
                  {{ confirming ? '確認中…' : '確認並轉為正式工種' }}
                </button>
              </div>
            </div>
          </template>
        </template>
        <p v-else class="text-[11px] text-gray-400 mt-1.5">已轉為正式工種，請至「工程安排」查看</p>
      </div>
    </div>
  </div>

  <!-- 新增比價需求 Modal -->
  <div v-if="showCreateForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">新增比價需求</h3>
        <button @click="showCreateForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工種 *</label>
          <select v-model="createForm.category" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 請選擇工種 —</option>
            <option v-for="cat in WORK_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">說明（選填）</label>
          <input v-model="createForm.note" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：浴室防水兩間">
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showCreateForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitCreateForm" :disabled="savingCreate || !createForm.category"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ savingCreate ? '儲存中…' : '建立' }}
        </button>
      </div>
    </div>
  </div>

  <input ref="quoteFileInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleQuoteFiles">
</template>
<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { useBidRequestsStore, buildWinningWorkType } from '@/stores/bidRequests'
import { useVendorsStore } from '@/stores/vendors'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const props = defineProps({ caseId: String, caseName: String })
const bidRequestsStore = useBidRequestsStore()
const vendorsStore = useVendorsStore()
const casesStore = useCasesStore()
const authStore = useAuthStore()
const { toast } = useToast()

const caseData = computed(() => casesStore.cases.find(c => c.id === props.caseId))
const workTypes = computed(() => caseData.value?.workTypes ?? [])
const bidRequests = computed(() => bidRequestsStore.bidRequests)

const showCreateForm = ref(false)
const savingCreate = ref(false)
const createForm = ref({ category: '', note: '' })

function openCreateForm() {
    createForm.value = { category: '', note: '' }
    showCreateForm.value = true
}

async function submitCreateForm() {
    if (!createForm.value.category || savingCreate.value) return
    savingCreate.value = true
    try {
        await bidRequestsStore.addBidRequest(props.caseId, createForm.value.category, createForm.value.note, authStore.name ?? '')
        showCreateForm.value = false
    } catch {
        toast('建立失敗，請重試', 'error')
    } finally {
        savingCreate.value = false
    }
}

async function confirmDeleteBidRequest(id) {
    if (!confirm('確定刪除此比價需求？已上傳的報價單將一併刪除。')) return
    try {
        await bidRequestsStore.deleteBidRequest(props.caseId, id)
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}

const addingBidFor = ref(null)
const savingBid = ref(false)
const bidForm = ref({ vendorId: '', vendorName: '', quoteAmount: 0, includesTax: false, note: '' })
const vendorSearch = ref('')
const showVendorDropdown = ref(false)

function openAddBid(br) {
    addingBidFor.value = br.id
    bidForm.value = { vendorId: '', vendorName: '', quoteAmount: 0, includesTax: false, note: '' }
    vendorSearch.value = ''
}

function filteredVendorList(category) {
    const vendors = vendorsStore.vendors.filter(v => !v.companyId || v.companyId === caseData.value?.companyId)
    const standardCategories = WORK_CATEGORIES.filter(c => c !== '其他')
    const byCategory = category === '其他'
        ? vendors.filter(v => !standardCategories.includes(v.specialty))
        : vendors.filter(v => v.specialty === category)
    const kw = vendorSearch.value.trim()
    if (!kw) return byCategory
    return byCategory.filter(v => v.name.includes(kw))
}

function selectVendor(vendor) {
    bidForm.value.vendorId = vendor.id
    bidForm.value.vendorName = vendor.name
    vendorSearch.value = vendor.name
    showVendorDropdown.value = false
}

function hideVendorDropdown() {
    setTimeout(() => { showVendorDropdown.value = false }, 150)
}

async function submitBid(br) {
    if (!bidForm.value.vendorId || savingBid.value) return
    savingBid.value = true
    try {
        await bidRequestsStore.addBid(props.caseId, br.id, {
            vendorId: bidForm.value.vendorId,
            vendorName: bidForm.value.vendorName,
            quoteAmount: bidForm.value.quoteAmount || 0,
            includesTax: bidForm.value.includesTax || false,
            note: bidForm.value.note || '',
            submittedBy: authStore.user?.uid ?? '',
        })
        addingBidFor.value = null
    } catch {
        toast('新增報價失敗，請重試', 'error')
    } finally {
        savingBid.value = false
    }
}

const quotePhotos = reactive({})
const quoteFileInput = ref(null)
const activeBidRequestId = ref('')
const activeBidEntryId = ref('')

function triggerQuoteUpload(bidRequestId, bidEntryId) {
    activeBidRequestId.value = bidRequestId
    activeBidEntryId.value = bidEntryId
    quoteFileInput.value?.click()
}

async function handleQuoteFiles(e) {
    const files = Array.from(e.target.files)
    e.target.value = ''
    const bidRequestId = activeBidRequestId.value
    const bidEntryId = activeBidEntryId.value
    for (const file of files) {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); continue }
        try {
            const url = await uploadPhoto(file, 'bid_quote')
            const isPdf = file.name.toLowerCase().endsWith('.pdf')
            const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'bid_quote', bidRequestId, bidEntryId,
                url, isPdf,
                uploadedBy: authStore.user?.uid ?? 'unknown',
                createdAt: serverTimestamp(),
            })
            await bidRequestsStore.appendQuotePhotoId(props.caseId, bidRequestId, bidEntryId, docRef.id)
            if (!quotePhotos[bidEntryId]) quotePhotos[bidEntryId] = []
            quotePhotos[bidEntryId].push({ id: docRef.id, url, isPdf, pdfUrl })
        } catch {
            toast('上傳失敗，請重試', 'error')
        }
    }
}

async function deleteQuotePhoto(bidRequestId, bidEntryId, item) {
    await bidRequestsStore.removeQuotePhotoId(props.caseId, bidRequestId, bidEntryId, item.id)
    quotePhotos[bidEntryId] = (quotePhotos[bidEntryId] || []).filter(p => p !== item)
}

const confirmingBidRequestId = ref(null)
const selectedWinnerId = ref('')
const confirming = ref(false)

function openConfirmWinner(br) {
    confirmingBidRequestId.value = br.id
    selectedWinnerId.value = ''
}

async function confirmWinner(br) {
    if (!selectedWinnerId.value || confirming.value) return
    confirming.value = true
    try {
        const newWorkType = buildWinningWorkType(br, selectedWinnerId.value, workTypes.value.length)
        await casesStore.updateCase(props.caseId, { workTypes: [...workTypes.value, newWorkType] })
        await bidRequestsStore.markConverted(props.caseId, br.id, selectedWinnerId.value, newWorkType.id)
        const winner = br.bids.find(b => b.id === selectedWinnerId.value)
        await bidRequestsStore.repointQuotePhotos(props.caseId, winner?.quotePhotoIds, newWorkType.id)
        confirmingBidRequestId.value = null
        selectedWinnerId.value = ''
        toast(`已確認贏家，正式工種「${br.category}」已建立`)
    } catch {
        toast('確認失敗，請重試', 'error')
    } finally {
        confirming.value = false
    }
}

onMounted(async () => {
    bidRequestsStore.subscribe(props.caseId)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, bidEntryId } = d.data()
        if (type !== 'bid_quote' || !bidEntryId) return
        const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
        const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
        if (!quotePhotos[bidEntryId]) quotePhotos[bidEntryId] = []
        quotePhotos[bidEntryId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl })
    })
})

onUnmounted(() => {
    bidRequestsStore.cleanup()
})
</script>
```

- [ ] **Step 2: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤（此時元件還沒被任何地方引用，只確認語法正確）

- [ ] **Step 3: Commit**

```bash
git add src/components/cases/BidRequestPanel.vue
git commit -m "feat(bidRequests): add BidRequestPanel UI for vendor quote comparison"
```

---

## Task 6：掛載「廠商比價」tab 到案件詳情頁

**Files:**
- Modify: `src/components/cases/GanttTab.vue`

- [ ] **Step 1: import 新元件**

第 262 行（`import WorkTypePanel from './WorkTypePanel.vue'` 之前）加入：

```js
import BidRequestPanel from './BidRequestPanel.vue'
```

- [ ] **Step 2: tab 清單新增「廠商比價」，排在「工程安排」之前**

第 439-446 行：

```js
const CASE_TABS = [
    { key: 'worktype', label: '工程安排' },
    { key: 'photo',    label: '檔案管理' },
    { key: 'tasks',    label: '交辦事項' },
    { key: 'notes',    label: '洽談備注' },
    { key: 'payment',  label: '收款期程' },
    { key: 'review',   label: '案件檢討' },
]
```

改成：

```js
const CASE_TABS = [
    { key: 'bidding',  label: '廠商比價' },
    { key: 'worktype', label: '工程安排' },
    { key: 'photo',    label: '檔案管理' },
    { key: 'tasks',    label: '交辦事項' },
    { key: 'notes',    label: '洽談備注' },
    { key: 'payment',  label: '收款期程' },
    { key: 'review',   label: '案件檢討' },
]
```

- [ ] **Step 3: 渲染 `BidRequestPanel`**

第 238 行（`<WorkTypePanel v-if="selectedTab === 'worktype'" ...>` 之前）加入：

```html
    <BidRequestPanel v-if="selectedTab === 'bidding'" :key="`bid-${selectedCaseId}`" :case-id="selectedCaseId" :case-name="selectedCaseName" />
```

- [ ] **Step 4: 執行 build 確認沒有語法錯誤**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 5: Commit**

```bash
git add src/components/cases/GanttTab.vue
git commit -m "feat(cases): mount vendor bidding tab ahead of 工程安排"
```

---

## Task 7：完整驗收

**Files:** 無新增/修改，純驗收

- [ ] **Step 1: 跑完整測試套件**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 2: Build 確認**

Run: `npm run build`
Expected: `✓ built` 沒有錯誤

- [ ] **Step 3: 端到端手動驗收**

1. `npm run dev`，登入非 admin 的一般員工帳號，進任一案件詳情頁，確認「廠商比價」tab 出現在「工程安排」左邊
2. 用一般員工帳號：新增比價需求（選一個工種類別）、新增 2 家廠商報價（金額不同、含稅/未稅各一筆）、各自上傳一張報價單圖片，確認畫面正確顯示兩筆報價與縮圖
3. 確認一般員工帳號**看不到**「確認贏家」按鈕
4. 登出，改用 admin 或該分區 manager 帳號登入，進同一案件，確認「確認贏家」按鈕出現，點擊後選一家廠商確認
5. 確認：
   - 該比價需求狀態變成「已確認」，不能再新增報價或刪除
   - 「工程安排」tab 出現一筆新工種，工種名稱＝比價的工種類別、廠商＝贏家、金額/含稅正確、「報價單」欄位顯示「已提供」
   - 展開該工種的「廠商報價單」區塊，確認贏家原本上傳的報價單圖片出現在裡面
6. 建立第二筆比價需求，不上傳任何報價就直接點刪除，確認整筆消失、不報錯
7. 回到 Task 2、Task 3 的手動驗收項目，各自重跑一次確認沒有因為後續改動而壞掉

- [ ] **Step 4: 部署（需要柏明確說「上線」才能執行）**

先確認以上驗收全部通過。這個 plan 沒有改 `firestore.rules`，用預設指令就好：

Run: `npm run deploy`

**在柏明確表示可以上線之前，不要執行這個指令。** 開發完成後應該先在本地 dev server 或非正式網址讓柏試用確認。
