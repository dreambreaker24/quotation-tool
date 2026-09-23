# 行事曆跨天事件長條顯示 — 設計文件

## 背景

奈拾行事曆（`src/components/cases/CalendarTab.vue`）視覺改版時拆出來延後處理的第二塊真功能：農曆國字顯示（`specs/2026-09-23--design.md`）已經完成上線。這份 spec 處理另一塊：把跨天事件（請假、重要記事、場勘/施工，只要有設定結束日期）從「每一天各自重複顯示一個色塊」改成「一條長條橫跨多天顯示」，遇到週末/國定假日自動斷開，視覺呈現比照先前已經跟柏來回確認過的設計稿 mockup。

## 目標

- 有結束日期的事件（`event.endDate` 存在），不再逐日重複渲染，改成一條橫跨其涵蓋日期範圍的視覺長條
- 長條遇到週末或國定假日直接斷開，不畫過去（沿用先前設計稿已確認的規則）
- 長條樣式沿用目前已上線的統一規格：固定高度、統一倒角、對齊儲存格內距
- 同一週最多同時顯示 2 條跨天長條（各自佔一列，垂直對齊）；極端情況超過 2 條時，第 3 條以後的事件退回原本逐日顯示，不強求
- 長條要能被點擊（開啟編輯視窗）、能被拖曳（搬移整個事件到別的日期），維持現有互動能力
- 除了「跨天事件不再出現在 `cell.events` 逐日列表裡」這一點，其餘既有互動（單日事件的拖曳/點擊、新增/刪除事件、當天詳情視窗、`canDragEvent` 的判斷邏輯）完全不變

## 不在範圍內

- 拖放別的事件到「恰好被長條遮住」的那一小條窄縫區域接不到放開事件——已跟柏確認過這是可接受的邊緣情況（機率低、頂多重拖一次），這輪不處理，之後真的常遇到再回頭補
- 同一週超過 2 條跨天事件同時進行的多列排版最佳化
- 長條以外的視覺改動（配色、字體等視覺改版已經完成上線，不在這份 spec 範圍）

## 架構

### 新增檔案：`src/utils/calendarEventBars.js`

獨立、純函式的 utils 模組（跟 `lunarCalendar.js`／`businessDays.js` 同樣的既有慣例：無框架依賴、可獨立測試）。

對外開一個函式：

```js
/**
 * @param {Array<{date: string, dayOfWeek: number, isNonWorking: boolean}>} weekDays 這一週 7 天的資訊（週一到週日）
 * @param {Array<{id, type, date, endDate, label, ...}>} multiDayEvents 這個月所有有 endDate 的事件（已轉換成 date/endDate 為 'YYYY-MM-DD' 字串）
 * @returns {Array<{event, colStart, colSpan, row}>} 這一週要畫的長條段清單，每段標明橫跨哪幾欄（0-6）、佔第幾列（0 或 1）
 */
export function buildWeekEventBars(weekDays, multiDayEvents) { ... }
```

規則：
1. 一個跨天事件如果橫跨到下一週，在下一週會被**重新計算**成新的一段（每一週是獨立的計算單位，不需要知道「上一週有沒有畫過」）
2. 一段長條裡只包含連續的**上班日**（`isNonWorking === false`）——遇到週末/假日就切斷，假日格子本身不會被任何長條覆蓋到
3. 同一週最多同時存在 2 條長條，用「開始日期較早的先分配列」的規則決定誰佔第 0 列、誰佔第 1 列；第 3 條以後的事件不進到回傳結果裡（呼叫端要知道「沒被排進長條清單的跨天事件」，讓這些事件退回原本的逐日顯示邏輯）

### `CalendarTab.vue` 改動

