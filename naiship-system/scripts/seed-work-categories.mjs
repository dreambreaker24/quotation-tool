// scripts/seed-work-categories.mjs
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

const WORK_CATEGORIES = ['材料行', '建材行', '廚具', '油漆', '清運拆除', '泥作', '木工', '水電', '玻璃', '鐵工', '工程', '清潔', '系統櫃', '冷氣', '貼膜', '地板', '軟裝', '其他']

const existing = await db.collection('workCategories').get()
if (existing.size > 0) {
    console.log(`workCategories 已經有 ${existing.size} 筆資料，判斷已經遷移過，不重複執行`)
    process.exit(0)
}

const now = Date.now()
for (let i = 0; i < WORK_CATEGORIES.length; i++) {
    const name = WORK_CATEGORIES[i]
    // createdAt 依序遞增 1 毫秒，確保 orderBy('createdAt') 讀出來的順序完全比照原本陣列順序
    await db.collection('workCategories').add({ name, createdAt: Timestamp.fromMillis(now + i) })
    console.log(`已新增：${name}`)
}
console.log(`遷移完成，共 ${WORK_CATEGORIES.length} 筆`)
process.exit(0)
