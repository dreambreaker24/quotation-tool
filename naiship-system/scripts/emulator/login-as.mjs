// Playwright 測試用：在連模擬資料庫的頁面上，直接以指定 uid 登入（不用走 Google 登入）。
// 用法：import { loginAs } from '../../scripts/emulator/login-as.mjs'；await loginAs(page, uid)
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

export async function loginAs(page, uid) {
    if (!getApps().length) initializeApp({ projectId: 'quotation-system-ddc5c' })
    const token = await getAuth().createCustomToken(uid)
    await page.waitForFunction(() => typeof window.__e2eSignIn === 'function')
    await page.evaluate(t => window.__e2eSignIn(t), token)
}
