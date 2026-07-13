# 刪除預估金額 + 簽約金額提醒 + 補休明細 + 工作日誌權限重新設計 Design Spec

**日期**：2026-07-13
**狀態**：已核准，待寫 implementation plan

## 背景與目標

柏在試用完「廠商比價 / 工種選單 / 多施作位置」這批改動後，提出四項新需求，都在同一次討論裡透過多輪釐清問題確認完畢：

1. 案件編輯裡的「預估金額」欄位沒有實際用途，要整個刪除。
2. 「簽約金額」容易忘記填，要在案件狀態進入「施工中」時擋住，強制先補填。
3. 補休面板的「平日補休／休息日補休」只有彙總數字，看不出是哪幾天的加班換算來的，要加一個限管理者專用的明細按鈕。
4. 工作日誌現有的「加班/油資 2 天截止」機制經程式碼核實後其實是**死碼**（見下方「現況診斷」），柏藉這個機會重新設計整套權限：一般日誌內容限「當天」修改（含主管，權限比現況更緊），加班/油資申請則有獨立的「2 天」時間窗，超過 2 天一律需要柏本人核准才算數。

## 一、刪除預估金額（estimatedAmount）

### 現況

`estimatedAmount` 目前出現在：

- `src/components/cases/CaseEditModal.vue`：表單欄位（第 68、178、198、227 行）
- `src/components/cases/AddCaseModal.vue`：新增案件表單（第 61、65、125、157-158 行）
- `src/components/dashboard/StatsSection.vue`：
  - 第 9 行模板：`<StatCard label="進件金額" :value="formatAmount(stats.totalAmount)" />`
  - 第 10 行模板：`<StatCard label="洽談金額" :value="formatAmount(stats.negotiatingAmount)" />`
  - 第 41 行：`totalAmount: all.reduce((s, c) => s + (c.estimatedAmount || 0), 0)`
  - 第 42 行：`negotiatingAmount: all.filter(c => c.status === 'negotiating').reduce((s, c) => s + (c.estimatedAmount || 0), 0)`
- `src/composables/useExport.js` 第 11 行：Excel 匯出「預估金額」欄

### 改動範圍（全部刪除）

- `CaseEditModal.vue`／`AddCaseModal.vue`：移除「預估金額」輸入欄位、`form.estimatedAmount` 相關的初始化／回填／存檔程式碼
- `StatsSection.vue`：移除「進件金額」「洽談金額」兩張 `StatCard`，以及 `totalAmount`／`negotiatingAmount` 這兩個 computed 欄位
- `useExport.js`：移除 Excel 匯出裡的「預估金額」欄位
- **不動**：`signedAmount`（簽約金額）欄位與其所有既有邏輯完全不受影響
- **既有資料**：Firestore 案件文件裡已經存在的 `estimatedAmount` 數值不用特地清除，反正沒有任何畫面會再讀取它，留著不影響任何功能

## 二、簽約金額狀態切換提醒

### 現況

`CaseEditModal.vue` 的 `save()` 函式（第 215-256 行）已經有 `originalStatus.value`（案件開啟編輯視窗當下的原始狀態）跟 `form.value.status`（表單裡選的新狀態）可以比較，且已經在第 239 行用這個比較來判斷要不要寫入 `statusHistory`。

### 新增邏輯

在 `save()` 函式最前面（`if (!form.value.name || saving.value) return` 之後），新增檢查：

```js
if (form.value.status === 'construction' && originalStatus.value !== 'construction' && !form.value.signedAmount) {
    toast('請先填寫簽約金額才能切換為施工中', 'error')
    return
}
```

- 只在「切換進入」施工中時檢查（`originalStatus.value !== 'construction'`），已經是施工中、只是編輯其他欄位存檔時不會重複擋
- 只檢查 `signedAmount` 是否為 0/空，不檢查其他欄位
- 擋下後不會呼叫 `saving.value = true`／不會寫入 Firestore，跟現有其他驗證失敗的處理方式一致（例如 `!form.value.name` 那條）

