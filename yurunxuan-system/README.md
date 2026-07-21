# 鈺潤軒管理系統

鈺潤軒（潤雪飲／潤澤飲／潤潤飲）品牌的營運管理系統，用來管理主檔資料、進銷存交易與收支儀表板。

## 技術棧

Vue 3（Composition API + `<script setup>`）、Vite、Tailwind CSS、Pinia、Firebase（Auth + Firestore + Hosting）。

## 開發環境設定

```bash
npm install
```

複製 `.env.example` 為 `.env`，填入 Firebase 專案設定值，接著啟動開發伺服器：

```bash
npm run dev
```

## 常用指令

```bash
npm run dev            # 啟動開發伺服器
npm run build          # 建置正式版
npm run test           # 執行單元測試（Vitest）
npm run deploy         # 建置並部署到 Firebase Hosting
npm run deploy:rules   # 部署 Firestore 規則與索引
```

## 目前進度

- 計畫一（骨架＋主檔）：已完成，包含開店支出攤提、原料/包材、廠商資料、配方表四大主檔管理
- 計畫二（進銷存交易）：已完成，包含每日生產登記（依配方自動扣庫存）、進貨登記（自動加庫存）、報廢登記（原料/包材扣庫存、成品純記錄）、庫存總覽（低於安全庫存標示）
- 計畫三（收入/支出/儀表板）：尚未開始
