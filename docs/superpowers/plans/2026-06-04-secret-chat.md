# 私密通訊 PWA (secret-chat) 實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個偽裝成計算機的 2 人私密通訊 PWA，支援文字/圖片/影片訊息、共享行事曆，所有內容 AES-256-GCM 端對端加密，部署至 Firebase Hosting。

**Architecture:** React 18 + Vite PWA；Firebase 處理 Auth（Email/Password）、Firestore（訊息、行事曆）、Storage（加密媒體檔案）、Hosting。所有內容在裝置端加密後才送至 Firebase。計算機殼作為偽裝層，輸入密碼 + 按 = 後切換至聊天介面。

**Tech Stack:** React 18, Vite 5, vite-plugin-pwa, Firebase 10, Web Crypto API (AES-256-GCM + PBKDF2), date-fns 3, Vitest

---

## 檔案結構

```
secret-chat/
├── index.html
├── vite.config.js
├── package.json
├── .env                          # Firebase config（不 commit）
├── .env.example
├── .gitignore
├── public/
│   ├── manifest.json             # PWA：名稱「記帳本」、圖示
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.jsx                  # React 入口
│   ├── App.jsx                   # 根元件：切換 Calculator ↔ Chat
│   ├── firebase.js               # Firebase app 初始化
│   ├── config.js                 # 計算機密碼 → Firebase 帳號對應（不 commit）
│   ├── crypto.js                 # AES-256-GCM encrypt/decrypt + PBKDF2
│   ├── authStore.js              # 記憶體 auth 狀態（userId + encKey）
│   ├── components/
│   │   ├── Calculator.jsx        # 計算機 UI + 解鎖邏輯
│   │   ├── ChatApp.jsx           # 聊天殼（header + list + input）
│   │   ├── MessageList.jsx       # 訊息列表（自動捲到底）
│   │   ├── MessageItem.jsx       # 單則訊息（文字/圖片/影片/連結）
│   │   ├── MessageInput.jsx      # 文字輸入 + 媒體上傳
│   │   ├── MediaViewer.jsx       # 全螢幕圖片/影片檢視
│   │   ├── SearchPanel.jsx       # 搜尋面板 + 結果清單
│   │   ├── CalendarView.jsx      # 月曆視圖
│   │   ├── EventModal.jsx        # 新增/編輯/刪除事件
│   │   └── EventBanner.jsx       # 進入 app 的事件提醒橫幅
│   ├── services/
│   │   ├── messageService.js     # Firestore 訊息 CRUD
│   │   └── calendarService.js    # Firestore 行事曆 CRUD
│   └── hooks/
│       ├── useMessages.js        # 即時訊息訂閱
│       ├── useCalendar.js        # 即時行事曆訂閱
│       └── useLockout.js         # 失敗次數計數 + 5 分鐘鎖定
├── src/__tests__/
│   └── crypto.test.js            # 加密模組單元測試
├── firestore.rules
├── storage.rules
├── firebase.json
└── .firebaserc
```

---

## Task 1: 建立專案骨架

**Files:**
- Create: `secret-chat/package.json`
- Create: `secret-chat/vite.config.js`
- Create: `secret-chat/index.html`
- Create: `secret-chat/src/main.jsx`
- Create: `secret-chat/.gitignore`
- Create: `secret-chat/.env.example`

- [ ] **Step 1: 建立 Vite React 專案**

```bash
cd "C:/AI助理 Claude"
npm create vite@latest secret-chat -- --template react
cd secret-chat
```

- [ ] **Step 2: 安裝依賴**

```bash
npm install firebase date-fns
npm install -D vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: 建立 .gitignore**

```
node_modules/
dist/
.env
src/config.js
```

- [ ] **Step 4: 建立 .env.example**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 5: 設定 vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: false,
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}']
            }
        })
    ],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.js']
    }
})
```

- [ ] **Step 6: 建立測試 setup 檔**

```js
// src/__tests__/setup.js
import '@testing-library/jest-dom'
```

- [ ] **Step 7: 確認 dev server 可啟動**

```bash
npm run dev
```
Expected: 瀏覽器顯示 Vite 預設頁面，無錯誤。

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: init secret-chat Vite React project"
```

---

## Task 2: PWA Manifest 與圖示

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png`（暫用純色佔位圖）
- Create: `public/icons/icon-512.png`
- Modify: `index.html`

- [ ] **Step 1: 建立 manifest.json（app 名稱「記帳本」）**

```json
{
  "name": "記帳本",
  "short_name": "記帳本",
  "description": "個人記帳管理工具",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1c1c1e",
  "theme_color": "#1c1c1e",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: 產生暫用圖示（帳本風格，棕色背景）**

在 `public/icons/` 建立兩個純色 PNG 圖示（任何圖示工具皆可，或用以下指令）：

```bash
# 需要 ImageMagick 或用任何線上工具產生 192x192 / 512x512 PNG
# 圖示設計：棕色（#8B6914）背景，白色「帳」字
# 若無 ImageMagick，可使用 https://favicon.io/favicon-generator/ 下載後重新命名
```

暫時可用 Vite 預設的 vite.svg 複製到 `public/icons/` 並重新命名為 `icon-192.png` 和 `icon-512.png`，後續再換正式圖示。

- [ ] **Step 3: 修改 index.html 加入 manifest 連結**

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/icons/icon-192.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <meta name="apple-mobile-web-app-title" content="記帳本" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <meta name="theme-color" content="#1c1c1e" />
    <title>記帳本</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 確認 manifest 載入**

```bash
npm run dev
```
打開瀏覽器 → DevTools → Application → Manifest，確認顯示「記帳本」。

- [ ] **Step 5: Commit**

```bash
git add public/ index.html
git commit -m "feat: PWA manifest with 記帳本 identity"
```

---

## Task 3: Firebase 專案設定

**Files:**
- Create: `src/firebase.js`
- Create: `firestore.rules`
- Create: `storage.rules`
- Create: `firebase.json`
- Create: `.firebaserc`

**前置動作（人工）：**
1. 前往 https://console.firebase.google.com 建立新專案，名稱例如 `secret-chat-app`
2. 啟用 Authentication → Email/Password
3. 建立兩個帳號：
   - 帳號 A：email `usera@sc.local`，密碼設為強密碼（自訂，記錄在安全的地方）
   - 帳號 B：email `userb@sc.local`，密碼設為強密碼（自訂）
4. 建立 Firestore database（production mode）
5. 建立 Storage bucket
6. 複製 Firebase config 到 `.env`

- [ ] **Step 1: 建立 src/firebase.js**

```js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
```

- [ ] **Step 2: 建立 firestore.rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
    match /calendar/{eventId} {
      allow read, write: if request.auth != null;
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 3: 建立 storage.rules**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /media/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

- [ ] **Step 4: 建立 firebase.json**

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

- [ ] **Step 5: 建立 .firebaserc（填入你的 project ID）**

```json
{
  "projects": {
    "default": "secret-chat-app"
  }
}
```

- [ ] **Step 6: 安裝 Firebase CLI 並登入**

```bash
npm install -g firebase-tools
firebase login
firebase use default
```

- [ ] **Step 7: Commit**

```bash
git add firebase.js firestore.rules storage.rules firebase.json .firebaserc
git commit -m "feat: Firebase config and security rules"
```

---

## Task 4: 加密模組（AES-256-GCM + PBKDF2）

**Files:**
- Create: `src/crypto.js`
- Create: `src/__tests__/crypto.test.js`

- [ ] **Step 1: 先寫失敗的測試**

```js
// src/__tests__/crypto.test.js
import { describe, it, expect } from 'vitest'
import { deriveKey, encrypt, decrypt } from '../crypto.js'

