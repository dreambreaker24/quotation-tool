import admin from 'firebase-admin'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const KEY_PATH = path.join(__dirname, '../firebase-admin-key.json')
admin.initializeApp({ credential: admin.credential.cert(KEY_PATH) })
const db = admin.firestore()

const { v2: cloudinary } = require('cloudinary')
const CLOUD_NAME = 'dl90iaau9'
const UPLOAD_PRESET = 'naiship_upload'

cloudinary.config({ cloud_name: CLOUD_NAME, secure: true })

async function uploadToCloudinary(filePath) {
    const result = await cloudinary.uploader.unsigned_upload(filePath, UPLOAD_PRESET, {
        folder: 'naiship/announcement',
    })
    console.log(`  → 上傳完成：${result.secure_url}`)
    return result.secure_url
}

async function main() {
    // 1. 上傳兩張圖片到 Cloudinary
    console.log('上傳 裝修服務流程n.jpg ...')
    const serviceUrl = await uploadToCloudinary('C:/Users/user/Downloads/裝修服務流程n.jpg')

    console.log('上傳 工程收費圖n.jpg ...')
    const pricingUrl = await uploadToCloudinary('C:/Users/user/Downloads/工程收費圖n.jpg')

    // 2. 找現有的「裝修服務流程」公告
    const col = db.collection('announcements')
    const snap = await col.orderBy('createdAt', 'desc').get()
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    console.log(`\nFirestore 目前共 ${all.length} 則公告:`)
    all.forEach(a => console.log(`  [${a.id}] ${a.title} | images: ${a.images?.length ?? 0}`))

    const existing = all.find(a =>
        a.title?.includes('裝修服務流程') || a.title?.includes('服務流程') || a.title?.includes('裝修流程')
    )

    // 3. 更新或新增「裝修服務流程」公告
    if (existing) {
        console.log(`\n找到現有公告：「${existing.title}」(${existing.id})，更新圖片...`)
        await col.doc(existing.id).update({
            images: [serviceUrl],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log('  → 已更新')
    } else {
        console.log('\n找不到「裝修服務流程」公告，新增一則...')
        await col.add({
            title: '裝修服務流程',
            content: '',
            images: [serviceUrl],
            pinned: true,
            createdBy: '',
            createdByName: '系統',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log('  → 已新增')
    }

    // 4. 新增「收費方式」公告
    console.log('\n新增「設計&工程收費方式」公告...')
    await col.add({
        title: '設計&工程收費方式',
        content: '',
        images: [pricingUrl],
        pinned: false,
        createdBy: '',
        createdByName: '系統',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    console.log('  → 已新增')

    console.log('\n全部完成！')
    process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
