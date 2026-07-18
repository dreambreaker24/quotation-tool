# 團隊獎金重新設計：從「每季四角色」改成「每案分享」

日期：2026-07-18
狀態：待柏審閱

## 背景 / 問題

季度獎金統計功能（見 `docs/superpowers/specs/2026-07-17--quarterly-bonus-statistics.md`）上線後，柏在試用版實測時發現「團隊獎金」目前的設計（`bonusQuarters/{quarter}.teamBonus` 四個角色各一個季度層級的手動數字欄位，跟案件無關、不進發放彙總表）不符合他要的邏輯。柏的原話：「團隊獎金我希望邏輯是執行案件的團隊，比如說一案執行成功，參與這個案子的業務、設計師、工務都可以share這筆獎金」。

## 目標

- 團隊獎金改成綁「每個案件」，不再綁季度
- 每個案件由柏手動填一個團隊獎金總額，系統自動找出這個案件的所有參與人（業務+設計師+工務三個角色的所有負責人，同一人身兼多角色只算一份），依既有的 `splitBonus()` 邏輯分配（預設均分、可手動調整每人百分比）
- 每個參與人分到的金額比照業務/設計師/工務三種角色，逐筆進「本季發放彙總」表格，可個別標記已發放並鎖定

## 不做的事

- 不對團隊獎金設任何金額公式或資格門檻（不受簽約金額 > 50 萬限制）——柏想填多少都可以，這是他的主觀獎勵決定
- 不處理已經在測試階段透過舊版 UI 存進 `bonusQuarters/{quarter}.teamBonus` 的殘留資料——程式碼不再讀寫這個欄位，Firestore 裡如果有殘留值也不會自動清除，純粹是不影響功能的孤兒欄位（`setDoc` 用 `merge:true`，拿掉程式碼裡的欄位不會反向刪除 Firestore 已存的資料）
- 不處理「案件完全沒指定任何角色負責人」時團隊獎金要怎麼辦——維持跟其他角色一致的既有邏輯：沒有參與人就不產生任何 entry，金額欄位還是可以填，只是暫時沒人可分

## 設計

### 資料模型

**`caseBonusData/{caseId}` 新增兩個欄位**：
```
teamBonusAmount   number，選填，預設 0——這個案件的團隊獎金總額，柏手動填
teamBonusSplit    { [uid]: number }，選填，預設 {}——分帳百分比，不填就均分（沿用 splitBonus() 既有邏輯）
```

**`bonusQuarters/{quarter}` 移除 `teamBonus` 欄位**：`defaultQuarterData()` 不再包含這個 key，`BonusView.vue` 不再讀寫、不再顯示對應的輸入區塊。

### 計算邏輯（`src/utils/bonusCalc.js` 新增函式）

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

`buildCaseBonusEntries()` 在既有的業務/設計師/工務三段之後，追加呼叫 `buildTeamBonusEntries()` 並把結果併入回傳陣列，這樣 `BonusView.vue` 的 `recalculate()` 迴圈不用另外改（每個案件還是只呼叫一次 `buildCaseBonusEntries`，內部自動包含團隊獎金的 entries）。

**去重規則**：同一人同時是業務+設計師（例如柏自己身兼多角色），在 `dedupeParticipants()` 用 `Set` 去重後只出現一次，`splitBonus()` 分配時也只當一個人頭計算，不會因為身兼多角色就分兩份。

### `CaseBonusForm.vue` 新增區塊

在既有工務區塊之後、質化條件之前，新增：
- 「團隊獎金總額」數字輸入，綁 `form.teamBonusAmount`
- 參與人清單（唯讀，自動從 `form.salesPersonIds`/`designerIds`/`siteManagerIds` 合併去重算出，不是另外勾選）：每人一行，顯示姓名 + 分配金額即時預覽；超過 1 人時額外顯示百分比輸入框（綁 `form.teamBonusSplit[uid]`），邏輯比照 `RoleAssigneePicker.vue` 的分帳 UI，但這裡不需要勾選/取消功能（參與人是自動算出的，不是手動選的），所以不重用 `RoleAssigneePicker.vue` 元件本身，直接在 `CaseBonusForm.vue` 內寫一小段對應邏輯
- 沒有任何參與人時，顯示「尚未指定任何角色負責人，無法分配團隊獎金」提示文字，金額欄位仍可填寫

### `BonusView.vue` 異動

- 移除「團隊獎金（手動輸入）」整個 `<section>`（原本四個角色的季度層級輸入框）
- `roleLabel()` 新增 `team: '團隊'` 對應
- `quarterForm`／`defaultQuarterData()` 不再有 `teamBonus` 欄位，`loadQuarter()`／`saveQuarterData()` 對應拿掉相關賦值

## 測試

- `bonusCalc.js` 新增函式的 vitest 覆蓋重點：
  - `dedupeParticipants`：同一人身兼多角色只出現一次、三個角色都沒人時回傳空陣列
  - `buildTeamBonusEntries`：金額為 0 或參與人為空時回傳空陣列、單人時全拿、多人時依 `splitBonus()` 均分/自訂比例分配、金額加總等於 `teamBonusAmount`
- 頁面操作用真實瀏覽器 + 正式 Firestore 端到端驗證（沿用季度獎金統計功能已建立的登入態技巧），驗證重點：
  1. 案件填業務+設計師（同一人）+ 工務（另一人）+ 團隊獎金金額，確認參與人清單只列 2 人（不是 3 人）、均分金額正確
  2. 手動調整其中一人的分比，確認金額跟著變、加總仍等於團隊獎金總額
  3. 儲存後彙總表出現對應「團隊」角色的 entries，人數跟金額正確
  4. 標記其中一筆已發放，確認鎖定行為跟業務/設計師/工務一致
  5. 案件完全沒指定角色負責人時，團隊獎金欄位可填但不產生 entries，畫面提示正確顯示
  6. 確認季度發放彙總頁面不再出現舊版「團隊獎金（手動輸入）」區塊
