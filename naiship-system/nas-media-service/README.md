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
| `PUBLIC_BASE_URL` | `https://nextdesign.myqnapcloud.com:8444/media` | 回傳網址前綴（= 反向代理對外路徑，去尾斜線；埠號見下方「反向代理」說明） |
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

## Phase B 實際部署步驟（2026-09-11～13 執行，全程瀏覽器操作，未用 SSH／未 build Dockerfile）

> 實際執行時 SSH 外部連線卡在路由器連接埠轉發（見下方「反向代理」的埠號背景），柏改授權全程用瀏覽器操作 NAS 網頁後台（QTS File Station 5 + Container Station 網頁版）完成，**沒有用到 SSH，也沒有 build `Dockerfile`**。下面是實際走過、已驗證成功的步驟；`Dockerfile` 留在 repo 供未來若改用 CLI/CI 部署參考，但目前這個服務**不是**用它跑起來的。

1. **建實體資料夾**（File Station 5，滑鼠操作）
   - 在既有的 `media` 共用資料夾下建 `media/naiship`（搬家目標，之後前端上傳/供檔都落在這裡）
   - 另建 `media/nas-media-service`（放這個服務的程式碼：`package.json`、`package-lock.json`、`src/`），用 File Station 的「上傳」功能把本機檔案傳上去，不需要 `node_modules`、`test/`

2. **確認 RAID**：儲存與快照總管 → 儲存池 → 確認是 **RAID 1**（兩顆 20TB 互為備份）

3. **快照排程**：儲存與快照總管 → 快照 → 為含 `media` 的 volume 設**每日 01:00**排程，智慧型版本控制保留

4. **Container Station 建容器（不 build image，直接吃官方 node 映像 + volume 掛載程式碼）**
   - Container Station 網頁版 → 應用程式 → 建立 → 貼 Docker Compose YAML（不是填表單），內容：
     ```yaml
     services:
       nas-media-service:
         image: node:22-alpine
         working_dir: /app
         volumes:
           - /share/media/nas-media-service:/app
           - /share/media/naiship:/media/naiship
         command: sh -c "test -d node_modules || npm ci --omit=dev; node src/index.js"
         environment:
           FIREBASE_PROJECT_ID: quotation-system-ddc5c
           MEDIA_ROOT: /media
           PUBLIC_BASE_URL: https://nextdesign.myqnapcloud.com:8444/media
           ALLOWED_ORIGINS: https://quotation-system-ddc5c.web.app
           PORT: "3001"
         ports:
           - "3001:3001"
         restart: unless-stopped
     ```
   - 原因：Container Station 的網頁版建立應用程式功能沒有「build 映像檔」這個選項，只能吃現成映像；用官方 `node:22-alpine` + bind mount 程式碼資料夾 + 開機時 `npm ci`，等同達到同樣效果，不用另外維護 Dockerfile 建置流程
   - **環境變數改過一次程式碼／設定都要整包重建應用程式**：Container Station 網頁版不支援直接編輯執行中應用程式的環境變數，要改就是「移除」（bind mount 的資料夾不受影響，資料不會丟）再用修正後的 YAML 重新「建立」。曾經因為 `PUBLIC_BASE_URL` 忘記帶埠號重建過一次，這是踩過的坑
   - 容器內程式碼要更新（例如 bug fix）：直接用 File Station 把新的 `src/*.js` 上傳覆蓋（選「覆寫重複的檔案」），再到 Container Station「容器」頁面對這個容器按「重新啟動」即可，不用重建整個應用程式

5. **反向代理（QTS 網路存取 → 反向代理）—— 埠號 8444，不是路徑 `/media`**
   - **關鍵發現，跟原規劃不同**：QNAP 的反向代理是 **domain + port 層級的 vhost 轉發**，沒有 path 路徑轉發功能（進階設定只有逾時、自訂標頭，沒有 path 比對）。原本規劃「跟 QTS 管理後台共用 443、用 `/media` 路徑區分」做不到
   - 改法：開一個新埠 **8444** 專門給這個服務，規則設 `https://*:8444` → `http://localhost:3001`，`PUBLIC_BASE_URL`／前端 `VITE_NAS_BASE_URL` 都要用 `https://nextdesign.myqnapcloud.com:8444/media`
   - **myQNAPcloud Link 不會自動轉發這個新埠**：它只轉發內建認得的服務（QTS 管理後台、WebDAV），自訂新埠要在**路由器**上額外設「連接埠轉發」規則（8444 對外 → NAS 內部 8444），這台辦公室是 TP-Link Deco，設定藏在手機 Deco App 的「進階 → NAT 導向 → 連接埠轉發」，本機網頁版登入看不到這個選項
   - **在反向代理這一層限制上傳 body 大小與單一 IP 連線數**（QTS 反向代理進階設定或 App Center 防火牆規則）—— 服務端 multer 用 memoryStorage，靠這層擋掉大量並行大檔把 NAS 記憶體吃爆（`src/server.js` 有對應 NOTE 註解）

6. **驗證**（見主 plan `docs/superpowers/plans/2026-09-10-nas-media-migration.md` 的 Task 13 curl 清單，全部用 curl／真實 Firebase ID token 對外部網址測試過）：
   - `GET https://nextdesign.myqnapcloud.com:8444/media/health` → `{"ok":true}`
   - 無 token `POST /media/upload` → 401
   - 帶真 token 上傳 → 200 + 回傳網址（含 `:8444`）；GET 該網址 → 200、`Content-Type` 正確、`Content-Disposition: inline`、`X-Content-Type-Options: nosniff`
   - 跨來源 OPTIONS 預檢 → `Access-Control-Allow-Origin` 回 app 網域（這裡曾經抓到一個真的 bug：`cors()` 只掛在 POST route 上，Express 不會把 OPTIONS 導進去，預檢請求缺 CORS 標頭會被瀏覽器擋下真正的上傳；修法是額外 `app.options('/media/upload', uploadCors)`，見 `src/server.js` 對應註解與測試）
   - **PDF 專項**：上傳一份 PDF，在真實瀏覽器測「直接開網址」與「內嵌 iframe 預覽」兩種。服務對靜態檔加了 `Content-Security-Policy: default-src 'none'; sandbox`——直接開沒問題，iframe 內嵌 PDF 預覽在 Chrome 可能被 `sandbox` 擋。若前端有 iframe 預覽 PDF 的需求，改成對 `type` 為 pdf 時送 `sandbox allow-same-origin`（或拿掉 pdf 的 CSP），不要放寬所有類別
   - 測試上傳的檔案記得清掉：**注意 File Station GUI 刪除這個容器寫入的檔案時可能會失敗**（實測過，跳出「Failed to delete」錯誤，推測是 bind mount 容器寫入的檔案跟 QTS 使用者的權限模型對不上）。容器目前沒開 `-i`/`-t`（Container Station「連接終端機」功能顯示需要這兩個旗標才能連線），沒有簡單的容器內 shell 可以 `rm`；真的要清，需要柏本人透過 NAS 本機的 SSH（內部網路可連，`ssh nextdesign62@192.168.68.73`）手動 `rm` 掉該檔案的實體路徑（`/share/media/naiship/<type>/<檔名>`）
