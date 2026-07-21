# 工作日誌：開放員工自助補寫過去 2 天內的日誌

日期：2026-07-21
狀態：待柏審閱

## 背景 / 問題

員工（Ramy）回報：工作日誌頁面切到非今天的日期時，完全沒有入口新增/補建那天的日誌（不管一般工作內容還是加班/油資）。診斷確認根因：

1. `WorkJournalTab.vue` 唯一能開「新增日誌」表單的「+ 填寫今日日誌」按鈕寫死 `v-if="isToday"`，切到非今天就整個消失
2. `WorkJournalLogForm.vue` 新增日誌時的日期也寫死 `Timestamp.fromDate(new Date())`（永遠今天），沒有日期欄位可選
3. 唯一能對過去日期建日誌的「+ 幫同事補加班/油資」限主管才看得到，且打開的表單裡一般工作內容欄位依然被 `canEditContent`（要求 `daysSince===0`）鎖住，只能填加班/油資

這不是這次改動造成的新 bug，是 2026-07-14「工作日誌權限重新設計」那批上線後就存在的既有缺口——加了「加班/油資 2 天自助視窗」這條編輯規則，卻沒有同步給員工一個「先把那天的日誌建立出來」的入口。

## 目標

- 員工自己在「過去 2 天內」（含今天）能自助新增/補寫工作日誌，含一般工作內容跟加班/油資
- 沿用既有的 2 天自助視窗概念（跟 `canSelfEditOvertimeFuel` 同一個天數），不新生一個獨立數字
- 按鈕文字依日期動態顯示，讓員工清楚知道自己是在補寫哪一天

## 不做的事

- 不放寬超過 2 天的補寫——超過 2 天一律維持現況，只能靠主管走「+ 幫同事補加班/油資」入口，且那個入口依然只能補加班/油資、不能補一般工作內容（這是柏 2026-07-14 刻意收緊的資料完整性決定，這次不連動放寬）
- 不改動 `canEditGeneralContent`/`canSelfEditOvertimeFuel` 這兩條既有規則本身——問題出在「員工沒有入口建立過去日期的日誌」，不是這兩條規則的判斷邏輯有誤，關鍵發現是「新建立日誌的當次表單本來就不受日期限制」（`WorkJournalLogForm.vue` 的 `canEditContent`/`canEditOvertimeFuel` props 在 `editingLog` 為 null 時預設 `true`），限制只發生在事後重新打開編輯已存在的日誌
- 不改「+ 幫同事補加班/油資」（主管代發）的行為

## 設計

### `WorkJournalTab.vue`：新增日誌按鈕放寬到 2 天內

「+ 填寫今日日誌」按鈕的顯示條件從 `v-if="isToday"` 改成一個新的 `canCreateLog` computed，邏輯跟既有 `canSelfEditOvertimeFuel` 一樣是 `daysSince(selectedDate) <= 2`（直接呼叫 `workJournalDeadline.js` 匯出的 `canSelfEditOvertimeFuel(selectedDate.value)`，不另外重寫一份 `daysSince<=2` 邏輯——`selectedDate` 是純 JS `Date`，`daysSince()` 本來就相容純 `Date` 輸入，不需要轉型）。

按鈕文字依日期動態顯示：
- 今天：「+ 填寫今日日誌」（維持現狀文字）
- 非今天（在 2 天視窗內）：「+ 補寫 {M/D} 日誌」（例如「+ 補寫 7/19 日誌」，用 `${selectedDate.getMonth()+1}/${selectedDate.getDate()}`，跟這個檔案裡其他地方既有的簡短日期格式一致，例如 `handleReply` 裡的 `dateStr`）

### `WorkJournalLogForm.vue`：新增日誌時使用實際檢視日期

新增一個 prop `targetDate`（型別 `Date`，選填，預設 `null`），`WorkJournalTab.vue` 呼叫 `openLogForm()` 時把 `selectedDate.value` 一併帶進表單（透過現有的 `showLogForm`/`editingLog` 狀態機制，多傳一個 prop）。新增日誌送出時的日期欄位：

```js
date: Timestamp.fromDate(props.targetDate ?? new Date())
```

取代目前寫死的 `Timestamp.fromDate(new Date())`。編輯既有日誌（`editingLog` 不為 null）的路徑完全不受影響，繼續用 `editingLog.date`。

### 資料完整性影響評估

新建立的日誌（無論日期）在「當次表單」提交時本來就不受 `canEditContent`/`canEditOvertimeFuel` 限制（既有行為，這次沒有改動這條規則）。這代表員工在 2 天視窗內建立的補寫日誌，提交當下能完整填寫一般工作內容跟加班/油資；提交之後如果想再次打開編輯，才會受既有規則約束——一般內容只有日誌本身日期是「今天」才能改（對一筆已經是 1-2 天前日期的日誌，建立當下之後就無法再修改一般內容，只能在 2 天視窗內修改加班/油資部分），這跟既有政策精神一致，不會因為這次開放補寫入口而讓資料完整性倒退。

## 測試

- `WorkJournalTab.vue`／`WorkJournalLogForm.vue` 都沒有現成的 component-mount 測試（既有慣例），驗證方式是 `npm run build` 過 + 真實瀏覽器手動驗證
- 驗證重點（用一般員工帳號測試，測完清除測試資料）：
  1. 切到今天：按鈕顯示「+ 填寫今日日誌」，行為跟現況一致
  2. 切到 1-2 天前：按鈕顯示「+ 補寫 M/D 日誌」，點擊能開出表單並完整填寫一般工作內容+加班/油資，送出後日誌正確存到那個日期
  3. 切到 3 天前（超過視窗）：按鈕消失，跟現況一致（員工完全看不到新增入口）
  4. 補寫完成的日誌，馬上重新打開編輯：一般工作內容欄位鎖住（因為日誌日期不是今天），加班/油資欄位在 2 天視窗內仍可編輯——確認既有的事後編輯規則正常運作，沒有被這次改動繞過
  5. 主管視角：確認「+ 幫同事補加班/油資」入口跟行為完全沒被這次改動影響
