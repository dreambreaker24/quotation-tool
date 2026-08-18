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
import { fixtures } from './fixtures.mjs'

const BASELINE_DIR = 'C:/AI助理 Claude/naiship-system/tests/quotation-regression/baselines'
const DIFF_DIR = 'C:/AI助理 Claude/naiship-system/tests/quotation-regression/diffs'
mkdirSync(DIFF_DIR, { recursive: true })

const MISMATCH_THRESHOLD_PCT = 0.5 // 單張圖差異像素超過總像素 0.5% 才算不通過

function comparePng(oldPath, newPath, diffPath) {
    if (!existsSync(oldPath) || !existsSync(newPath)) {
        return { ok: false, reason: `檔案不存在：${!existsSync(oldPath) ? oldPath : newPath}` }
    }
    const img1 = PNG.sync.read(readFileSync(oldPath))
    const img2 = PNG.sync.read(readFileSync(newPath))
    if (img1.width !== img2.width || img1.height !== img2.height) {
        return { ok: false, reason: `尺寸不同：舊版 ${img1.width}x${img1.height} vs 新版 ${img2.width}x${img2.height}` }
    }
    const { width, height } = img1
    const diff = new PNG({ width, height })
    const mismatched = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 })
    const pct = (mismatched / (width * height)) * 100
    writeFileSync(diffPath, PNG.sync.write(diff))
    return { ok: pct < MISMATCH_THRESHOLD_PCT, mismatched, pct, total: width * height }
}

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 900, height: 1300 } })
page.on('pageerror', e => console.log('PAGEERROR:', e.message))

const results = []
for (const fixture of fixtures) {
    await page.goto('http://localhost:5173/quotation-preview-dev', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
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
    console.log(`  page1: ${r1.ok ? '✅' : '❌'} ${r1.pct !== undefined ? r1.pct.toFixed(3) + '%' : r1.reason}`)
    console.log(`  page2: ${r2.ok ? '✅' : '❌'} ${r2.pct !== undefined ? r2.pct.toFixed(3) + '%' : r2.reason}`)
}

const allOk = results.every(r => r.page1.ok && r.page2.ok)
console.log('\n=== 總結 ===')
console.log(allOk ? '✅ 全部通過' : '❌ 有未通過項目，請查看 diffs/ 資料夾裡標紅的比對圖')

await browser.close()
process.exit(allOk ? 0 : 1)