## 三、補休明細按鈕（限 admin）

### 現況

- `src/components/cases/CompensatoryPanel.vue` 第 20、34 行顯示 `getHours(name, 'compensatoryHours')`／`getHours(name, 'compensatoryHolidayHours')`，這兩個數字直接讀 `users/{uid}` 文件上的累加欄位（`getHours()` 函式，第 101-105 行）
- 累加動作在 `src/stores/workLogs.js` 的 `approveOvertimeItem()`（第 80-106 行）：主管核准一筆加班申請的當下，用 `increment(prevItem.hours || 0)` 把時數加進 `users/{uid}` 對應欄位（`compensatoryHours` 或 `compensatoryHolidayHours`，依 `prevItem.type === '休息日'` 判斷）
- `src/stores/users.js` 的 `ensureMonthClosed()`（第 55-77 行）會在每月第一次異動前，把「上個月」的餘額快照進 `users/{uid}/compClosingBalances/{month}` 後歸零——**代表目前畫面上的累加數字，只反映「這個月」已核准的加班時數**，不是從帳號建立以來的總和
- **結論**：這兩個數字本身不記錄組成明細，要還原明細必須另外查詢 `workLogs` collection

### 新增功能

1. `CompensatoryPanel.vue` 在 `compensatoryHours`／`compensatoryHolidayHours` 數字旁邊，各加一顆「明細」按鈕，用 `v-if="authStore.isAdmin"` 包住（沿用同檔案第 23、37 行已經在用的 `v-if="authStore.isAdmin"` 模式，管理者以外看不到這顆按鈕）
2. 點擊後開一個 modal，查詢 `workLogs` collection 裡：
   - `userId` 等於該員工
   - `date` 落在「本月月初～現在」（因為累加數字每月會被 `ensureMonthClosed` 歸零重算，只需要查本月）
   - `overtimeItems` 裡 `approved === true` 且 `type` 對應（平日補休查 `type !== '休息日'` 的項目、休息日補休查 `type === '休息日'` 的項目）
3. 逐筆列出：日期（`workLogs.date`）、時數（`item.hours`）、加班原因（`item.reason`）
4. 這個查詢用 `src/stores/workLogs.js` 新增一個 `fetchApprovedOvertimeDetail(userId, type, monthStart)` function，回傳陣列，比照現有 `fetchMonthlyOvertimeHours()`（第 133-153 行）的查詢寫法，但改成回傳明細陣列而非加總數字，且限定單一 `userId`

## 四、工作日誌權限重新設計

### 現況診斷（已用程式碼核實，不是猜測）

- **新建日誌**：`src/components/cases/WorkJournalTab.vue` 第 40 行，「+新增」按鈕 `v-if="isToday"` 才顯示——只能建立「今天」的新日誌，且 `openLogForm()`（第 146-149 行）固定 `editingLog.value = null`，送出時 `userId: authStore.user?.uid`（`WorkJournalLogForm.vue` 第 357 行）固定綁自己
- **編輯權限**：`WorkJournalTab.vue` 第 163-166 行 `canEditLog(log)`：
  ```js
  function canEditLog(log) {
      if (authStore.isManager) return true
      return log.userId === authStore.user?.uid && isTodayDate(log.date)
  }
  ```
  主管可以無限期編輯任何人任一天的日誌**全部內容**（不限加班/油資），員工本人只能編輯「今天」的
- **「後天 19:00 截止」死碼**：`WorkJournalLogForm.vue` 第 233-239 行 `isAfterDeadline`：因為新建日誌一定是今天（deadline 算出來永遠在未來，`now >= deadline` 恆為 false），而「+新增」加班/油資子項目的按鈕（第 45、95 行）寫的是 `v-if="!isAfterDeadline || editingLog"`——只要是編輯模式（`editingLog` 有值）就無視 `isAfterDeadline` 直接放行。兩條路徑加起來，這個截止時間從來沒有真的擋過任何人。

