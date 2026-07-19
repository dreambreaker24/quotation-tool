# 鈺潤軒網頁版管理系統 — Phase 1 設計文件

## 背景與目標

鈺潤軒（鉑澐企業有限公司）是柏與柯其宏共同經營的養生飲品品牌，目前用 Excel（`鈺潤軒營運表單_v2.xlsx`，8 個工作表：每日生產、原料進貨、包材進貨、報廢紀錄、庫存總覽、月報彙整、配方表、廠商資料）記帳與管理庫存。

柏想建立網頁版管理系統，取代 Excel，讓他能全面掌握店面經營狀況：開店已知支出的五年攤提試算、庫存管理、訂單提醒（LINE 通知）、進銷存、每月支出、每日收入。

## 範圍分階段

需求包含多個子系統，經與柏確認分兩階段：

- **Phase 1（本次設計範圍）**：開店支出攤提試算、庫存管理／進銷存（含配方自動扣庫存）、每月固定支出、每日收入記錄。這是每天都要用、資料量最大的核心財務庫存模組。
- **Phase 2（本次不開發，資料模型已預留欄位）**：LINE 訂單提醒，包含（a）原料/包材庫存低於安全庫存時提醒補貨、（b）客戶訂單處理期限提醒。需要串接 LINE Messaging API（LINE Notify 已於 2025 年停用），細節留待 Phase 2 另外設計。

## 使用者與權限

- **owner**（柏、柯其宏）：全存取，含所有財務報表、支出攤提、庫存成本、毛利分析
- **employee**（店員）：只能使用「每日輸入」頁面登記生產／收入／進貨三種表單；在庫存總覽只能看到庫存「數量」，看不到成本相關金額欄位（前端隱藏＋ Firestore rules 後端擋讀取，非僅 UI 層防範）
- 帳號綁定方式比照奈拾管理系統：先用 email 建立 `users` 文件並指定 `role`，柏提供 email 清單後，使用者第一次 Google 登入時自動綁定 UID

## 使用情境

- 手機與電腦兩種裝置都需要重度優化的響應式體驗（非其中一種將就使用）：
  - 「每日輸入」頁面（生產／收入／進貨）以手機操作為主，單欄大按鈕表單，方便店員站著輸入
  - 儀表板／庫存／支出攤提等報表頁以電腦操作為主，多欄卡片＋表格，善用大螢幕空間
  - 採 Tailwind `sm:` 斷點做響應式切版，不做兩套獨立程式碼

## 技術架構

- 新資料夾 `yurunxuan-system`，與 `naiship-system` 同層（`C:\AI助理 Claude\yurunxuan-system`）
- 全新獨立 Firebase 專案（Auth + Firestore + Storage + Hosting），**不與奈拾系統共用**——鈺潤軒是完全不同的公司實體，混用會有跨公司資料誤讀風險
- 技術棧：Vue 3 + Vite + Tailwind CSS + Pinia，比照奈拾管理系統已驗證可行的架構

## Firestore 資料模型（Phase 1）

### `expenseItems/{id}` — 開店支出攤提項目
- `name`、`amount`、`category`
- `amortizeMonths`（每項可自訂，預設 60 個月＝5 年）
- `startDate`
- `monthlyAmount`（= amount / amortizeMonths，寫入時算好存值，報表直接加總，不現算）

### `recipes/{drinkId}` — 配方表
- `name`（潤雪飲／潤澤飲／潤潤飲）
- `ingredients[]`：`{ materialId, materialName, qtyPerUnit, unit }`

### `materials/{id}` — 原料／包材主檔
- `name`、`unit`、`category`（原料／包材）
- `currentStock`（唯一真相，即時反映所有生產／進貨／報廢紀錄的加總結果）
- `safetyStock`（Phase 2 補貨提醒用，Phase 1 先建欄位不啟用推播邏輯）
- `vendorId`

### `vendors/{id}` — 廠商資料
- `name`、`contact`、`phone`、`category`

