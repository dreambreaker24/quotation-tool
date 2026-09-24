// 把 tests/e2e/emulator-seed.json 灌進本機模擬資料庫，並替每個 users 文件建立同 uid 的模擬登入帳號。
// 只會連 localhost 的模擬器，不會碰正式資料庫。先開 `npm run emulators` 再執行。
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'fs'
import { fromJson } from './serialize.mjs'

initializeApp({ projectId: 'quotation-system-ddc5c' })
const db = getFirestore()
const { docs } = JSON.parse(readFileSync('tests/e2e/emulator-seed.json', 'utf8'))

const entries = Object.entries(docs)
for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch()
    for (const [path, data] of entries.slice(i, i + 400)) batch.set(db.doc(path), fromJson(data, db))
    await batch.commit()
}
console.log(`已寫入 ${entries.length} 筆文件`)

const auth = getAuth()
let created = 0
for (const [path, data] of entries) {
    const m = path.match(/^users\/([^/]+)$/)
    if (!m) continue
    try {
        await auth.createUser({ uid: m[1], email: data.email || undefined, displayName: data.name || undefined })
        created++
    } catch (e) {
        if (e.code !== 'auth/uid-already-exists' && e.code !== 'auth/email-already-exists') throw e
    }
}
console.log(`已建立 ${created} 個模擬登入帳號`)
process.exit(0)