describe('crypto', () => {
    it('encrypt then decrypt returns original text', async () => {
        const key = await deriveKey('test-passphrase', 'test-salt')
        const plaintext = '你好世界 Hello 123'
        const ciphertext = await encrypt(plaintext, key)
        const result = await decrypt(ciphertext, key)
        expect(result).toBe(plaintext)
    })

    it('different passphrases produce different keys', async () => {
        const key1 = await deriveKey('passphrase-one', 'same-salt')
        const key2 = await deriveKey('passphrase-two', 'same-salt')
        const ciphertext1 = await encrypt('hello', key1)
        await expect(decrypt(ciphertext1, key2)).rejects.toThrow()
    })

    it('encrypt produces different output each call (random IV)', async () => {
        const key = await deriveKey('passphrase', 'salt')
        const c1 = await encrypt('same text', key)
        const c2 = await encrypt('same text', key)
        expect(c1).not.toBe(c2)
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm run test -- --run
```
Expected: FAIL — `Cannot find module '../crypto.js'`

- [ ] **Step 3: 實作 crypto.js**

```js
// src/crypto.js
// AES-256-GCM 端對端加密，使用 Web Crypto API（無外部依賴）

const PBKDF2_ITERATIONS = 100_000

export async function deriveKey(passphrase, salt) {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
    )
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode(salt),
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
}

export async function encrypt(plaintext, key) {
    const enc = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(plaintext)
    )
    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(cipherBuffer), iv.length)
    return btoa(String.fromCharCode(...combined))
}

export async function decrypt(ciphertext, key) {
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    )
    return new TextDecoder().decode(plainBuffer)
}

export async function encryptFile(arrayBuffer, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        arrayBuffer
    )
    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(cipherBuffer), iv.length)
    return combined.buffer
}

