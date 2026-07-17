# 季度獎金統計

日期：2026-07-17
狀態：待柏審閱

## 背景 / 問題

柏提供了一份 Excel（`獎金.xlsx`）記錄奈拾設計四個角色（業務／設計師／工務／行政）的獎金發放標準，目前完全沒有系統化，柏想把季度獎金試算搬進管理系統，跟薪資單一樣只有他自己能操作。

Excel 原始內容本身有多處模糊（比例是區間不是固定數字、級距表只列到 250~300 萬、質化條件沒說怎麼判定、行政的統計基準是月不是季），已透過 brainstorming 逐項跟柏確認，本文件記錄確認後的最終邏輯。

## 目標

- 每季（4 個月一次，1-3月/4-6月/7-9月/10-12月，以案件「完工日期」為基準）試算業務／設計師／工務／行政四個角色的獎金
- 業務、設計師、工務的獎金綁定個別案件；行政的獎金綁定公司整體季度進件量／簽約量，不綁案件
- 只有 admin（柏）能讀寫這份資料，其他員工完全看不到
- 支援「已發放」標記＋操作紀錄，避免重複發放、可回溯歷史

## 不做的事

- 不做頁面視覺／版面配置（柏要求邏輯談完才規劃頁面，這份 spec 只定功能範圍與資料流程，UI 排版留到下一輪 brainstorming）
- 不補建上線前就已經是「已完工」狀態的舊案件資料，季度統計只算上線後新完工的案件
- 不改動一般案件編輯（`CaseEditModal.vue`／`AddCaseModal.vue`）——業務相關的新欄位（設計約/工程約金額、三角色負責人、工務雜支）全部只在獎金統計頁面本身編輯，不動案件既有欄位與權限
- 不做團隊獎金的計算公式——四個角色的「團隊獎金」都只是一個手動輸入的金額欄位，沒有自動邏輯
- 不做行政獎金門檻的具體數字（10件/20件的季度換算版本）——柏之後再提供，這次先讓門檻數字是頁面上可編輯的欄位，不寫死
- 不做多分區（south/north/central）獨立統計——沿用案件既有的 companyId 顯示，但獎金試算邏輯不分區處理
- 不做大型案件（金額遠超過 300 萬，例如商業空間等級量體）的獎金上限或替代算法——設計師/工務級距公式目前會無上限地依「每 50 萬遞增」外推，柏之後會另外討論大型案件要不要獨立訂規則，這次先不處理

## 設計

### 資料模型

**`cases/{id}` 新增一個欄位：**
- `completedAt`（Timestamp，選填）：案件狀態轉為 `completed` 時，由 `casesStore.updateCase()` 自動寫入 `serverTimestamp()`。目前有兩個地方會把狀態改成 `completed`（`GanttTab.vue` 的完工按鈕、`CaseEditModal.vue` 的狀態下拉），兩邊都呼叫同一個 `updateCase()`，所以只要在 store 層集中判斷「這次更新的 status 是 completed 且原本不是」就能兩邊一起涵蓋，不用各自加邏輯。這個欄位不含金額，沿用案件既有的讀取權限（所有登入員工可讀），不算保密資料。

**新 collection：`caseBonusData/{caseId}`**（文件 ID＝案件 ID，Firestore rules 限 `role == 'admin'` 讀寫）：
```
designContractAmount       number，選填，預設 0——設計約金額
constructionContractAmount number，選填，預設 0——工程約金額
salesPersonIds[]           string[]，業務負責人（可複選，users collection 的 uid）
salesSplit                 { [uid]: number }，業務獎金分比，預設均分，總和須為 100
designerIds[]               string[]，設計師負責人（可複選）
designerSplit               { [uid]: number }
siteManagerIds[]            string[]，工務負責人（可複選）
siteManagerSplit            { [uid]: number }
miscExpenses                number，選填，預設 0——工務雜支（計算利潤率用）
qualitativeChecks           { sales: {簽約:bool, 案件資訊:bool, 交接:bool},
                               designer: {丈量:bool, 提案:bool, 設計:bool, 收款:bool, 廠商發票:bool},
                               siteManager: {品質:bool, 進度:bool, 無客訴:bool, 無追加錯誤:bool, 收尾驗收:bool} }
notes                        string，選填，自由輸入備註，畫面渲染時做 HTML escape
updatedAt, updatedBy
```
只有柏會填這份資料，所以每個案件只有一份（不分季度存放），季度試算當下即時讀取。

**新 collection：`bonusQuarters/{quarter}`**（文件 ID 格式 `2026-Q3`，Firestore rules 限 admin 讀寫）：
```
period            { startMonth, endMonth, year }
caseIds[]          該季完工且已判定資格的案件 ID 清單（快取用，方便重新打開頁面時不用重查一次全部案件）
entries[]          [{ role, personId, personName, caseId?, breakdown, suggestedAmount, finalAmount, paid, paidAt, paidBy }]
adminTarget        { leadCount, signedCount, leadThresholds:[{count,amount}], signedBonusPerCase, assignedToUid, assignedToName }
teamBonus          { sales:number, designer:number, siteManager:number, admin:number }
createdAt, lastCalculatedAt, lastCalculatedBy
```
`entries[].paid = true` 的項目視為鎖定，重新試算（`lastCalculatedAt` 更新）時不覆蓋已標記 `paid` 的 entry，只更新未發放的部分。