1. **`calendarCells` computed**：`eventsForDate(date)` 回傳的事件裡，把有 `endDate` 的事件從 `cell.events` 移除，只留單日事件（沒有 `endDate`）給原本的 `slice(0,4)` 逐格渲染邏輯用。
2. **新增 computed `weekEventBars`**：把 42 格依 7 天一組切成 6 週，每週呼叫 `buildWeekEventBars()`，組成「每週要畫哪些長條」的資料。
3. **樣板**：每週的列容器加上 `position: relative`，裡面疊上這一週算出來的長條，用 `position: absolute` 定位（`left`/`width` 用百分比對齊到儲存格的 10px 內距，跟目前已上線的事件色塊同一套留白基準）。長條樣式（高度、圓角、顏色）直接沿用目前 `eventColor(event.type)` 這個既有的顏色對照函式，不用另外定義一套。
4. **長條的互動**：
   - `@click.stop="onEventTap(event, event.date)"`——沿用既有的 `onEventTap`，行為跟原本點擊第一天的色塊一樣（leave 開編輯視窗、milestone 開場勘預覽、其他開一般編輯）
   - `:draggable="canDragEvent(event, event.date)"` + `@dragstart="onEventDragStart(event, event.date, $event)"`——`canDragEvent()` 本來就規定多天事件只有起始日可拖，這裡直接用事件自己的起始日期呼叫，邏輯完全沿用既有函式，不用改 `canDragEvent()` 本身
5. **日期格內容的排版**：每個格子如果這一週有 1~2 條長條經過它，要預留對應高度的空白（跟原本設計稿 mockup 同樣的技巧），單日事件才會接著往下排，不會被長條蓋住

### 資料流程

```
calendarCells (computed)
  ├─ 每格 events：只保留沒有 endDate 的單日事件（供 slice(0,4) 用）
  └─ ...其餘欄位（day、isNonWorking、holidayName、lunarLabel）不變

weekEventBars (新 computed)
  └─ 依週切分 calendarCells → 每週呼叫 buildWeekEventBars(weekDays, 這個月的跨天事件)
       └─ 樣板依此疊放絕對定位的長條
```

不影響 Firestore 讀寫、不影響 `eventsForDate`／`mergeMilestonesByCase` 本身、不影響當天詳情視窗（`dayDetailEvents` 是另一條獨立的資料路徑，直接查當天所有事件，不受這次改動影響）。

## 錯誤處理

- `buildWeekEventBars` 是純計算函式，輸入範圍固定（7 天），沒有網路請求、沒有使用者輸入，不會有執行期錯誤
- 同一週超過 2 條跨天事件時，多出來的事件不會被排進長條、也不會拋錯，呼叫端要處理「這個事件沒有被排進 `weekEventBars`」的情況，讓它退回逐日顯示（也就是這個事件仍然留在該週對應幾天的 `cell.events` 裡，不能被步驟 1 整個移除——需要判斷「這個跨天事件是不是真的被排進某一週的長條」再決定要不要從 `cell.events` 抽掉）

## 測試計畫

1. **新增 `tests/utils/calendarEventBars.test.js`**：
   - 單一事件橫跨整週（週一到週日，其中週六日要斷開，只剩週一到週五一段）
   - 事件在週中間開始／結束
   - 事件被假日截斷成兩段
   - 事件跨到下一週（驗證兩週分別獨立算，各自產生自己的段）
   - 同一週兩條跨天事件同時進行，驗證兩者分別被排到第 0 列、第 1 列
   - 同一週三條以上跨天事件同時進行，驗證第 3 條以後不在回傳結果裡
2. **`tests/components/CalendarTab.test.js`**：既有 53 項測試要全數維持通過；`canDragEvent` 相關測試不用改（函式本身邏輯沒變）；如果有測試斷言「跨天事件會出現在 `cell.events`」，需要同步調整（跨天事件現在只在被排進長條時才從 `cell.events` 移除，測試要照這個規則调整斷言）
3. **視覺與互動驗證**：Playwright 對本機開發伺服器截圖 + 實際操作確認：
   - 長條位置、斷點（遇假日）跟設計稿一致
   - 點擊長條能開啟編輯視窗
   - 拖曳長條能搬移整個事件到別的日期
   - 單日事件仍正常逐格顯示，不受影響

## 開放疑慮自我檢查

- 無 TBD／待補項目
- 「拖放邊緣情況不處理」「超過 2 條退回逐日顯示」都已明確列在範圍外，不是遺漏
- 範圍聚焦在單一功能（跨天長條渲染），未牽動視覺配色或農曆顯示，適合單獨立一份實作計畫
