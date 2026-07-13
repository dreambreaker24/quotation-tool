# 廠商比價功能 + 工種選單簡化 + 同工種多施作位置 Design Spec

**日期**：2026-07-13
**狀態**：已核准，待寫 implementation plan

## 背景與目標

現況：案件詳情頁「工程安排」tab 底下的 `WorkTypePanel.vue`，新增工種時工種類別可以從固定清單選、也可以「自訂」手動輸入；廠商固定要從廠商管理裡已建檔的資料選。柏提出三個需求：

1. 工種還沒確定廠商時，希望能讓多家廠商各自上傳報價單＋預估金額，讓主管比價後才定案，而不是像現在只能直接指定一家廠商。
2. 同一個廠商的同一個工種，可能會在案場裡好幾個不同地方施作，各地方的進場/完工日期不同，希望能記錄這些「施作位置」的個別日期，同時保留一個總進場/總退場日期。
3. 工種選單要拿掉「自訂」功能，工種跟廠商都只能從後台已經建立好的清單/資料選，不能手動輸入新名稱。

## 架構總覽

```
cases/{caseId}
├── workTypes[]              現有陣列，正式施工中的工種（不動舊邏輯）
│     └── locations[]        【新增】同工種多施作位置
├── bidRequests/{bidId}      【新增子集合】比價需求
│     └── bids[]             各廠商報價
└── photos/{photoId}         現有子集合，報價單存這裡（type: 'bid_quote'）
```

比價是「工程安排」tab 前面的獨立新 tab。比價資料（`bidRequests`）跟正式工種資料（`workTypes`）生命週期完全分開，直到主管確認贏家才「轉正」變成 `workTypes` 裡的一筆正式資料。轉正後，甘特圖（`GanttTab.vue`）、付款提醒等既有邏輯完全不用改，因為它們只讀 `workTypes`。

### 為什麼不把比價塞進現有 `workTypes` 陣列

考慮過三個方案：

- **方案 A**：在 `workTypes` 陣列裡加 `status: 'bidding' | 'confirmed'` 欄位，比價資料跟正式資料混在同一個陣列。改動最小，但甘特圖、付款提醒等現有邏輯都要額外判斷跳過 bidding 狀態的項目，散落的判斷點一多容易漏改出 bug。
- **方案 B（採用）**：獨立子集合 `bidRequests`，確認贏家後才在 `workTypes` 新增正式資料，原比價記錄標記 `converted: true` 保留歷史。資料生命週期分離，不影響任何既有功能，開發量比方案 A 大一些但風險最低。
- **方案 C**：資料分離但共用 `WorkTypePanel.vue` 的表單元件。可以少寫一點重複程式碼，但 `WorkTypePanel.vue` 已經是專案裡數一數二肥的元件，硬塞比價模式進去會讓維護風險變高。

選定方案 B：乾淨分離，不影響已上線功能。

## 資料結構

### `cases/{caseId}/bidRequests/{bidId}`（新集合）

```js
{
  id: string,
  category: string,              // 工種類別，從 constants/workCategories.js 固定 18 種選
  note: string,                  // 比價需求說明（選填，例如「浴室防水兩間」）
  status: 'open' | 'converted',  // 開放比價中 / 已確認贏家轉正
  createdBy: string,
  createdAt: Timestamp,
  bids: [
    {
      id: string,
      vendorId: string,          // 必須是 vendors collection 裡已建檔的廠商，不能自訂
      vendorName: string,
      quoteAmount: number,
      includesTax: boolean,      // 含稅／未含稅
      note: string,
      quotePhotoIds: [string],   // 對應 photos 子集合裡上傳的報價單文件 id
      submittedBy: string,
      submittedAt: Timestamp,
    }
  ],
  winningBidId: string,          // 確認贏家後填入，對照 bids[] 裡的 id
  convertedWorkTypeId: string,   // 轉正後對應的 workTypes[].id，供回溯查詢
}
```

### `workTypes[]` 陣列（`cases/{caseId}.workTypes`）新增欄位