### 新規則（柏已確認，兩條規則互相獨立）

**規則 A：一般日誌內容（文字、附件、案件關聯等，不含加班/油資子項目）**

- 不分身分——員工本人或任何主管——都只能在「該篇日誌的 `date` 欄位＝今天」這個條件下編輯一般內容
- 一過隔天 00:00，一般內容永久鎖住，任何人都不能再改
- **行為變更**：現況主管可以無限期修改任何人的日誈內容，這條規則要把主管這個權限也收回，跟員工本人一樣限「當天」

**規則 B：加班/油資申請（獨立的時間窗，跟規則 A 的當天限制脫鉤）**

- 判斷基準：以該筆加班/油資項目所屬日誌的 `date` 欄位，距離「今天」的**自然日天數**計算（不是時間戳記滿 48 小時），例：今天 7/13，該日誌 `date` 是 7/11 算 2 天內（可以自行申請），7/10 算超過 2 天（不行自行申請）
- **2 天內**：日誌本人可以針對自己名下、事發日在 2 天內的日期，新增/修改加班或油資子項目——就算那天完全沒有建立日誌本身，本人在 2 天內一樣可以單獨補建「只承載加班/油資子項目」的日誌（不能連帶補寫一般內容，一般內容仍受規則 A 的當天限制）
- **超過 2 天**：日誌本人完全不能再動加班/油資子項目，必須由**任一主管**（不限特定人）到該員工名下、針對那個日期，補提出加班或油資申請；如果那天連日誌本身都不存在，主管建立的這筆日誌只承載加班/油資子項目，一般內容留空，不需要（也不應該讓主管）補寫
- **審核權限**（判斷式跟「2 天」用同一個基準，不需要額外欄位標記「誰提出的」）：
  - 該筆加班/油資項目所屬日誌的 `date` 距今 ≤2 天：審核權限不變，任一主管都可以核准（維持現況）
  - 該筆加班/油資項目所屬日誌的 `date` 距今 ≥3 天：只有 `authStore.isAdmin` 能核准，其他主管看不到核准按鈕
  - **設計理由**：不用新增「這筆是不是代發」的資料欄位，純粹用日誌日期距今天數當下即時判斷即可決定審核權限——因為柏的規則本身就是「超過兩天的加班申請都要我准」，不分是本人事後偷加還是主管代發，只要日期夠舊，一律需要 admin 核准。這樣資料結構最簡單，也不會有「忘記標記」的風險。

### 具體實作方向

1. **拆分編輯權限判斷**：`WorkJournalTab.vue` 的 `canEditLog(log)` 拆成兩個函式：
   - `canEditGeneralContent(log)`：`isTodayDate(log.date)`（不分身分，一律當天限定）
   - `canEditOvertimeFuel(log)`：`authStore.isManager || (log.userId === authStore.user?.uid && daysSince(log.date) <= 2)`
   - 卡片上的「編輯」按鈕顯示條件改成 `canEditGeneralContent(log) || canEditOvertimeFuel(log)`（兩者其一即可開啟表單）

2. **表單依權限分區塊鎖定**：`WorkJournalLogForm.vue` 收到 `editingLog` 後，內部判斷 `canEditGeneralContent`／`canEditOvertimeFuel` 兩個旗標（透過 prop 或 emit 傳入，或表單自己重算一次），一般內容欄位（文字、附件、案件關聯）用 `canEditGeneralContent` 控制是否唯讀，加班/油資的「+新增」按鈕用 `canEditOvertimeFuel` 控制是否顯示——取代現有寫死的 `isAfterDeadline`／`editingLog` 判斷式

