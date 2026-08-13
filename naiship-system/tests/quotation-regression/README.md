# 報價系統 Vue 改寫前提②：新舊 PDF 逐項比對

這個資料夾是「報價系統改寫成 Vue」三個前提之一（見 `feedback_quotation_vue_rewrite_gate` 記憶）的準備工作：在真的動手重寫之前，先準備一批有代表性的測試資料 + 舊版基準截圖，將來新版做出來後才有東西可以逐項比對，確認排版沒有悄悄壞掉。

## 檔案

- `fixtures.mjs` — 6 筆測試資料，涵蓋容易讓 A4 排版出問題的情境：
  - `basic-single-page` 基本款（單頁、未稅、無折扣）
  - `with-tax-and-discount` 含稅 + 折扣
  - `multi-page-many-items` 多品項（7 個工程大項）
  - `long-text-notes-terms` 超長備註／合約條款／地址文字
  - `second-company-baiting` 第二品牌（柏延，測試 logo/印章/銀行資訊切換）
  - `edge-zero-values` 邊界值（管理費 0%、無折扣、單一付款期）
- `capture-baseline.mjs` — 把每筆 fixture 餵給**舊版** `quotation-dev.html` 的 `loadQuote()`，截圖存成基準圖
- `baselines/` — 截圖結果，`{fixture-id}--page1.png`（客戶看的報價單）+ `{fixture-id}--page2.png`（內部成本明細頁，永遠都會產生，不是頁數溢出才有）

## 用法

```bash
cd naiship-system
node tests/quotation-regression/capture-baseline.mjs
```

## 未來要接續的部分（Vue 版本做出來之後）

1. 寫一支類似的腳本，把同一批 `fixtures.mjs` 資料餵給新版 Vue 元件，截圖存到 `baselines-new/`（或類似命名）
2. 用逐像素比對工具（例如 `pixelmatch`）比對 `baselines/` 跟 `baselines-new/` 對應檔名的圖，抓出差異
3. 這份回歸測試要能重複跑——舊版程式碼真正退役前，每次改動都要過這一關

## 技術筆記

- `loadQuote(data)` 是 `quotation-dev.html` 裡的全域函式，可以直接用 Playwright 的 `page.evaluate()` 呼叫，不用真的一格一格填表單，`data` 的完整欄位形狀可以直接參考 `fixtures.mjs` 裡任一筆。
- 桌面版寬螢幕下，輸入區是 `width:80%` 彈性寬（不是固定小寬度），A4 稿紙（固定 793px 寬）在寬螢幕會被擠到溢出視窗外——截圖前一定要先呼叫 `togglePreviewExpand()` 把輸入區收合，拿到完整寬度的預覽，這才是使用者實際會看到的畫面。