```js
{
  // ...現有欄位（id, name, vendorId, vendorName, startDate, endDate,
  //     hasQuote, hasSchedule, vendorCostItems, vendorCostFree,
  //     costIncludesTax, color, vendorPayments, done, invoiceReceived）不動

  locations: [
    { id: string, label: string, startDate: string, endDate: string, note: string }
  ]
}
```

`startDate`/`endDate`（總進場/總退場）維持現況，一樣手動填寫，不做自動彙總計算。`locations` 是純附加欄位，舊資料沒有這個欄位時顯示空清單即可，不影響任何既有畫面。

## 權限與操作流程

1. **建立比價需求／上傳報價**：任何能進案件詳情頁的人都能操作，跟現有新增工種一樣沒有角色限制（方便工地人員協助收集報價）。
2. **確認贏家**：限 admin 或該案件所屬分區的 manager。確認動作觸發：
   - 在 `workTypes` 陣列新增一筆正式工種：`name` = `bidRequest.category`、`vendorId`/`vendorName` = 贏家廠商、`vendorCostItems` 帶入贏家的 `quoteAmount`、`costIncludesTax` = 贏家的 `includesTax`、`hasQuote: true`
   - 贏家報價單的 `photos` 文件，`workTypeId` 欄位改指向新建立的工種 id（不重複上傳檔案，只改關聯）
   - 該 `bidRequest` 標記 `status: 'converted'`、`winningBidId`、`convertedWorkTypeId` 寫入
3. **取消比價**：確認贏家前可以直接刪除整筆 `bidRequest`（含底下所有報價記錄與上傳的報價單），跟現有刪除工種的模式一致。
4. 不設比價截止日期。同一個工種類別在同一案件裡可以建立多筆 `bidRequest`（例如要重新比價，直接再開一筆新的）。

## 工種選單簡化

`WorkTypePanel.vue`：
- 移除 `<option value="__custom__">自訂…</option>` 與對應的自訂名稱輸入框
- `onCategoryChange()` 簡化，只從固定清單帶值，不再處理 `__custom__` 分支
- **既有資料相容性**：舊資料若有透過「自訂」功能存的非標準工種名稱，編輯時下拉選單選不到對應項目。改成：偵測到 `name` 不在 `WORK_CATEGORIES` 清單內時，顯示唯讀提示文字「舊資料：{原名稱}（不在標準清單內）」＋ 一顆「改選標準分類」按鈕，點了才切換成正常下拉選單。不會讓資料消失或存檔報錯。
- 動手前先掃一次現有案件資料，回報有幾筆這種舊自訂資料，讓柏知道影響範圍

廠商欄位維持現況不動（原本就只能從廠商管理已建檔資料選，沒有自訂選項）。

## 甘特圖與付款提醒的相容性

- **甘特圖（`GanttTab.vue`）**：只讀 `workTypes`，不會看到 `bidRequests`（比價中的項目不會出現在甘特圖上）。`locations` 欄位也不影響甘特圖渲染，畫圖依然用工種本身的 `startDate`/`endDate`。
- **付款提醒**：邏輯讀 `vendorCostItems`/`vendorPayments`，跟 `bidRequests`、`locations` 都無關，不用改。

## 測試策略

- Vitest：比價確認轉正的資料轉換函式——金額、含稅旗標、報價單 `workTypeId` 正確搬移；`bidRequest` 正確標記 `converted` 並寫入 `winningBidId`/`convertedWorkTypeId`
- Vitest：工種選單非標準名稱的 fallback 顯示邏輯，確認不報錯、資料不遺失
- 手動驗收：
  - 建立比價需求 → 多廠商上傳報價（含稅/未稅都測）→ 確認贏家 → 確認正式工種正確生成、甘特圖顯示正常、報價單檔案關聯正確
  - 刪除未確認的比價需求，確認資料與檔案一併清除
  - 多施作位置新增/刪除，確認不影響甘特圖與付款提醒
  - 拿掉自訂選項後，新增工種與編輯既有（含舊自訂資料）工種都正常

## 部署方式

開發完成後在本地/測試環境給柏試用，確認沒問題、柏明確說「上線」才執行 `npm run deploy` 到正式環境。過程中不自行決定上線。
