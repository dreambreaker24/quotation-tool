// 一次性清資料：刪除機制 A（工種完工自動建立整工種付款提醒）留下的舊提醒文件。
// 注意：不可用文件 id 是否以 auto_vendor_ 開頭當篩選條件，
// 分項/分階段的手動提醒（使用者按「提醒主管」建立）id 也長這樣但沒有 source 欄位，要保留。
// 只有同時帶 source === 'auto' 且 type === 'vendor' 的才是機制 A 的舊資料，才會被刪除。
// 這個規模的資料量遠低於 Firestore 單批 500 筆的上限，不用分批。
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

const snap = await db.collection('paymentReminders')
    .where('source', '==', 'auto')
    .where('type', '==', 'vendor')
    .get()

console.log(`找到 ${snap.size} 筆整工種自動提醒，開始刪除：`)
for (const doc of snap.docs) {
    const d = doc.data()
    console.log(`  刪除 ${doc.id}  caseName=${d.caseName} workTypeName=${d.workTypeName}`)
}

const batch = db.batch()
for (const doc of snap.docs) batch.delete(doc.ref)
await batch.commit()

console.log(`已刪除 ${snap.size} 筆`)
process.exit(0)