3. **新增「主管代發」建立能力**：`WorkJournalTab.vue` 新增一個限主管可見的入口（例如原本「+新增」按鈕旁，或另一顆「+ 幫同事補加班/油資」按鈕，`v-if="authStore.isManager"`，不受 `isToday` 限制），點擊後：
   - 跳出員工選單（從 `usersStore.users` 選一位同分區的員工）
   - 跳出日期選擇（可選過去日期，不限今天）
   - 選定後，如果該員工當天已經有日誌，直接開啟「加班/油資限定模式」的編輯表單（複用步驟 2 的鎖定機制，因為此時 `canEditGeneralContent` 對主管來說也會是 false，一般內容自動鎖住，只剩加班/油資可以動）
   - 如果當天沒有日誌，建立一筆新文件——欄位比照 `WorkJournalLogForm.vue` 第 356-366 行現有的 `logDoc` 組法（`userId`、`userName`、`companyId`、`date`，`caseEntries`／`otherItems`／`logAttachments` 這些一般內容欄位因為是選填、值為空就不會加進物件，所以只要不填就會自然省略，不需要額外處理），然後開啟同一個「加班/油資限定模式」表單讓主管填加班/油資項目

4. **審核按鈕權限**：`WorkJournalLogCard.vue` 目前 `isManager` prop 控制核准按鈕顯示（第 59、116 行附近）。改成：核准按鈕的顯示條件從單純 `isManager` 改成 `daysSince(log.date) <= 2 ? isManager : isAdmin`（每個加班/油資項目共用同一個日誌的 `date`，所以整篇日誌的核准權限一致，不用逐項目判斷）

5. **`daysSince(date)` 共用函式**：新增一個小型純函式（例如 `src/utils/workJournalDeadline.js`），輸入日誌的 `date`，輸出距今自然日天數（比較日期部分，忽略時分秒，用台北時區——比照 `src/stores/users.js` 已經在用的 `monthStr()` 那套 `toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })` 手法取當天日期字串再比較），這個函式會被 `WorkJournalTab.vue`（編輯權限判斷）跟 `WorkJournalLogCard.vue`（核准權限判斷）共用，取代目前分散、不一致的 `isTodayDate`／`isAfterDeadline` 邏輯

### 不在這次範圍內

- 補休累計數字（`compensatoryHours`／`compensatoryHolidayHours`）的計算/累加機制本身不變，只有審核權限的判斷式跟「誰能編輯」有變動
- 不新增任何 Firestore rules 的變動（跟廠商比價那批一樣，現有的角色檢查都是前端 UI 層擋，這次也維持這個慣例）
- 舊資料（已經存在、超過 2 天且審核狀態是 `approved: null` 待審的加班項目）不需要額外遷移，新規則上線後，這些項目會自動落入「超過 2 天只有 admin 能核准」的判斷式，柏會看到這些項目換人審核，這是預期內的行為

## 測試策略

- Vitest：`daysSince()`／`canEditGeneralContent`／`canEditOvertimeFuel` 三個純邏輯函式的單元測試（邊界值：剛好 2 天、剛好 3 天、今天、跨月）
- Vitest：`fetchApprovedOvertimeDetail()` 用 mock firestore 測試正確過濾 `approved === true` 與 `type` 對應
- Vitest：`CaseEditModal.vue` 的 `save()` 新增的簽約金額擋下邏輯（純函式抽出來測，或至少確認擋下時不會呼叫 `updateCase`）
- 手動驗收：
  - 案件編輯移除預估金額後，Dashboard、Excel 匯出都不再出現這個欄位，既有資料不受影響
  - 案件狀態切換到施工中、簽約金額空白時被擋下，填了金額後可以正常切換
  - 補休明細按鈕限 admin 可見，點開明細數字加總要等於面板上顯示的累計數字
  - 工作日誌：當天可以自由編輯內容+加班/油資；隔天之後一般內容鎖住、但本人 2 天內還是能補加班/油資；第 3 天起本人完全不能碰，主管可以補建/補加；核准按鈕在 2 天內任一主管可按、第 3 天起只有 admin 看得到

## 部署方式

跟廠商比價那批一樣：開發完成後在本地/測試環境給柏試用，這批加上先前已完成但尚未上線的「廠商比價／工種選單／多施作位置」，等柏這邊全部確認沒問題、明確說「上線」才會一起執行 `npm run deploy`。