export async function decryptFile(encryptedBuffer, key) {
    const combined = new Uint8Array(encryptedBuffer)
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm run test -- --run
```
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/crypto.js src/__tests__/
git commit -m "feat: AES-256-GCM crypto module with PBKDF2 key derivation"
```

---

## Task 5: Auth Store 與帳號設定

**Files:**
- Create: `src/authStore.js`
- Create: `src/config.js`（列入 .gitignore，不 commit）

- [ ] **Step 1: 建立 src/config.js（此檔案不會被 commit）**

```js
// src/config.js
// 計算機密碼 → Firebase 帳號對應
// 此檔案含敏感資訊，已列入 .gitignore

export const USER_CREDENTIALS = {
    '0417': {
        uid: 'user_a',
        email: 'usera@sc.local',
        password: 'YOUR_STRONG_PASSWORD_FOR_USER_A',
    },
    'PARTNER_CODE': {
        uid: 'user_b',
        email: 'userb@sc.local',
        password: 'YOUR_STRONG_PASSWORD_FOR_USER_B',
    },
}

// 兩人共用的加密密語（部署前換成真正的密語）
// 若使用者在 app 內設定，此值可留空
export const DEFAULT_PASSPHRASE_SALT = 'secret-chat-v1'
```

將 `src/config.js` 加入 `.gitignore`：
```
src/config.js
```

- [ ] **Step 2: 建立 src/authStore.js**

```js
// src/authStore.js
// 記憶體內的 auth 狀態，app 關閉即清除

import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from './firebase.js'
import { deriveKey } from './crypto.js'
import { USER_CREDENTIALS, DEFAULT_PASSPHRASE_SALT } from './config.js'

let _state = {
    isAuthenticated: false,
    userId: null,
    encKey: null,
}

const _listeners = new Set()

function notify() {
    _listeners.forEach(fn => fn({ ..._state }))
}

export function subscribeAuth(fn) {
    _listeners.add(fn)
    fn({ ..._state })
    return () => _listeners.delete(fn)
}

export function getAuth() {
    return { ..._state }
}

export async function loginWithCode(code) {
    const creds = USER_CREDENTIALS[code]
    if (!creds) throw new Error('INVALID_CODE')

    await signInWithEmailAndPassword(auth, creds.email, creds.password)

    const passphrase = localStorage.getItem('enc_passphrase') || ''
    if (!passphrase) throw new Error('PASSPHRASE_REQUIRED')

    const encKey = await deriveKey(passphrase, DEFAULT_PASSPHRASE_SALT)

    _state = { isAuthenticated: true, userId: creds.uid, encKey }
    notify()
}

export async function setupPassphrase(passphrase) {
    localStorage.setItem('enc_passphrase', passphrase)
}

export function hasPassphrase() {
    return !!localStorage.getItem('enc_passphrase')
}

export async function logout() {
    await firebaseSignOut(auth)
    _state = { isAuthenticated: false, userId: null, encKey: null }
    notify()
}
```

- [ ] **Step 3: 確認模組可 import（無語法錯誤）**

```bash
npm run build 2>&1 | head -20
```
Expected: 無 error（可能有 warning，無妨）

- [ ] **Step 4: Commit（不含 config.js）**

```bash
git add src/authStore.js
git commit -m "feat: in-memory auth store with Firebase Email/Password login"
```

---

## Task 6: 計算機 UI

**Files:**
- Create: `src/components/Calculator.jsx`
- Create: `src/components/Calculator.css`

- [ ] **Step 1: 建立 Calculator.css**

```css
/* src/components/Calculator.css */
.calc-wrap {
    width: 100%;
    height: 100%;
    background: #1c1c1e;
    display: flex;
    flex-direction: column;
    user-select: none;
}

.calc-display {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 0 24px 12px;
}

.calc-expr {
    font-size: 20px;
    color: #636366;
    min-height: 28px;
    font-family: -apple-system, sans-serif;
}

.calc-result {
    font-size: 68px;
    color: #fff;
    font-weight: 200;
    letter-spacing: -2px;
    line-height: 1.1;
    font-family: -apple-system, sans-serif;
    transition: color 0.2s;
}

.calc-result.error { color: #ff453a; }

.calc-lockout {
    font-size: 13px;
    color: #ff9f0a;
    text-align: center;
    padding-bottom: 4px;
}

.calc-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding: 8px 16px 40px;
}

.btn {
    height: 76px;
    border-radius: 50px;
    border: none;
    font-size: 28px;
    font-weight: 400;
    cursor: pointer;
    transition: opacity 0.1s;
    font-family: -apple-system, sans-serif;
    -webkit-tap-highlight-color: transparent;
}

.btn:active { opacity: 0.65; }
.btn-func   { background: #636366; color: #fff; }
.btn-op     { background: #ff9f0a; color: #fff; }
.btn-num    { background: #2c2c2e; color: #fff; }
.btn-zero   { grid-column: span 2; justify-self: stretch; text-align: left; padding-left: 28px; font-size: 30px; }
.btn-eq     { background: #ff9f0a; color: #fff; }
```

- [ ] **Step 2: 建立 Calculator.jsx**

```jsx
// src/components/Calculator.jsx
import { useState, useCallback } from 'react'
import './Calculator.css'

const BUTTONS = [
    ['AC', '+/-', '%', '÷', 'func'],
    ['7', '8', '9', '×', 'num'],
    ['4', '5', '6', '−', 'num'],
    ['1', '2', '3', '+', 'num'],
    ['0', '.', '=', 'num'],
]

const OPS = ['÷', '×', '−', '+']

export default function Calculator({ onUnlock, lockoutSeconds }) {
    const [display, setDisplay] = useState('0')
    const [expr, setExpr] = useState('')
    const [input, setInput] = useState('')
    const [isError, setIsError] = useState(false)

    const handleButton = useCallback(async (label) => {
        if (lockoutSeconds > 0) return
        if (isError && label !== 'AC') return

        if (label === 'AC') {
            setDisplay('0')
            setExpr('')
            setInput('')
            setIsError(false)
            return
        }

        if (label === '+/-') {
            setDisplay(d => d.startsWith('-') ? d.slice(1) : '-' + d)
            setInput(i => i.startsWith('-') ? i.slice(1) : '-' + i)
            return
        }

        if (label === '%') {
            const val = parseFloat(display) / 100
            setDisplay(String(val))
            setInput(String(val))
            return
        }

        if (OPS.includes(label)) {
            setExpr(input + ' ' + label)
            setInput('')
            setDisplay('0')
            return
        }

        if (label === '=') {
            const code = input
            try {
                await onUnlock(code)
            } catch {
                setDisplay('Error')
                setExpr('')
                setInput('')
                setIsError(true)
                setTimeout(() => {
                    setDisplay('0')
                    setIsError(false)
                }, 3000)
            }
            return
        }

        if (label === '.' && input.includes('.')) return

        const newInput = input === '0' ? label : input + label
        setInput(newInput)
        setDisplay(newInput)
        setExpr(prev => prev ? prev.split(' ')[0] + ' ' + prev.split(' ')[1] : '')
    }, [display, input, isError, lockoutSeconds, onUnlock])

    return (
        <div className="calc-wrap">
            <div className="calc-display">
                <div className="calc-expr">{expr}</div>
                <div className={`calc-result ${isError ? 'error' : ''}`}>{display}</div>
                {lockoutSeconds > 0 && (
                    <div className="calc-lockout">
                        請等待 {Math.ceil(lockoutSeconds)} 秒
                    </div>
                )}
            </div>
            <div className="calc-buttons">
                {[
                    { label: 'AC', type: 'func' },
                    { label: '+/-', type: 'func' },
                    { label: '%', type: 'func' },
                    { label: '÷', type: 'op' },
                    { label: '7', type: 'num' },
                    { label: '8', type: 'num' },
                    { label: '9', type: 'num' },
                    { label: '×', type: 'op' },
                    { label: '4', type: 'num' },
                    { label: '5', type: 'num' },
                    { label: '6', type: 'num' },
                    { label: '−', type: 'op' },
                    { label: '1', type: 'num' },
                    { label: '2', type: 'num' },
                    { label: '3', type: 'num' },
                    { label: '+', type: 'op' },
                    { label: '0', type: 'num zero' },
                    { label: '.', type: 'num' },
                    { label: '=', type: 'eq' },
                ].map(({ label, type }) => (
                    <button
                        key={label}
                        className={`btn btn-${type.split(' ')[0]} ${type.includes('zero') ? 'btn-zero' : ''}`}
                        onClick={() => handleButton(label)}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    )
}
```

- [ ] **Step 3: 確認元件可 render（無錯誤）**

暫時在 `src/App.jsx` 加入：
```jsx
import Calculator from './components/Calculator.jsx'
export default function App() {
    return <Calculator onUnlock={() => {}} lockoutSeconds={0} />
}
```
執行 `npm run dev`，確認計算機顯示正確。

- [ ] **Step 4: Commit**

```bash
git add src/components/Calculator.jsx src/components/Calculator.css
git commit -m "feat: Calculator UI (iOS-style dark theme)"
```

---

## Task 7: 解鎖邏輯 + 鎖定機制

**Files:**
- Create: `src/hooks/useLockout.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: 建立 useLockout.js**

```js
// src/hooks/useLockout.js
import { useState, useEffect, useRef } from 'react'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 5 * 60 * 1000

export function useLockout() {
    const [attempts, setAttempts] = useState(0)
    const [lockedUntil, setLockedUntil] = useState(null)
    const [secondsLeft, setSecondsLeft] = useState(0)
    const timerRef = useRef(null)

    useEffect(() => {
        if (!lockedUntil) return
        const tick = () => {
            const left = (lockedUntil - Date.now()) / 1000
            if (left <= 0) {
                setSecondsLeft(0)
                setLockedUntil(null)
                setAttempts(0)
                clearInterval(timerRef.current)
            } else {
                setSecondsLeft(left)
            }
        }
        tick()
        timerRef.current = setInterval(tick, 500)
        return () => clearInterval(timerRef.current)
    }, [lockedUntil])

    function recordFailure() {
        const next = attempts + 1
        setAttempts(next)
        if (next >= MAX_ATTEMPTS) {
            setLockedUntil(Date.now() + LOCKOUT_MS)
        }
    }

    function isLocked() {
        return lockedUntil !== null && Date.now() < lockedUntil
    }

    return { secondsLeft, isLocked, recordFailure }
}
```

- [ ] **Step 2: 建立密語設定畫面元件（PassphraseSetup.jsx）**

```jsx
// src/components/PassphraseSetup.jsx
import { useState } from 'react'
import { setupPassphrase } from '../authStore.js'

export default function PassphraseSetup({ onDone }) {
    const [value, setValue] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        if (value.length < 4) { setError('密語至少 4 個字元'); return }
        if (value !== confirm) { setError('兩次輸入不一致'); return }
        await setupPassphrase(value)
        onDone()
    }

    return (
        <div style={{
            width: '100%', height: '100%', background: '#1c1c1e',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '0 32px', color: '#fff',
            fontFamily: '-apple-system, sans-serif'
        }}>
            <h2 style={{ marginBottom: 8, fontWeight: 600 }}>設定加密密語</h2>
            <p style={{ color: '#8e8e93', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
                與對方約好同一個密語，之後才能互相解讀訊息。忘記密語將無法讀取歷史訊息。
            </p>
            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                <input
                    type="password"
                    placeholder="輸入加密密語"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    style={inputStyle}
                />
                <input
                    type="password"
                    placeholder="再次輸入確認"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    style={{ ...inputStyle, marginTop: 12 }}
                />
                {error && <p style={{ color: '#ff453a', fontSize: 13, marginTop: 8 }}>{error}</p>}
                <button type="submit" style={btnStyle}>確認</button>
            </form>
        </div>
    )
}

const inputStyle = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    background: '#2c2c2e', border: 'none', color: '#fff',
    fontSize: 16, outline: 'none', boxSizing: 'border-box'
}

const btnStyle = {
    width: '100%', padding: '14px', borderRadius: 12,
    background: '#ff9f0a', border: 'none', color: '#fff',
    fontSize: 17, fontWeight: 600, cursor: 'pointer', marginTop: 20
}
```

- [ ] **Step 3: 修改 App.jsx — 整合 Calculator + 解鎖 + 路由**

```jsx
// src/App.jsx
import { useState, useEffect } from 'react'
import Calculator from './components/Calculator.jsx'
import PassphraseSetup from './components/PassphraseSetup.jsx'
import { loginWithCode, subscribeAuth, logout, hasPassphrase } from './authStore.js'
import { useLockout } from './hooks/useLockout.js'

export default function App() {
    const [view, setView] = useState('calculator') // 'calculator' | 'setup' | 'chat'
    const [authState, setAuthState] = useState({ isAuthenticated: false })
    const { secondsLeft, isLocked, recordFailure } = useLockout()

    useEffect(() => {
        return subscribeAuth(state => {
            setAuthState(state)
            if (state.isAuthenticated) setView('chat')
        })
    }, [])

    async function handleUnlock(code) {
        if (isLocked()) throw new Error('LOCKED')
        try {
            if (!hasPassphrase()) {
                // 先暫存 code，引導到密語設定，設定完再登入
                sessionStorage.setItem('pending_code', code)
                setView('setup')
                return
            }
            await loginWithCode(code)
        } catch (err) {
            if (err.message !== 'PASSPHRASE_REQUIRED') recordFailure()
            throw err
        }
    }

    async function handlePassphraseDone() {
        const code = sessionStorage.getItem('pending_code')
        sessionStorage.removeItem('pending_code')
        if (code) {
            try {
                await loginWithCode(code)
            } catch {
                setView('calculator')
            }
        }
    }

    function handleLogout() {
        logout()
        setView('calculator')
    }

    if (view === 'setup') return <PassphraseSetup onDone={handlePassphraseDone} />
    if (view === 'chat') return <div style={{ color: '#fff', background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 24 }}>已解鎖 ✓</span>
        <button onClick={handleLogout} style={{ padding: '8px 20px', borderRadius: 8, background: '#333', color: '#fff', border: 'none', cursor: 'pointer' }}>退出</button>
    </div>

    return <Calculator onUnlock={handleUnlock} lockoutSeconds={secondsLeft} />
}
```

- [ ] **Step 4: 設定 main.jsx（全螢幕樣式）**

```jsx
// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; }
  body { background: #1c1c1e; }
`
document.head.appendChild(style)

createRoot(document.getElementById('root')).render(
    <StrictMode><App /></StrictMode>
)
```

- [ ] **Step 5: 手動測試解鎖流程**

```bash
npm run dev
```
1. 開啟 http://localhost:5173
2. 看到計算機畫面
3. 輸入錯誤密碼（例如 `1234`）按 =，確認顯示 `Error` 並 3 秒後清零
4. 連續輸入錯誤 5 次，確認顯示鎖定倒數計時
5. 先在 localStorage 設定密語（DevTools → Application → Local Storage → 新增 `enc_passphrase`: `test`）
6. 輸入 `0417`（或 config.js 中設定的密碼）按 =，確認跳到「已解鎖」畫面

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: unlock logic with lockout (5 attempts, 5min) and passphrase setup"
```

---

## Task 8: 訊息 Service 與即時訂閱

**Files:**
- Create: `src/services/messageService.js`
- Create: `src/hooks/useMessages.js`

- [ ] **Step 1: 建立 messageService.js**

```js
// src/services/messageService.js
import {
    collection, addDoc, updateDoc, doc,
    serverTimestamp, query, orderBy, onSnapshot, arrayUnion
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase.js'
import { encrypt, encryptFile } from '../crypto.js'

const MESSAGES = collection(db, 'messages')

export async function sendTextMessage(text, senderId, encKey) {
    const encryptedContent = await encrypt(text, encKey)
    await addDoc(MESSAGES, {
        senderId,
        encryptedContent,
        type: 'text',
        timestamp: serverTimestamp(),
        readBy: [senderId],
    })
}

export async function sendMediaMessage(file, senderId, encKey) {
    const arrayBuffer = await file.arrayBuffer()
    const encryptedBuffer = await encryptFile(arrayBuffer, encKey)
    const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' })
    const type = file.type.startsWith('image/') ? 'image' : 'video'
    const storageRef = ref(storage, `media/${Date.now()}_${senderId}`)
    await uploadBytes(storageRef, blob)
    const url = await getDownloadURL(storageRef)
    const encryptedUrl = await encrypt(JSON.stringify({ url, mimeType: file.type }), encKey)
    await addDoc(MESSAGES, {
        senderId,
        encryptedContent: encryptedUrl,
        type,
        timestamp: serverTimestamp(),
        readBy: [senderId],
    })
}

export async function markAsRead(messageId, userId) {
    await updateDoc(doc(db, 'messages', messageId), {
        readBy: arrayUnion(userId)
    })
}

export function subscribeMessages(callback) {
    const q = query(MESSAGES, orderBy('timestamp', 'asc'))
    return onSnapshot(q, snapshot => {
        const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        callback(msgs)
    })
}
```

- [ ] **Step 2: 建立 useMessages.js**

```js
// src/hooks/useMessages.js
import { useState, useEffect } from 'react'
import { subscribeMessages, markAsRead } from '../services/messageService.js'
import { decrypt } from '../crypto.js'

export function useMessages(encKey, currentUserId) {
    const [messages, setMessages] = useState([])
    const [decrypted, setDecrypted] = useState([])

    useEffect(() => {
        if (!encKey) return
        return subscribeMessages(msgs => setMessages(msgs))
    }, [encKey])

    useEffect(() => {
        if (!encKey || !messages.length) return
        let cancelled = false
        async function decryptAll() {
            const results = await Promise.all(
                messages.map(async msg => {
                    try {
                        if (msg.type === 'text') {
                            const text = await decrypt(msg.encryptedContent, encKey)
                            return { ...msg, content: text }
                        } else {
                            const meta = JSON.parse(await decrypt(msg.encryptedContent, encKey))
                            return { ...msg, content: meta }
                        }
                    } catch {
                        return { ...msg, content: '[無法解密]' }
                    }
                })
            )
            if (!cancelled) setDecrypted(results)
        }
        decryptAll()
        return () => { cancelled = true }
    }, [messages, encKey])

    useEffect(() => {
        if (!currentUserId || !messages.length) return
        messages.forEach(msg => {
            if (!msg.readBy?.includes(currentUserId)) {
                markAsRead(msg.id, currentUserId)
            }
        })
    }, [messages, currentUserId])

    return decrypted
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/messageService.js src/hooks/useMessages.js
git commit -m "feat: message service with E2E encryption and real-time subscription"
```

---

## Task 9: 聊天介面

**Files:**
- Create: `src/components/ChatApp.jsx`
- Create: `src/components/MessageList.jsx`
- Create: `src/components/MessageItem.jsx`
- Create: `src/components/MessageInput.jsx`
- Create: `src/components/Chat.css`

- [ ] **Step 1: 建立 Chat.css**

```css
/* src/components/Chat.css */
.chat-app {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    background: #fff;
    font-family: -apple-system, sans-serif;
}

.chat-header {
    background: #f2f2f7;
    padding: env(safe-area-inset-top, 44px) 16px 12px;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
}

.chat-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 18px; font-weight: 600; flex-shrink: 0;
}

.chat-name { font-size: 17px; font-weight: 600; }
.chat-status { font-size: 12px; color: #8e8e93; }

.chat-header-actions {
    margin-left: auto; display: flex; gap: 16px;
}

.header-btn {
    background: none; border: none; font-size: 22px;
    cursor: pointer; padding: 4px; color: #007aff;
    -webkit-tap-highlight-color: transparent;
}

.messages-wrap {
    flex: 1; overflow-y: auto;
    padding: 12px 16px; display: flex;
    flex-direction: column; gap: 4px;
    -webkit-overflow-scrolling: touch;
}

.msg-date {
    text-align: center; font-size: 11px;
    color: #8e8e93; margin: 6px 0;
}

.bubble {
    max-width: 75%; padding: 9px 13px;
    border-radius: 18px; font-size: 15px;
    line-height: 1.4; word-break: break-word;
    position: relative;
}

.bubble-in {
    background: #f2f2f7; color: #000;
    align-self: flex-start; border-bottom-left-radius: 4px;
}

.bubble-out {
    background: #007aff; color: #fff;
    align-self: flex-end; border-bottom-right-radius: 4px;
}

.bubble.highlight { outline: 3px solid #ffd60a; }

.bubble-time {
    font-size: 10px; opacity: 0.6;
    margin-top: 3px; text-align: right;
}

.bubble-link {
    color: #007aff; text-decoration: underline; cursor: pointer;
}

.bubble-out .bubble-link { color: #cce4ff; }

.bubble-img {
    max-width: 220px; border-radius: 12px;
    cursor: pointer; display: block;
}

.bubble-video {
    max-width: 260px; border-radius: 12px;
    outline: none;
}

.chat-input-row {
    padding: 8px 12px;
    padding-bottom: max(8px, env(safe-area-inset-bottom, 8px));
    background: #f2f2f7; display: flex;
    align-items: flex-end; gap: 8px;
    border-top: 1px solid #e0e0e0; flex-shrink: 0;
}

.input-plus {
    width: 34px; height: 34px; border-radius: 50%;
    background: #c7c7cc; display: flex;
    align-items: center; justify-content: center;
    font-size: 20px; color: #fff; cursor: pointer;
    border: none; flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
}

.input-box {
    flex: 1; background: #fff; border-radius: 20px;
    border: 1px solid #e0e0e0; padding: 8px 14px;
    font-size: 15px; outline: none; resize: none;
    max-height: 120px; overflow-y: auto;
    font-family: -apple-system, sans-serif;
    -webkit-overflow-scrolling: touch;
}

.input-send {
    width: 34px; height: 34px; border-radius: 50%;
    background: #007aff; display: flex;
    align-items: center; justify-content: center;
    font-size: 18px; color: #fff; cursor: pointer;
    border: none; flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
}

.input-send:disabled { background: #c7c7cc; cursor: default; }
```

- [ ] **Step 2: 建立 MessageItem.jsx**

```jsx
// src/components/MessageItem.jsx
import { useEffect, useState } from 'react'
import { decryptFile } from '../crypto.js'

const URL_REGEX = /(https?:\/\/[^\s]+)/g

function TextWithLinks({ text, isOut }) {
    const parts = text.split(URL_REGEX)
    return parts.map((part, i) =>
        URL_REGEX.test(part)
            ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="bubble-link">{part}</a>
            : <span key={i}>{part}</span>
    )
}

function MediaBubble({ msg, encKey }) {
    const [src, setSrc] = useState(null)

    useEffect(() => {
        if (!encKey || !msg.content?.url) return
        let cancelled = false
        async function load() {
            const res = await fetch(msg.content.url)
            const buf = await res.arrayBuffer()
            const decrypted = await decryptFile(buf, encKey)
            if (!cancelled) {
                const blob = new Blob([decrypted], { type: msg.content.mimeType })
                setSrc(URL.createObjectURL(blob))
            }
        }
        load()
        return () => { cancelled = true }
    }, [msg.content, encKey])

    if (!src) return <span style={{ fontSize: 13, opacity: 0.6 }}>載入中…</span>

    if (msg.type === 'image') {
        return (
            <img
                src={src}
                className="bubble-img"
                onContextMenu={e => e.preventDefault()}
                onClick={() => window.open(src, '_blank')}
            />
        )
    }
    return (
        <video src={src} className="bubble-video" controls playsInline />
    )
}

export default function MessageItem({ msg, isOut, isHighlight, encKey }) {
    const otherUser = isOut ? null : '對方'
    const time = msg.timestamp?.toDate?.()?.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) ?? ''
    const readTick = isOut ? (msg.readBy?.length > 1 ? '✓✓' : '✓') : ''

    return (
        <div className={`bubble ${isOut ? 'bubble-out' : 'bubble-in'} ${isHighlight ? 'highlight' : ''}`} data-id={msg.id}>
            {msg.type === 'text' && typeof msg.content === 'string' && (
                <TextWithLinks text={msg.content} isOut={isOut} />
            )}
            {(msg.type === 'image' || msg.type === 'video') && (
                <MediaBubble msg={msg} encKey={encKey} />
            )}
            <div className="bubble-time">{time} {readTick}</div>
        </div>
    )
}
```

- [ ] **Step 3: 建立 MessageList.jsx**

```jsx
// src/components/MessageList.jsx
import { useEffect, useRef } from 'react'
import MessageItem from './MessageItem.jsx'
import { format, isToday, isYesterday } from 'date-fns'
import { zhTW } from 'date-fns/locale'

function formatDateLabel(date) {
    if (!date) return ''
    if (isToday(date)) return '今天'
    if (isYesterday(date)) return '昨天'
    return format(date, 'MM/dd', { locale: zhTW })
}

export default function MessageList({ messages, currentUserId, highlightId, encKey }) {
    const bottomRef = useRef(null)
    const highlightRef = useRef(null)

    useEffect(() => {
        if (highlightId && highlightRef.current) {
            highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages.length, highlightId])

    let lastDate = null

    return (
        <div className="messages-wrap">
            {messages.map(msg => {
                const date = msg.timestamp?.toDate?.()
                const dateStr = date ? format(date, 'yyyy-MM-dd') : null
                const showDate = dateStr && dateStr !== lastDate
                if (showDate) lastDate = dateStr

                return (
                    <div
                        key={msg.id}
                        ref={msg.id === highlightId ? highlightRef : null}
                    >
                        {showDate && <div className="msg-date">{formatDateLabel(date)}</div>}
                        <MessageItem
                            msg={msg}
                            isOut={msg.senderId === currentUserId}
                            isHighlight={msg.id === highlightId}
                            encKey={encKey}
                        />
                    </div>
                )
            })}
            <div ref={bottomRef} />
        </div>
    )
}
```

- [ ] **Step 4: 建立 MessageInput.jsx**

```jsx
// src/components/MessageInput.jsx
import { useState, useRef } from 'react'

export default function MessageInput({ onSend, onMediaSend }) {
    const [text, setText] = useState('')
    const fileRef = useRef(null)

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    function handleSend() {
        const t = text.trim()
        if (!t) return
        onSend(t)
        setText('')
    }

    async function handleFile(e) {
        const file = e.target.files?.[0]
        if (!file) return
        await onMediaSend(file)
        e.target.value = ''
    }

    return (
        <div className="chat-input-row">
            <button className="input-plus" onClick={() => fileRef.current?.click()}>＋</button>
            <input
                type="file"
                accept="image/*,video/*"
                ref={fileRef}
                style={{ display: 'none' }}
                onChange={handleFile}
            />
            <textarea
                className="input-box"
                placeholder="訊息…"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
            />
            <button className="input-send" onClick={handleSend} disabled={!text.trim()}>↑</button>
        </div>
    )
}
```

- [ ] **Step 5: 建立 ChatApp.jsx**

```jsx
// src/components/ChatApp.jsx
import { useState } from 'react'
import MessageList from './MessageList.jsx'
import MessageInput from './MessageInput.jsx'
import SearchPanel from './SearchPanel.jsx'
import CalendarView from './CalendarView.jsx'
import { useMessages } from '../hooks/useMessages.js'
import { sendTextMessage, sendMediaMessage } from '../services/messageService.js'
import './Chat.css'

export default function ChatApp({ userId, encKey, onLogout }) {
    const messages = useMessages(encKey, userId)
    const [view, setView] = useState('chat') // 'chat' | 'search' | 'calendar'
    const [highlightId, setHighlightId] = useState(null)

    async function handleSend(text) {
        await sendTextMessage(text, userId, encKey)
    }

    async function handleMediaSend(file) {
        await sendMediaMessage(file, userId, encKey)
    }

    function handleSearchJump(msgId) {
        setHighlightId(msgId)
        setView('chat')
        setTimeout(() => setHighlightId(null), 3000)
    }

    return (
        <div className="chat-app">
            <div className="chat-header">
                <div className="chat-avatar">A</div>
                <div>
                    <div className="chat-name">對話</div>
                    <div className="chat-status">加密連線中</div>
                </div>
                <div className="chat-header-actions">
                    <button className="header-btn" onClick={() => setView(v => v === 'search' ? 'chat' : 'search')}>🔍</button>
                    <button className="header-btn" onClick={() => setView(v => v === 'calendar' ? 'chat' : 'calendar')}>📅</button>
                    <button className="header-btn" onClick={onLogout} title="退出">⏻</button>
                </div>
            </div>

            {view === 'search' && (
                <SearchPanel messages={messages} onJump={handleSearchJump} />
            )}

            {view === 'calendar' && (
                <CalendarView encKey={encKey} userId={userId} />
            )}

            {view === 'chat' && (
                <>
                    <MessageList
                        messages={messages}
                        currentUserId={userId}
                        highlightId={highlightId}
                        encKey={encKey}
                    />
                    <MessageInput onSend={handleSend} onMediaSend={handleMediaSend} />
                </>
            )}
        </div>
    )
}
```

- [ ] **Step 6: 修改 App.jsx 的 chat view 使用 ChatApp**

將 App.jsx 中的臨時 `chat` view 替換為：

```jsx
// App.jsx 的 import 加入：
import ChatApp from './components/ChatApp.jsx'
import { getAuth } from './authStore.js'

// view === 'chat' 時改為：
if (view === 'chat') {
    const { userId, encKey } = getAuth()
    return <ChatApp userId={userId} encKey={encKey} onLogout={handleLogout} />
}
```

- [ ] **Step 7: 手動測試聊天功能**

1. 用兩個瀏覽器分頁分別以不同密碼登入（需先在 config.js 設定兩組帳號）
2. 在分頁 A 傳送訊息，確認分頁 B 即時收到並正確解密顯示
3. 確認連結自動可點擊
4. 確認 ✓✓ 已讀狀態正確更新

- [ ] **Step 8: Commit**

```bash
git add src/components/ src/hooks/
git commit -m "feat: chat UI with real-time E2E encrypted messages"
```

---

## Task 10: 訊息搜尋

**Files:**
- Create: `src/components/SearchPanel.jsx`

- [ ] **Step 1: 建立 SearchPanel.jsx**

```jsx
// src/components/SearchPanel.jsx
import { useState, useMemo } from 'react'
import { format } from 'date-fns'

export default function SearchPanel({ messages, onJump }) {
    const [query, setQuery] = useState('')

    const results = useMemo(() => {
        if (!query.trim()) return []
        const q = query.toLowerCase()
        return messages.filter(
            msg => msg.type === 'text' && typeof msg.content === 'string' && msg.content.toLowerCase().includes(q)
        )
    }, [query, messages])

    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: '#f2f2f7', overflow: 'hidden'
        }}>
            <div style={{ padding: '8px 16px', background: '#f2f2f7' }}>
                <input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="搜尋訊息…"
                    style={{
                        width: '100%', padding: '10px 14px', borderRadius: 12,
                        border: 'none', background: '#fff', fontSize: 15,
                        outline: 'none', fontFamily: '-apple-system, sans-serif'
                    }}
                />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
                {!query.trim() && (
                    <p style={{ color: '#8e8e93', fontSize: 14, textAlign: 'center', marginTop: 24 }}>輸入關鍵字搜尋</p>
                )}
                {query.trim() && !results.length && (
                    <p style={{ color: '#8e8e93', fontSize: 14, textAlign: 'center', marginTop: 24 }}>找不到符合結果</p>
                )}
                {results.map(msg => {
                    const date = msg.timestamp?.toDate?.()
                    const timeStr = date ? format(date, 'MM/dd HH:mm') : ''
                    const text = msg.content
                    const idx = text.toLowerCase().indexOf(query.toLowerCase())
                    return (
                        <div
                            key={msg.id}
                            onClick={() => onJump(msg.id)}
                            style={{
                                background: '#fff', borderRadius: 12,
                                padding: '12px 14px', marginTop: 8, cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                            }}
                        >
                            <div style={{ fontSize: 11, color: '#8e8e93', marginBottom: 4 }}>{timeStr}</div>
                            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                                {text.slice(0, idx)}
                                <mark style={{ background: '#ffd60a', borderRadius: 3, padding: '0 2px' }}>
                                    {text.slice(idx, idx + query.length)}
                                </mark>
                                {text.slice(idx + query.length)}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
```

- [ ] **Step 2: 手動測試搜尋**

1. 傳送幾則包含特定字詞的訊息
2. 點擊搜尋圖示，輸入關鍵字
3. 確認結果顯示並高亮關鍵字
4. 點擊結果，確認跳到對話中對應訊息位置，訊息框有黃色 outline 3 秒

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchPanel.jsx
git commit -m "feat: message search with highlight and jump-to-message"
```

---

## Task 11: 行事曆

**Files:**
- Create: `src/services/calendarService.js`
- Create: `src/hooks/useCalendar.js`
- Create: `src/components/CalendarView.jsx`
- Create: `src/components/EventModal.jsx`
- Create: `src/components/EventBanner.jsx`

- [ ] **Step 1: 建立 calendarService.js**

```js
// src/services/calendarService.js
import {
    collection, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp, query, orderBy, onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { encrypt, decrypt } from '../crypto.js'

const CALENDAR = collection(db, 'calendar')

export async function addEvent(event, createdBy, encKey) {
    const encryptedContent = await encrypt(JSON.stringify(event), encKey)
    await addDoc(CALENDAR, {
        encryptedContent,
        createdBy,
        timestamp: serverTimestamp(),
    })
}

export async function updateEvent(id, event, encKey) {
    const encryptedContent = await encrypt(JSON.stringify(event), encKey)
    await updateDoc(doc(db, 'calendar', id), { encryptedContent })
}

export async function deleteEvent(id) {
    await deleteDoc(doc(db, 'calendar', id))
}

export function subscribeCalendar(callback) {
    const q = query(CALENDAR, orderBy('timestamp', 'asc'))
    return onSnapshot(q, snapshot => {
        const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        callback(events)
    })
}

export async function decryptEvents(rawEvents, encKey) {
    return Promise.all(rawEvents.map(async ev => {
        try {
            const data = JSON.parse(await decrypt(ev.encryptedContent, encKey))
            return { id: ev.id, createdBy: ev.createdBy, ...data }
        } catch {
            return null
        }
    })).then(results => results.filter(Boolean))
}
```

- [ ] **Step 2: 建立 useCalendar.js**

```js
// src/hooks/useCalendar.js
import { useState, useEffect } from 'react'
import { subscribeCalendar, decryptEvents } from '../services/calendarService.js'

export function useCalendar(encKey) {
    const [events, setEvents] = useState([])

    useEffect(() => {
        if (!encKey) return
        return subscribeCalendar(async raw => {
            const decrypted = await decryptEvents(raw, encKey)
            setEvents(decrypted)
        })
    }, [encKey])

    return events
}
```

- [ ] **Step 3: 建立 EventModal.jsx**

```jsx
// src/components/EventModal.jsx
import { useState } from 'react'
import { addEvent, updateEvent, deleteEvent } from '../services/calendarService.js'

export default function EventModal({ event, encKey, userId, onClose }) {
    const isEdit = !!event?.id
    const [title, setTitle] = useState(event?.title ?? '')
    const [date, setDate] = useState(event?.date ?? '')
    const [time, setTime] = useState(event?.time ?? '')
    const [note, setNote] = useState(event?.note ?? '')
    const [loading, setLoading] = useState(false)

    async function handleSave() {
        if (!title || !date) return
        setLoading(true)
        const data = { title, date, time, note }
        if (isEdit) await updateEvent(event.id, data, encKey)
        else await addEvent(data, userId, encKey)
        setLoading(false)
        onClose()
    }

    async function handleDelete() {
        if (!isEdit) return
        setLoading(true)
        await deleteEvent(event.id)
        setLoading(false)
        onClose()
    }

    const overlay = {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', zIndex: 100
    }
    const sheet = {
        width: '100%', background: '#1c1c1e', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 40px', color: '#fff',
        fontFamily: '-apple-system, sans-serif'
    }
    const field = {
        width: '100%', background: '#2c2c2e', border: 'none', borderRadius: 10,
        padding: '12px 14px', color: '#fff', fontSize: 15, marginBottom: 10,
        outline: 'none', boxSizing: 'border-box', fontFamily: '-apple-system, sans-serif'
    }

    return (
        <div style={overlay} onClick={onClose}>
            <div style={sheet} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginBottom: 16, fontWeight: 600 }}>{isEdit ? '編輯事件' : '新增事件'}</h3>
                <input style={field} placeholder="標題 *" value={title} onChange={e => setTitle(e.target.value)} />
                <input style={field} type="date" value={date} onChange={e => setDate(e.target.value)} />
                <input style={field} type="time" value={time} onChange={e => setTime(e.target.value)} />
                <textarea style={{ ...field, resize: 'none', height: 80 }} placeholder="備註（選填）" value={note} onChange={e => setNote(e.target.value)} />
                <button
                    onClick={handleSave} disabled={loading || !title || !date}
                    style={{ width: '100%', padding: 14, borderRadius: 12, background: '#ff9f0a', border: 'none', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: isEdit ? 10 : 0 }}
                >
                    {loading ? '儲存中…' : '儲存'}
                </button>
                {isEdit && (
                    <button
                        onClick={handleDelete} disabled={loading}
                        style={{ width: '100%', padding: 14, borderRadius: 12, background: '#ff453a', border: 'none', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                    >
                        刪除事件
                    </button>
                )}
            </div>
        </div>
    )
}
```

- [ ] **Step 4: 建立 CalendarView.jsx**

```jsx
// src/components/CalendarView.jsx
import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, isSameDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useCalendar } from '../hooks/useCalendar.js'
import EventModal from './EventModal.jsx'

export default function CalendarView({ encKey, userId }) {
    const events = useCalendar(encKey)
    const [current, setCurrent] = useState(new Date())
    const [selected, setSelected] = useState(null)
    const [modal, setModal] = useState(null) // null | 'add' | event object

    const monthStart = startOfMonth(current)
    const monthEnd = endOfMonth(current)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const startPad = getDay(monthStart) // 0=日

    const dayEvents = selected ? events.filter(ev => ev.date === format(selected, 'yyyy-MM-dd')) : []

    function prevMonth() { setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
    function nextMonth() { setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

    function hasDot(day) {
        const dateStr = format(day, 'yyyy-MM-dd')
        return events.some(ev => ev.date === dateStr)
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflowY: 'auto' }}>
            {/* 月份導航 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e0e0e0' }}>
                <button onClick={prevMonth} style={navBtn}>‹</button>
                <span style={{ fontWeight: 600, fontSize: 17 }}>{format(current, 'yyyy年 M月', { locale: zhTW })}</span>
                <button onClick={nextMonth} style={navBtn}>›</button>
            </div>

            {/* 星期標題 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fff', padding: '4px 8px 0' }}>
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 12, color: '#8e8e93', padding: '4px 0' }}>{d}</div>
                ))}
            </div>

            {/* 日曆格子 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fff', padding: '0 8px 8px', gap: 2 }}>
                {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
                {days.map(day => {
                    const isSelected = selected && isSameDay(day, selected)
                    const dot = hasDot(day)
                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => setSelected(isSameDay(day, selected) ? null : day)}
                            style={{
                                textAlign: 'center', padding: '6px 0', cursor: 'pointer',
                                borderRadius: 8,
                                background: isSelected ? '#007aff' : 'transparent',
                            }}
                        >
                            <div style={{
                                fontSize: 15,
                                color: isSelected ? '#fff' : isToday(day) ? '#007aff' : '#000',
                                fontWeight: isToday(day) ? 700 : 400,
                            }}>
                                {format(day, 'd')}
                            </div>
                            {dot && <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : '#ff9f0a', margin: '2px auto 0' }} />}
                        </div>
                    )
                })}
            </div>

            {/* 當日事件清單 */}
            {selected && (
                <div style={{ padding: '12px 16px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{format(selected, 'M月d日', { locale: zhTW })}</span>
                        <button onClick={() => setModal('add')} style={{ background: '#007aff', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 14, cursor: 'pointer' }}>+ 新增</button>
                    </div>
                    {dayEvents.length === 0 && <p style={{ color: '#8e8e93', fontSize: 14 }}>這天沒有事件</p>}
                    {dayEvents.map(ev => (
                        <div
                            key={ev.id}
                            onClick={() => setModal(ev)}
                            style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                        >
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{ev.title}</div>
                            {ev.time && <div style={{ fontSize: 13, color: '#8e8e93', marginTop: 2 }}>{ev.time}</div>}
                            {ev.note && <div style={{ fontSize: 13, color: '#636366', marginTop: 4 }}>{ev.note}</div>}
                        </div>
                    ))}
                </div>
            )}

            {modal && (
                <EventModal
                    event={modal === 'add' ? { date: format(selected, 'yyyy-MM-dd') } : modal}
                    encKey={encKey}
                    userId={userId}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    )
}

const navBtn = {
    background: 'none', border: 'none', fontSize: 24,
    color: '#007aff', cursor: 'pointer', padding: '4px 12px'
}
```

- [ ] **Step 5: 建立 EventBanner.jsx**

```jsx
// src/components/EventBanner.jsx
import { useMemo } from 'react'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export default function EventBanner({ events, onDismiss }) {
    const upcoming = useMemo(() => {
        return events.filter(ev => {
            if (!ev.date) return false
            const d = parseISO(ev.date)
            return isToday(d) || isTomorrow(d)
        })
    }, [events])

    if (!upcoming.length) return null

    return (
        <div style={{
            background: '#ff9f0a', padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: '-apple-system, sans-serif', flexShrink: 0
        }}>
            <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>行事曆提醒</div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                    {upcoming[0].date && format(parseISO(upcoming[0].date), 'M月d日', { locale: zhTW })} · {upcoming[0].title}
                    {upcoming.length > 1 && ` 等 ${upcoming.length} 項`}
                </div>
            </div>
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
    )
}
```

- [ ] **Step 6: 在 ChatApp.jsx 加入 EventBanner**

在 ChatApp.jsx 加入：
```jsx
import EventBanner from './EventBanner.jsx'
import { useCalendar } from '../hooks/useCalendar.js'

// 在 ChatApp 函式內加入：
const events = useCalendar(encKey)
const [bannerDismissed, setBannerDismissed] = useState(false)

// 在 return 內，chat-header 之後加入：
{!bannerDismissed && (
    <EventBanner events={events} onDismiss={() => setBannerDismissed(true)} />
)}
```

- [ ] **Step 7: 手動測試行事曆**

1. 進入聊天 → 點 📅 圖示
2. 新增一個今天的事件，確認橘色圓點出現
3. 點擊事件確認可以編輯/刪除
4. 關閉重開 app，確認進入後橘色提醒橫幅出現

- [ ] **Step 8: Commit**

```bash
git add src/services/calendarService.js src/hooks/useCalendar.js src/components/
git commit -m "feat: shared calendar with event reminder banner"
```

---

## Task 12: 部署至 Firebase Hosting

**Files:**
- Modify: `vite.config.js`（確認 build 設定）

- [ ] **Step 1: 確認 Firebase CLI 已安裝並登入**

```bash
firebase --version
firebase login --no-localhost
```
Expected: 顯示版本號；瀏覽器完成 Google 登入

- [ ] **Step 2: 部署 Firestore 與 Storage 規則**

```bash
firebase deploy --only firestore:rules,storage
```
Expected: `✔ Deploy complete!`

- [ ] **Step 3: Build 並部署 Hosting**

```bash
npm run build
firebase deploy --only hosting
```
Expected：
```
✔ Deploy complete!
Project Console: https://console.firebase.google.com/...
Hosting URL: https://secret-chat-app.web.app
```

- [ ] **Step 4: iOS 安裝測試**

1. 用 iPhone Safari 開啟 Hosting URL
2. 點擊 Safari 底部分享圖示 → 「加入主畫面」
3. 確認圖示名稱顯示「記帳本」（非網址）
4. 從主畫面啟動，確認以全螢幕方式開啟（無瀏覽器工具列）
5. 輸入密碼確認解鎖正常

- [ ] **Step 5: 確認對方可以正常收發訊息**

兩台裝置分別登入不同帳號，確認：
- 文字訊息即時收發 ✓
- 圖片上傳顯示 ✓
- 已讀回條 ✓
- 行事曆新增事件雙方可見 ✓

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: production deployment to Firebase Hosting"
```

---

## 自查：規格覆蓋率

| 規格需求 | 對應 Task |
|---------|---------|
| PWA，存到 iOS 主畫面 | Task 2 |
| 計算機偽裝殼 | Task 6 |
| 輸入密碼 + 按 = 解鎖 | Task 6, 7 |
| 錯誤不給提示，5 次鎖 5 分鐘 | Task 7 |
| 退出 → 切回計算機 | Task 7, 9 |
| AES-256-GCM 端對端加密 | Task 4, 5 |
| Firebase Firestore 儲存訊息 | Task 8 |
| 文字訊息 | Task 9 |
| 連結自動偵測跳轉 | Task 9 |
| 圖片（點大、長按存） | Task 9 |
| 影片（播放、下載） | Task 9 |
| 已讀回條 ✓✓ | Task 8, 9 |
| 訊息持久（關閉不遺失） | Task 8 |
| 訊息搜尋 + 跳轉 + 黃色高亮 | Task 10 |
| 共享行事曆 CRUD | Task 11 |
| 行事曆月曆視圖（橘點） | Task 11 |
| 進 app 提醒橫幅 | Task 11 |
| 零鎖定畫面通知 | 未使用任何 Push API ✓ |
| 部署 Firebase Hosting | Task 12 |
