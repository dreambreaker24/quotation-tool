# nas-media-service

naiship-system 的媒體收檔／供檔服務，跑在公司 QNAP NAS（TS-453E）的 Container Station。
系統的結構化資料仍在 Firebase；這個服務只負責檔案本身。

- **收檔**：`POST /media/upload`，驗呼叫者的 Firebase ID token（不需要 service account 金鑰，用 Google 公開 JWK 驗簽）
- **供檔**：`GET /media/naiship/<type>/<檔名>`，靜態、inline 顯示、長快取
- **健康檢查**：`GET /media/health` → `{ "ok": true }`（前端斷線橫幅用）

## 環境變數

| 變數 | 範例 | 說明 |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `quotation-system-ddc5c` | 驗 ID token 的 issuer / audience |
| `MEDIA_ROOT` | `/media` | 容器內掛載點（對應 NAS 實體資料夾）。檔案實際落在 `<MEDIA_ROOT>/naiship/<type>/` |
| `PUBLIC_BASE_URL` | `https://nextdesign.myqnapcloud.com/media` | 回傳網址前綴（= 反向代理對外路徑，去尾斜線） |
| `ALLOWED_ORIGINS` | `https://quotation-system-ddc5c.web.app` | 允許呼叫 `/media/upload` 的來源，逗號分隔 |
| `PORT` | `3001` | 容器內部埠（不需對外，只給反向代理用） |
| `MAX_FILE_MB` | `50` | 單檔上限（預設 50） |

## 允許的類別 / 副檔名

- 類別（`type` 欄位）白名單見 `src/config.js` 的 `ALLOWED_TYPES`（對應現有 Cloudinary 資料夾與前端 `useStorage` 的 type 參數）
- 副檔名白名單：`jpg jpeg png webp gif pdf mp4 mov`
- 檔名一律由服務端重新產生（`YYYYMMDD-<8碼隨機>.<ext>`），不採用使用者原始檔名

## 本機開發 / 測試

```bash
cd nas-media-service
npm install
npx vitest run        # 38 個單元測試
```

`vitest.config.js` 把 `jose` 標為 `server.deps.external`，讓測試用原生 Node ESM 載入 jose（Vite 的 SSR transform 會弄壞 jose 的 WebCrypto 判斷）。這只影響測試，對 Docker 映像無影響（`test/` 與 `vitest.config.js` 都在 `.dockerignore`，正式跑的是 `node src/index.js`）。

---

## Phase B 部署步驟（在 NAS 上，路徑 A：SSH）

> 前置：柏在 NAS「控制台 → Telnet / SSH」開啟 SSH 並設好對外轉埠，提供 `nextdesign62` 管理員密碼。

1. **建實體資料夾**
   - QTS「File Station」建（或沿用）共用資料夾 `web`
   - 底下建 `web/media/naiship`
   - 這個資料夾**只放 naiship 媒體檔**，不要跟其他東西混（靜態伺服只開放 `MEDIA_ROOT/naiship` 子樹，但仍以專屬資料夾為佳）

2. **確認 RAID**：儲存與快照 → 儲存池 → 確認是 **RAID 1**（兩顆 20TB 互為備份）

3. **快照排程**：儲存與快照 → 快照 →
   - 為含 `media` 的 volume 設**每日一次**排程，保留 7 天
   - 韌體支援的話啟用「不可變快照 / WORM」防勒索軟體竄改

4. **SSH 進 NAS**：`ssh nextdesign62@nextdesign.myqnapcloud.com -p <轉埠>`

5. **取得程式碼**：把整個 `nas-media-service/`（含 `package.json`、`package-lock.json`、`src/`、`Dockerfile`；不需要 `node_modules`、`test/`）傳到 NAS，例如 `web/nas-media-service`

6. **Container Station 建映像與容器**
   - 用 `Dockerfile` 建 image：`docker build -t nas-media-service:1 .`（Container Station 內建 docker CLI）
   - 建容器：
     - Volume 掛載：NAS `web/media` → 容器 `/media`
     - 環境變數：
       ```
       FIREBASE_PROJECT_ID=quotation-system-ddc5c
       MEDIA_ROOT=/media
       PUBLIC_BASE_URL=https://nextdesign.myqnapcloud.com/media
       ALLOWED_ORIGINS=https://quotation-system-ddc5c.web.app
       PORT=3001
       MAX_FILE_MB=50
       ```
     - 重啟策略：`unless-stopped`
     - 容器埠 3001，**不對外映射**（只給反向代理）

7. **反向代理**（Network & Virtual Switch → 反向代理）
   - 來源：`https://nextdesign.myqnapcloud.com`，路徑 `/media`
   - 目標：`http://localhost:3001`
   - 憑證：套用現有 myQNAPcloud Let's Encrypt
   - **在反向代理／前端 nginx 這一層限制上傳 body 大小（例如 60MB）與單一 IP 連線數** —— 服務端 multer 用 memoryStorage，靠這層擋掉大量並行大檔把 NAS 記憶體吃爆（`src/server.js` 有對應 NOTE 註解）

8. **驗證**（見主 plan `docs/superpowers/plans/2026-09-10-nas-media-migration.md` 的 Task 13 curl 清單）：
   - `GET /media/health` → `{"ok":true}`
   - 無 token `POST /media/upload` → 401
   - 帶真 token 上傳 → 200 + 回傳網址；GET 該網址 → 200、`Content-Type` 正確、`Content-Disposition: inline`、`X-Content-Type-Options: nosniff`
   - 跨來源 OPTIONS 預檢 → `Access-Control-Allow-Origin` 回 app 網域
   - **PDF 專項**：上傳一份 PDF，在真實瀏覽器測「直接開網址」與「內嵌 iframe 預覽」兩種。服務對靜態檔加了 `Content-Security-Policy: default-src 'none'; sandbox`——直接開沒問題，iframe 內嵌 PDF 預覽在 Chrome 可能被 `sandbox` 擋。若前端有 iframe 預覽 PDF 的需求，改成對 `type` 為 pdf 時送 `sandbox allow-same-origin`（或拿掉 pdf 的 CSP），不要放寬所有類別。
   - 測試上傳的檔案記得 SSH 刪掉
