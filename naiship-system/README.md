# 奈拾設計管理系統

## 開發環境啟動

1. 複製 `.env.example` 為 `.env`，填入 Firebase 設定值
2. 啟動開發伺服器：

```bash
npm run dev:all
```

## Firebase 設定

1. 前往 [Firebase Console](https://console.firebase.google.com/) 建立專案
2. 啟用 Authentication（Google 登入）、Firestore Database
3. 將 SDK 設定值填入 `.env` 檔案
4. 更新 `.firebaserc` 中的 `YOUR_FIREBASE_PROJECT_ID`

## 部署

```bash
# 安裝 Firebase CLI（如尚未安裝）
npm install -g firebase-tools
firebase login

# 建置並部署
npm run build
firebase deploy --only hosting
```

## 初始資料

```bash
# 填好 .env 後執行，寫入模擬案件資料
npm run seed
```