### 計算邏輯（純函式，抽到 `src/utils/bonusCalc.js`）

**業務**：`salesBonus = designContractAmount * 0.04 + constructionContractAmount * 0.0125`（4%／1.25% 為區間中點，固定寫死當預設值，不吃 5% 管銷扣除）。資格：`signedAmount > 500000`。

**設計師 / 工務**：資格 `signedAmount > 500000`。級距：`tier = Math.ceil((signedAmount - 500000) / 500000)`（最小 1），設計師 `suggestedAmount = tier * 3000`，工務 `suggestedAmount = tier * 5000`。級距採「大於下限、小於等於上限」認定（例如 50~100 萬指 >50萬 且 ≤100萬），300 萬以上依同樣級距公式繼續遞增，不封頂。**這是本次確認後的假設，如果柏原本認定的級距邊界不同（例如剛好 100 萬算哪一級），spec review 時請指出。**

**工務利潤率門檻**：`profit = signedAmount * 0.95 - sum(workTypes[].vendorCostItems 加總) - miscExpenses`，`profitMargin = profit / signedAmount`。`profitMargin < 0.25` 時，工務建議金額強制為 0（不管級距算出多少），畫面標紅顯示「利潤率未達 25%」。

**行政**：不綁案件，季度進件量／簽約量門檻數字由柏在頁面上手動填（`adminTarget.leadThresholds`），系統依填入的門檻對照當季實際數字算出建議金額；每季手動指定 `assignedToUid` 決定發給誰。

**團隊獎金**：四角色皆為 `bonusQuarters/{q}.teamBonus.{role}`，純手動輸入，無公式。

**質化條件**：`caseBonusData.qualitativeChecks` 純記錄勾選狀態，畫面上顯示但不影響 `suggestedAmount` 計算，也不阻擋發放操作。

**多人分帳**：`salesPersonIds` 等陣列有多人時，`suggestedAmount` 依 `salesSplit` 百分比拆給每個人，各自成一筆 `entries[]`；`salesSplit` 未手動調整時預設均分（`100 / 人數`，四捨五入到整數，最後一人吃差額避免總和不是 100）。

**最終金額**：`finalAmount` 預設等於 `suggestedAmount`，四個角色都可以在畫面上直接改成別的數字，改過的會跟 `suggestedAmount` 一起存，方便回頭比對系統建議值跟實際發放值的差異。

### 已發放流程

- 逐筆或整批把 `entries[].paid` 設為 `true`，同時寫入 `paidAt`（`serverTimestamp()`）、`paidBy`（目前登入者，也就是柏）
- 已標記 `paid` 的 entry，`finalAmount` 鎖定不能再改，除非先取消勾選
- 比照零用金系統：Firestore 寫入用 transaction 包住 read-then-write，避免柏自己開兩個分頁同時操作同一季資料時互相覆蓋

### 權限與安全

- Firestore rules：`caseBonusData`、`bonusQuarters` 兩個 collection 讀寫都限 `request.auth.token.role == 'admin'`（比照 `leaveRecords` 現有寫法）
- 路由：新增 `/bonus`，`meta: { requireAdmin: true }`（比照 `/payslip`）
- `cases.completedAt` 沿用案件既有的讀取權限，不算敏感欄位
- 唯一的自由文字輸入是 `caseBonusData.notes`，畫面顯示時做跳脫處理，不會被當 HTML/程式碼執行
- 多人同時操作：功能本身限定只有柏一人有權限進入，不存在多員工併發修改的情境；柏自己開兩個分頁同時改同一季資料的邊界情況，靠 Firestore transaction 避免互相覆蓋（見上一節）

## 既有資料相容性

- 目前所有案件都沒有 `completedAt`、也沒有對應的 `caseBonusData` 文件，讀取時視為「尚未填寫」，不影響案件本身任何既有功能
- 不需要寫遷移腳本

## 測試

- `bonusCalc.js` 抽出的純函式寫 vitest 單元測試，覆蓋：50 萬門檻邊界（剛好 50 萬 / 50萬01元）、級距邊界（100萬/150萬等整數關卡）、300 萬以上遞增、利潤率剛好 25% / 24.99%、多人分帳金額加總誤差處理
- 頁面操作用真實瀏覽器 + 正式 Firestore 端到端驗證（建測試案件、測完清除），不做 component-mount 測試（沿用專案既有慣例）
- 驗證重點：完工日期落在指定季度區間內外的案件是否正確納入/排除、業務金額拆兩筆計算是否正確、工務利潤率低於 25% 是否強制歸零、多人負責角色分帳總和是否等於建議金額、已發放鎖定後 finalAmount 是否真的無法再改
