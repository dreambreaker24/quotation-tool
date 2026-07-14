import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const WORK_CATEGORIES = ['材料行', '建材行', '廚具', '油漆', '清運拆除', '泥作', '木工', '水電', '玻璃', '鐵工', '工程', '清潔', '系統櫃', '冷氣', '貼膜', '地板', '軟裝', '其他']

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

const snap = await db.collection('cases').get()
let count = 0
snap.docs.forEach(d => {
    const workTypes = d.data().workTypes || []
    workTypes.forEach(wt => {
        if (wt.name && !WORK_CATEGORIES.includes(wt.name)) {
            count++
            console.log(`  案件 ${d.id}（${d.data().name || ''}）工種「${wt.name}」不在標準清單內`)
        }
    })
})
console.log(`共 ${count} 筆非標準工種名稱`)
process.exit(0)
