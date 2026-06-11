# 自動付款提醒系統

**日期：** 2026-06-11
**狀態：** 待實作

---

## 背景

奈拾設計管理系統現有一套手動付款提醒（工種編輯裡按「提醒主管」），儲存在 `paymentReminders` collection。

本功能在此基礎上新增兩種自動提醒：
1. **廠商付款**：主管點完工後，系統自動計算隔月付款日並建立提醒
2. **業主請款**：儲存工種時若有進場日，系統自動建立進場前 7 天的提醒

---

## 資料結構

沿用現有 `paymentReminders` Firestore collection，新增兩個欄位：

```js
{
  // 現有欄位（不動）
  type: 'owner' | 'vendor',
  status: 'pending' | 'done',
  caseId, caseName, companyId,
  workTypeId, workTypeName,
  description, amount, note,
  createdBy, createdByName,
  createdAt, doneAt, doneBy,

  // 新增欄位
  source: 'manual' | 'auto',   // 手動提醒不設此欄位，UI 判斷 !source || source==='manual'
  dueDate: '2026-07-31',       // 僅 auto 有，ISO date string
  vendorName: '廠商名稱',       // 僅 auto vendor 有，方便顯示
}
```

**Auto 提醒固定 document ID（方便 upsert / 直接 deleteDoc）：**
- 廠商付款：`auto_vendor_${workTypeId}`
- 業主請款：`auto_owner_${workTypeId}`

---

## 日期計算規則

### 廠商付款（退場日 → 隔月）

```
退場日落在  1–15 日 → 隔月 15 日
退場日落在 16–31 日 → 隔月最後一天（28/30/31）
遇週六 → +1 天（週日）→ +1 天（週一）
遇週日 → +1 天（週一）
```

範例：
- 6/2 完工  → 7/15
- 6/17 完工 → 7/31
- 6/30 完工 → 7/31（已是最後一天，不需調整）
- 遇 7/13 週六 → 7/15 週一

### 業主請款（進場日前 7 天）

```
提醒日 = 進場日 - 7 天
```

不做 15/31 調整，不做假日推移。

---

## 觸發點與行為

| 動作 | 效果 |
|---|---|
| 點「完工」| `setDoc('paymentReminders/auto_vendor_${wtId}', ...)` |
| 點「取消完工」| `deleteDoc('paymentReminders/auto_vendor_${wtId}')` |
| 儲存工種（有進場日）| `setDoc('paymentReminders/auto_owner_${wtId}', ...)` |
| 儲存工種（進場日清空）| `deleteDoc('paymentReminders/auto_owner_${wtId}')` |
| 刪除工種 | `deleteDoc` 兩筆 auto 提醒（若存在） |

完工後 toast 顯示：「已建立廠商付款提醒：7/31（週四）」

---

## Store 異動（paymentReminders.js）

新增：
- `addAutoReminder(docId, data)` — 用 `setDoc` 覆寫，不用先查詢
- `deleteAutoReminder(docId)` — 直接 `deleteDoc`
- `upcomingAuto` computed — `source === 'auto'` 的提醒，按 `dueDate` 升序排列

現有 `pendingOwner` / `pendingVendor` computed 改為只抓 `!source || source === 'manual'` 的提醒，與 auto 不衝突。

---

## WorkTypePanel.vue 異動

### markDone(idx)
```
完工後：
  if (wt.endDate && wtVendorCostTotal(wt) > 0)
    → calcVendorDueDate(wt.endDate)
    → addAutoReminder('auto_vendor_${wt.id}', { source:'auto', dueDate, type:'vendor', vendorName, amount, ... })
    → toast('已建立廠商付款提醒：M/DD')
```

### unmarkDone(idx)
```
取消完工後：
  → deleteAutoReminder('auto_vendor_${wt.id}')
```

### submitForm()
```
儲存後：
  if (form.startDate)
    → calcOwnerDueDate(form.startDate)
    → amount = form.paymentFree ? 0 : form.paymentItems 加總
    → addAutoReminder('auto_owner_${wt.id}', { source:'auto', dueDate, type:'owner', amount, ... })
    → 進場日已過（dueDate < 今天）仍建立，UI 顯示「逾期」標籤
  else
    → deleteAutoReminder('auto_owner_${wt.id}')
```

### removeWorkType(idx)
```
刪除工種後：
  → deleteAutoReminder('auto_vendor_${wt.id}')
  → deleteAutoReminder('auto_owner_${wt.id}')
```

---

## Dashboard 左側欄

新增藍色「即將到期」區塊，顯示條件：`isManager && upcomingAutoCount > 0`

位置順序：
```
[ 紅 rgba(239,68,68,0.15)    ] 待確認申請  N 筆（現有）
[ 金 rgba(201,169,110,0.15)  ] 待付款      N 筆（現有）
[ 藍 rgba(59,130,246,0.15)   ] 即將到期    N 筆（新增）
```

「即將到期」定義：dueDate 在今天起 30 天內的 auto 提醒。
點擊連結 → 捲動到 PaymentReminders 的排程提醒區塊（`#scheduled-reminders`）。

---

## PaymentReminders.vue 異動

現有「向業主請款」和「廠商匯款」兩個 section 完全不動。

**新增第三個 section：排程提醒**（id="scheduled-reminders"）

每筆顯示：
```
到期日  案件名稱  工種名稱  廠商名稱  金額
[ 標記完成 ]
```

顏色：
- `type === 'owner'`：amber 底（與手動 owner 一致）
- `type === 'vendor'`：blue 底（與手動 vendor 一致）
- dueDate 已過期：加上紅色警示標籤「逾期」

排列：按 dueDate 升序（最快到期的在最上面）。

---

## Firestore Rules

`paymentReminders` 現有規則已允許 isSignedIn 建立，isManager 更新。
auto 提醒也在同 collection，沿用現有規則，不需額外修改。

---

## 不在此次範圍內

- 公假/節日推移（只處理週末）
- 推播通知（LINE / Email）
- 提醒歷史記錄查詢
- 員工請假申請審核流程
