import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

const snap = await db.collection('users').get()
console.log(`共 ${snap.size} 個用戶:`)
snap.docs.forEach(d => {
    const { name, role, companyId, email, disabled } = d.data()
    const status = disabled ? '【已停用】' : '【啟用中】'
    console.log(`  ${status} ${name} | role: ${role} | 分區: ${companyId} | ${email || ''}`)
})
process.exit(0)