### `productionLogs/{id}` — 每日生產紀錄
- `date`、`drinkId`、`qty`、`recordedBy`、`createdAt`
- 寫入時用 Firestore `runTransaction`，依 `recipes` 配方同步扣 `materials.currentStock`

### `purchaseLogs/{id}` — 進貨紀錄
- `date`、`materialId`、`qty`、`unitCost`、`vendorId`、`recordedBy`
- 寫入時用 `runTransaction` 加 `materials.currentStock`

### `wasteLogs/{id}` — 報廢紀錄
- `date`、`materialId` 或 `drinkId`、`qty`、`reason`、`recordedBy`
- 寫入時用 `runTransaction` 扣對應庫存

### `revenueLogs/{id}` — 每日收入
- `date`、`amount`、`paymentMethod`（現金／轉帳／LINE 支付等）、`note`、`recordedBy`
- 同一天允許多筆紀錄（不同付款方式各自登記），不覆蓋，報表用加總

### `monthlyExpenses/{id}` — 每月固定支出
- `date`（月份）、`category`（房租水電／人事／行銷廣告／其他，可自訂新增分類）、`item`、`amount`

### `users/{uid}`
- `role`（owner／employee）、`name`、`email`

### Phase 2 預留（本次不實作邏輯，僅规劃）
- `customerOrders/{id}`：客戶訂單，出貨／製作期限到時觸發 LINE 通知

## 頁面規劃

| 頁面 | 元件 | 權限 | 內容 |
|------|------|------|------|
| 登入 | LoginView | 公開 | Google 登入 |
| 首頁儀表板 | DashboardView | owner only | 本月營收、本月支出（含攤提）、本月毛估損益、低庫存警示卡（Phase 1 顯示但不推播） |
| 每日輸入 | DailyEntryView | owner + employee | 生產／收入／進貨三個表單，手機版預設開這頁 |
| 庫存總覽 | InventoryView | owner 全欄位；employee 只看數量 | 原料/包材庫存清單、報廢登記 |
| 支出攤提 | ExpenseAmortizationView | owner only | 開店支出項目清單＋新增/編輯，自動算月攤提 |
| 每月支出 | MonthlyExpenseView | owner only | 固定開銷登記與分類報表 |
| 配方/廠商設定 | SettingsView | owner only | 配方表、廠商資料維護 |

## 現有資料遷移

`鈺潤軒營運表單_v2.xlsx` 裡已有真實運行資料（庫存量、配方、廠商資料），上線時需要把這些資料匯入新系統的對應 collection（`materials`、`recipes`、`vendors`），不用重新盤點。上線後改為在網頁系統中手動輸入／編輯，Excel 停用。

## 多人同時操作處理

- **同時登記生產**：庫存扣除用 Firestore `runTransaction`，不是「先讀庫存再寫回」，確保同一時間只有一個扣庫存操作生效，避免兩人同時登記時少扣一次
- **同時登記收入**：`revenueLogs` 設計為一天多筆紀錄而非覆蓋單一數字，不會互相蓋掉
- **同時編輯支出攤提項目**（owner 間低頻操作）：不做樂觀鎖，最後寫入者為準，比照奈拾系統案件編輯邏輯，風險低

## 資安：使用者輸入處理

- Vue 模板語法預設自動跳脫（escape）顯示文字，系統全程不使用 `v-html`（無富文字輸入需求），自訂支出分類名稱、備註等自由文字輸入不會有 XSS 風險
- Firestore Security Rules 在後端驗證資料型別與必要欄位（例如 `amount` 必須是數字、`role` 欄位使用者不能自行竄改），不只靠前端限制

## 測試策略

比照奈拾管理系統慣例：
- 純函式邏輯（攤提試算、配方扣庫存計算）用 vitest 單元測試，抽到 `src/utils/`
- Vue 元件用瀏覽器手動走過完整流程驗證（或 Playwright），不特別為元件搭 component-mount 測試基礎設施
