// 媒體網址健檢：唯讀掃描 Firestore，列出每個位置有幾筆網址、各自的主機分佈。
// 獨立手動工具（Phase B 搬家前後對照用），涵蓋位置與 migrate-media-to-nas.mjs
// 的 buildWorklist 一致；搬家腳本執行時不會呼叫這支。
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

const tally = {}
function note(bucket, url) {
    if (!url || typeof url !== 'string') return
    let host = '(relative)'
    try { if (url.startsWith('http')) host = new URL(url).host } catch {}
    tally[bucket] ??= { total: 0, hosts: {} }
    tally[bucket].total++
    tally[bucket].hosts[host] = (tally[bucket].hosts[host] || 0) + 1
}

// cases/{id}/photos
for (const p of (await db.collectionGroup('photos').get()).docs) note('cases/*/photos.url', p.data().url)

// cases/{id}.workTypes[].invoiceFile.url（存在案件文件本身）
for (const c of (await db.collection('cases').get()).docs)
    (c.data().workTypes || []).forEach(wt => note('cases.workTypes[].invoiceFile.url', wt?.invoiceFile?.url))

// cases/{id}/tasks .attachments[]
for (const t of (await db.collectionGroup('tasks').get()).docs)
    (t.data().attachments || []).forEach(a => note('cases/*/tasks.attachments[].url', a?.url))

// cases/{id}/progressNotes
for (const n of (await db.collectionGroup('progressNotes').get()).docs) {
    const d = n.data()
    note('cases/*/progressNotes.url', d.url)
    ;(d.attachments || []).forEach(a => note('cases/*/progressNotes.attachments[].url', a?.url))
    ;(d.images || []).forEach(u => note('cases/*/progressNotes.images[]', typeof u === 'string' ? u : u?.url))
}

// cases/{id}/reviews
for (const r of (await db.collectionGroup('reviews').get()).docs) {
    const d = r.data()
    ;(d.attachments || []).forEach(a => note('cases/*/reviews.attachments[].url', a?.url))
    ;(d.images || []).forEach(u => note('cases/*/reviews.images[]', typeof u === 'string' ? u : u?.url))
    note('cases/*/reviews.url', d.url)
}

// announcements.images[]
for (const a of (await db.collection('announcements').get()).docs)
    (a.data().images || []).forEach(u => note('announcements.images[]', u))

// workLogs
for (const l of (await db.collection('workLogs').get()).docs) {
    const d = l.data()
    ;(d.attachments || []).forEach(a => note('workLogs.attachments[].url', a?.url))
    ;(d.logAttachments || []).forEach(a => note('workLogs.logAttachments[].url', a?.url))
    ;(d.fuelExpenses || []).forEach(f => note('workLogs.fuelExpenses[].photoUrl', f?.photoUrl))
    note('workLogs.fuelExpense.photoUrl', d.fuelExpense?.photoUrl)
    ;(d.replies || []).forEach(r =>
        (r?.attachments || []).forEach(a => note('workLogs.replies[].attachments[].url', a?.url)))
}

// dashboardNotes
for (const n of (await db.collection('dashboardNotes').get()).docs) {
    const d = n.data()
    note('dashboardNotes.url', d.url)
    ;(d.attachments || []).forEach(a => note('dashboardNotes.attachments[].url', a?.url))
}

// pettyCash
for (const e of (await db.collection('pettyCash').get()).docs) {
    const d = e.data()
    note('pettyCash.imageUrl', d.imageUrl)
    ;(d.receiptImages || []).forEach(u => note('pettyCash.receiptImages[]', typeof u === 'string' ? u : u?.url))
    ;(d.images || d.receipts || []).forEach(u => note('pettyCash.images[]', typeof u === 'string' ? u : u?.url))
}

// clients/{id}/notes
for (const n of (await db.collectionGroup('notes').get()).docs) {
    const d = n.data()
    ;(d.attachments || []).forEach(a => note('clients/*/notes.attachments[].url', a?.url))
    ;(d.images || []).forEach(u => note('clients/*/notes.images[]', typeof u === 'string' ? u : u?.url))
}

let grand = 0
for (const k of Object.keys(tally)) grand += tally[k].total
console.log(JSON.stringify(tally, null, 2))
console.log('GRAND TOTAL URLs:', grand)
process.exit(0)
