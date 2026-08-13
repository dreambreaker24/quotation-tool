// 報價系統 Vue 改寫前提②：把 fixtures.mjs 裡的每一筆測試資料餵給「舊版」
// quotation-dev.html，把 A4 預覽稿紙截圖存成基準圖（baseline）。
// 之後 Vue 版本做出來，用同樣的資料跑一次「新版」截圖，兩邊逐像素比對即可。
//
// 用法：node tests/quotation-regression/capture-baseline.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import { fixtures } from './fixtures.mjs'

const OUT_DIR = 'C:/AI助理 Claude/naiship-system/tests/quotation-regression/baselines'
const FILE_URL = 'file:///C:/AI助理%20Claude/quotation-dev.html'

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] })

for (const fixture of fixtures) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    await page.evaluate((data) => { loadQuote(data) }, fixture.data)
    await page.waitForTimeout(500)

    // 收合輸入區，讓預覽區拿到完整寬度——輸入區桌面版是 80% 彈性寬，寬螢幕下會把
    // 固定 793px 寬的 A4 稿紙擠到溢出視窗外，收合後就是使用者實際會看到的完整預覽
    await page.evaluate(() => { togglePreviewExpand() })
    await page.waitForTimeout(300)

    const page1 = page.locator('#a4-page')
    await page1.screenshot({ path: `${OUT_DIR}/${fixture.id}--page1.png` })

    const page2 = page.locator('#a4-page-2')
    const page2Visible = await page2.isVisible().catch(() => false)
    if (page2Visible) {
        await page2.screenshot({ path: `${OUT_DIR}/${fixture.id}--page2.png` })
    }

    console.log(`[${fixture.id}] ${fixture.label} — page2:${page2Visible ? 'yes' : 'no'} errors:${errors.length}`)
    if (errors.length) errors.forEach(e => console.log('   !', e.slice(0, 150)))

    await page.close()
}

console.log('DONE — baselines saved to', OUT_DIR)
await browser.close()
