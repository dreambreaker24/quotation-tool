// naiship-system/tests/quotation-regression/compare-new-vs-old.mjs
// 把 6 筆題庫餵給新版 /quotation-preview-dev，匯出 PDF 轉成圖片，
// 跟 baselines/ 裡的舊版基準圖逐像素比對，差異區標紅存成 diff 圖供人工複查。
//
// 前置：naiship-system 的 dev server 要先在 5173 跑起來（npx vite --port 5173）
//
// 用法：node tests/quotation-regression/compare-new-vs-old.mjs
import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { fixtures } from './fixtures.mjs'

// 用腳本自己的位置推路徑，而不是寫死絕對路徑——這支腳本會在 main checkout
// 跟不同的 worktree 底下重複執行，寫死路徑在 worktree 合併回 main 後就會失效
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_DIR = path.join(__dirname, 'baselines')
const DIFF_DIR = path.join(__dirname, 'diffs')
// e2e 登入態是柏手動存的一次性檔案（見 tests/e2e/README 或專案記憶），只在 main
// checkout 存一份供全專案共用，worktree 不重複存，所以這裡固定指向 main checkout
const AUTH_DIR = 'C:/AI助理 Claude/naiship-system/tests/e2e'
mkdirSync(DIFF_DIR, { recursive: true })

// 兩邊截圖是分別由不同瀏覽器頁面 context 產生，A4 頁面寬度會有 1px 的次像素捨入差
// （794 vs 795），這 1px 偏移讓整頁文字邊緣的抗鋸齒像素幾乎全部判定為「不同」，
// 但視覺上完全對齊、無位移無錯位（已用 getBoundingClientRect 逐項量測跟人工比對圖確認）。
// 6 組題庫實測雜訊落在 0.7~6.5% 之間，門檻抓 8% 是要讓這支腳本能抓到「真的」跑版
// （例如某個大項高度累加位移那種級別的錯誤，實測會到 17~36%），不是要放水
const MISMATCH_THRESHOLD_PCT = 8

// 把小圖「貼」到跟大圖一樣大的白底畫布上（不縮放，只是延伸畫布右/下邊界），
// 這樣尺寸有個位數 px 誤差（不同瀏覽器/DPI 的次像素捨入，不是內容問題）時
// pixelmatch 還是能跑，不會因為尺寸不同就直接判定失敗、看不到真正的內容差異
function padToMatch(img, width, height) {
    if (img.width === width && img.height === height) return img
    const padded = new PNG({ width, height })
    padded.data.fill(255) // 白底
    PNG.bitblt(img, padded, 0, 0, Math.min(img.width, width), Math.min(img.height, height), 0, 0)
    return padded
}

function comparePng(oldPath, newPath, diffPath) {
    if (!existsSync(oldPath) || !existsSync(newPath)) {
        return { ok: false, reason: `檔案不存在：${!existsSync(oldPath) ? oldPath : newPath}` }
    }
    let img1 = PNG.sync.read(readFileSync(oldPath))
    let img2 = PNG.sync.read(readFileSync(newPath))
    const oldSize = `${img1.width}x${img1.height}`
    const newSize = `${img2.width}x${img2.height}`
    const sizeMismatch = img1.width !== img2.width || img1.height !== img2.height
    const width = Math.max(img1.width, img2.width)
    const height = Math.max(img1.height, img2.height)
    if (sizeMismatch) {
        img1 = padToMatch(img1, width, height)
        img2 = padToMatch(img2, width, height)
    }
    const diff = new PNG({ width, height })
    const mismatched = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 })
    const pct = (mismatched / (width * height)) * 100
    writeFileSync(diffPath, PNG.sync.write(diff))
    return { ok: pct < MISMATCH_THRESHOLD_PCT, mismatched, pct, total: width * height, sizeMismatch, oldSize, newSize }
}

// /quotation-preview-dev 跟其他頁面一樣需要登入態（router 沒設 meta.public），
// 沿用專案既有的登入態重用技巧：把柏之前登入時存好的 Firebase Auth IndexedDB 記錄
// 灌回一個全新的瀏覽器 context，不用每次都真的走 Google 登入流程
const firebaseAuth = JSON.parse(readFileSync(`${AUTH_DIR}/firebase-auth.json`, 'utf-8'))
const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] })
// 視窗高度要夠大，一次裝下整張 A4 預覽（最長的題庫大約 1600px 高），
// 不然 Playwright 對「比視窗還高的元素」截圖時會捲動拼接，而 naiship-system 的
// 導覽列是 position:fixed 釘在畫面上，捲動拼接過程中會被重複截進去、插在內容中間
const context = await browser.newContext({ viewport: { width: 900, height: 2400 }, storageState: `${AUTH_DIR}/auth-state.json` })
const page = await context.newPage()
page.on('pageerror', e => console.log('PAGEERROR:', e.message))
await page.addInitScript((records) => {
    const req = indexedDB.open('firebaseLocalStorageDb', 1)
    req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('firebaseLocalStorage')) db.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' })
    }
    req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(Array.from(db.objectStoreNames)[0], 'readwrite')
        records.forEach(r => tx.objectStore(Array.from(db.objectStoreNames)[0]).put(r))
    }
}, firebaseAuth)

const results = []
for (const fixture of fixtures) {
    await page.goto('http://localhost:5173/quotation-preview-dev', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await page.selectOption('select', fixture.id)
    await page.waitForTimeout(500)

    const page1El = page.locator('#a4-page')
    const newPage1Path = `${DIFF_DIR}/${fixture.id}--page1-new.png`
    await page1El.screenshot({ path: newPage1Path })

    const page2El = page.locator('#a4-page-2')
    const newPage2Path = `${DIFF_DIR}/${fixture.id}--page2-new.png`
    await page2El.screenshot({ path: newPage2Path })

    const r1 = comparePng(`${BASELINE_DIR}/${fixture.id}--page1.png`, newPage1Path, `${DIFF_DIR}/${fixture.id}--page1-diff.png`)
    const r2 = comparePng(`${BASELINE_DIR}/${fixture.id}--page2.png`, newPage2Path, `${DIFF_DIR}/${fixture.id}--page2-diff.png`)

    results.push({ id: fixture.id, page1: r1, page2: r2 })
    console.log(`[${fixture.id}]`)
    console.log(`  page1: ${r1.ok ? '✅' : '❌'} ${r1.pct !== undefined ? r1.pct.toFixed(3) + '%' : r1.reason}${r1.sizeMismatch ? ` (尺寸：舊 ${r1.oldSize} / 新 ${r1.newSize})` : ''}`)
    console.log(`  page2: ${r2.ok ? '✅' : '❌'} ${r2.pct !== undefined ? r2.pct.toFixed(3) + '%' : r2.reason}${r2.sizeMismatch ? ` (尺寸：舊 ${r2.oldSize} / 新 ${r2.newSize})` : ''}`)
}

const allOk = results.every(r => r.page1.ok && r.page2.ok)
console.log('\n=== 總結 ===')
console.log(allOk ? '✅ 全部通過' : '❌ 有未通過項目，請查看 diffs/ 資料夾裡標紅的比對圖')

await browser.close()
process.exit(allOk ? 0 : 1)
