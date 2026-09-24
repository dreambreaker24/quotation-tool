// 從正式資料庫匯出一份快照給模擬資料庫用（只讀）。會吃掉「資料總筆數」次讀取額度，
// 所以先印出各集合筆數；加 --write 才真的匯出。通知（notifications）跟測試無關，不匯出。
// 用法：node scripts/emulator/export-prod-snapshot.mjs [--write]
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { toJson } from './serialize.mjs'

const SKIP = new Set(['notifications'])
const SUBCOLLECTIONS = ['photos', 'bidRequests', 'progressNotes', 'tasks', 'reviews', 'notes', 'contactLogs', 'compAdjustments', 'compCashouts', 'compLedger']
const OUT = 'tests/e2e/emulator-seed.json'

initializeApp({ credential: cert(JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))) })
const db = getFirestore()

const topLevel = (await db.listCollections()).map(c => c.id).filter(id => !SKIP.has(id))
const sources = [
    ...topLevel.map(id => ({ label: id, query: db.collection(id) })),
    ...SUBCOLLECTIONS.map(id => ({ label: `*/${id}`, query: db.collectionGroup(id) })),
]

let total = 0
for (const s of sources) {
    s.count = (await s.query.count().get()).data().count
    total += s.count
    console.log(`${s.label.padEnd(22)} ${s.count}`)
}
console.log(`合計 ${total} 筆（匯出一次約吃 ${total} 次讀取，每日額度 50,000）`)
console.log(`略過：${[...SKIP].join('、')}`)

if (process.argv.includes('--write')) {
    const docs = {}
    for (const s of sources) {
        const snap = await s.query.get()
        for (const d of snap.docs) docs[d.ref.path] = toJson(d.data())
    }
    mkdirSync('tests/e2e', { recursive: true })
    writeFileSync(OUT, JSON.stringify({ exportedAt: new Date().toISOString(), docs }))
    console.log(`已匯出 ${Object.keys(docs).length} 筆到 ${OUT}`)
}
process.exit(0)
