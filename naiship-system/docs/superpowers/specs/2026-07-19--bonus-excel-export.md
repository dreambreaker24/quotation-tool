# 季度獎金統計 Excel 匯出

日期：2026-07-19
狀態：待柏審閱

## 背景 / 問題

季度獎金統計功能（`/bonus`）上線後，柏要求能把「本季發放彙總」表格匯出成 Excel，方便留存紀錄或離線核對。

## 目標

- 在「本季發放彙總」區塊標題旁新增「匯出 Excel」按鈕，點擊後匯出目前選定季度的發放彙總表為 `.xlsx` 檔案
- 匯出內容跟畫面上的表格一致（角色、對象、案件、建議金額、實發金額、已發放狀態），額外補上發放時間跟發放人兩欄方便留存紀錄
- 沿用專案既有的 Excel 匯出慣例（`src/composables/useExport.js`），不引入新的套件或寫法

## 不做的事

- 不支援跨季度/多季一次匯出——每次只匯出畫面上目前選定的那一季，想匯別季就先切換季度選單
- 不匯出行政的進件量/簽約量設定、也不匯出案件清單——只匯「本季發放彙總」這一張表
- 不依角色分頁籤——單一工作表，所有角色的 entries 混在一起，跟畫面表格顯示順序一致（不重新排序或分組）

## 設計

### `useExport.js` 新增 `exportBonusSummary(entries, quarterKey)`

比照既有的 `exportCases`/`exportPettyCash` 寫法：

```js
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
```

`useExport()` composable回傳值加上 `exportBonusSummary`。

### `BonusView.vue` 新增匯出按鈕

在「本季發放彙總」`<section>` 的標題列，跟既有「重新試算」「儲存本季資料」並排新增一顆「匯出 Excel」按鈕，點擊呼叫 `useExport().exportBonusSummary(allEntries.value, selectedQuarter.value)`。

- 沒有任何 entries 時（畫面顯示「目前沒有可發放的項目」那個狀態），按鈕維持存在但點擊會匯出一份只有欄位標題、沒有資料列的空白 Excel（`XLSX.utils.json_to_sheet([])` 本身就會產生空表格，不特別擋這個操作，行為單純、不用額外處理空狀態）

## 測試

- 這個檔案沒有現成的 component-mount 測試（既有慣例），`useExport.js` 目前也沒有專屬單元測試（`exportCases`/`exportClients`/`exportPettyCash` 都沒有），這次新增的 `exportBonusSummary` 比照辦理，不特別新增測試
- 驗證方式：`npm run build` 過 + 真實瀏覽器手動驗證：選一季有資料的季度、點「匯出 Excel」、確認下載的 `.xlsx` 檔案欄位/資料跟畫面表格一致（含中文角色名稱轉換、已發放狀態文字、金額數字），沒有 entries 的季度點擊確認不會報錯（產生空白檔案即可）
