// 一次性查詢：機制 A（工種完工自動建立整工種付款提醒）已從程式碼拔除，
// 這支腳本只唯讀查詢 Firestore 裡舊機制留下的提醒文件，供刪除前確認數量與內容。
// 注意：不可用文件 id 是否以 auto_vendor_ 開頭當篩選條件，
// 分項/分階段的手動提醒（使用者按「提醒主管」建立）id 也長這樣但沒有 source 欄位，要保留。
// 只有同時帶 source === 'auto' 且 type === 'vendor' 的才是機制 A 的舊資料。
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

console.log(`找到 ${snap.size} 筆整工種自動提醒（source=auto, type=vendor）：`)
for (const doc of snap.docs) {
    const d = doc.data()
    console.log(`  ${doc.id}  status=${d.status} caseName=${d.caseName} workTypeName=${d.workTypeName} amount=${d.amount} dueDate=${d.dueDate}`)
}
process.exit(0)
