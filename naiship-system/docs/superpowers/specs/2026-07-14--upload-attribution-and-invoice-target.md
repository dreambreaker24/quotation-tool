# 上傳者顯示 + 發票開立對象

## 背景

兩個獨立小功能，一起規劃、分開實作：

1. 系統內上傳的檔案（照片/PDF）目前只顯示上傳時間，看不出是誰上傳的。
2. 工種安排的「確認發票」按鈕旁，需要讓員工能標記這筆工程的發票該開給「奈拾」還是「柏延」，方便通知廠商。

## 功能一：上傳檔案顯示上傳人員

### 現況

`uploadedBy`（上傳者 Firebase uid）已經在 4 個寫入點被存進 `cases/{caseId}/photos` 子集合：
- `WorkTypePanel.vue`（`wt_construction`、`vendor_quote` 兩種類型）
- `PhotoUpload.vue`（通用 `typeKey`）
- `BidRequestPanel.vue`（`bid_quote`）

但讀取端（3 個檔案、5 處縮圖網格）在把 Firestore 文件轉成畫面用的本地陣列時，都把 `uploadedBy` 欄位丟掉了，所以從未顯示。`BidRequestPanel.vue` 甚至連 `createdAt` 都沒保留，時間也沒顯示。

系統裡已有既定的 uid → 姓名解析寫法（例：`WorkJournalLogCard.vue`、`CaseTasks.vue`、`DashboardNoteBoard.vue`）：
```js
usersStore.users.find(u => u.id === uid)?.name
```

### 修改範圍

| 檔案 | 位置 | 修改內容 |
|---|---|---|
| `PhotoUpload.vue` | 3 個縮圖網格（資料夾內／未分類／無資料夾） | 載入時保留 `uploadedBy`；模板時間旁加顯示姓名 |
| `WorkTypePanel.vue` | 廠商報價縮圖網格 | 同上 |
| `WorkTypePanel.vue` | 施工照片縮圖網格（含資料夾/flat 兩種視圖） | 同上 |
| `BidRequestPanel.vue` | 廠商報價縮圖網格 | 載入時補回 `createdAt` + `uploadedBy`；模板新增時間＋姓名顯示（此處目前完全沒有時間顯示） |

### 顯示方式

沿用各檔案現有的 `formatTime()` 時間格式，時間後面用 `·` 分隔加上姓名：

```
7/14 15:02 · 昆霖
```

姓名解析：`usersStore.users.find(u => u.id === item.uploadedBy)?.name ?? '未知'`。

### 不做的部分

- 不建立共用的 Gallery 元件（三個檔案是各自獨立實作，這次只做最小修改，不做架構重構）。
- 不補歷史資料——`uploadedBy` 是 uid 存在才顯示得出來，本來就有寫入，舊資料應該都能正確顯示；若真的是 `'unknown'`（舊到欄位還沒上線前的資料），顯示「未知」。

## 功能二：工種發票開立對象（奈拾／柏延）

### 資料結構

`workTypes` 陣列每個工種項目新增欄位：

```js
invoiceTarget: 'naiship' | 'boyan' | null  // 預設 null（未選）
```

跟既有的 `invoiceReceived` 用同一套持久化方式：`casesStore.updateCase(caseId, { workTypes: updated })`（整個 `workTypes` 陣列覆寫，不是單一子文件）。選項固定兩個，跟零用金表單（`PettyCashForm.vue`）的 `naiship`/`boyan` 兩個值保持一致，未來如果要擴充公司只改這一份清單。

### UI

**顯示時機**：跟「確認發票」按鈕同一個 `v-if` 條件（`wt.done && wtVendorCostTotal(wt) > 0 && !wt.vendorCostFree`），加在按鈕列（確認發票／記錄付款／編輯）下方一行。

**互動**：兩個並排小按鈕「奈拾」「柏延」，點選其中一個立即高亮並儲存（不開彈窗），互動風格比照現有「確認發票」按鈕（點擊即切換狀態、無需額外確認）。

**卡片標籤**：
- 已選擇：顯示常駐標籤「開立：奈拾」或「開立：柏延」（沿用卡片上其他小標籤的樣式，例如淺色圓角 pill）。
- 未選擇：顯示提醒樣式標籤（例如橘/紅色）「未選開立對象」，提示員工還沒填寫——因為這是必選項目，目的是避免漏填。

**權限**：`WorkTypePanel.vue` 裡「確認發票」「記錄付款」「編輯」都沒有角色限制，開立對象選擇同樣開放給所有登入使用者，不額外加權限檢查。

### 不做的部分

- 不做自動通知廠商（簡訊/LINE/email）——系統目前完全沒有對廠商的自動通知管道，這個標籤純粹是給員工自己看、自己去告知廠商用的。
- 不影響零用金表單既有的 `naiship`/`boyan` 選項邏輯，兩處各自獨立、只是共用相同的值域。
- 不追溯舊資料——既有工種項目的 `invoiceTarget` 預設是 `undefined`/`null`，一律視為「未選」，顯示提醒標籤，需要時由員工手動補選。

## 測試策略

- 功能一：針對 3 個檔案各補一筆存在 `uploadedBy` 的假資料，驗證畫面渲染出正確姓名；`uploadedBy` 對應不到任何使用者時顯示「未知」。
- 功能二：驗證 `invoiceTarget` 切換兩個選項互斥（選奈拾不會同時顯示柏延）、切換會呼叫 `updateCase` 且只覆寫該工種項目；未選擇時提醒標籤正確顯示，已選擇時提醒標籤消失、常駐標籤正確顯示對應公司名稱。
