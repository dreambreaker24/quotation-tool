import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

const CLOUD_NAME = 'dl90iaau9'
const UPLOAD_PRESET = 'naiship_upload'
const DESKTOP = 'C:/Users/user/Desktop'

async function uploadToCloudinary(filePath, filename) {
    const fileBuffer = readFileSync(filePath)
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' })
    const form = new FormData()
    form.append('file', blob, filename)
    form.append('upload_preset', UPLOAD_PRESET)
    form.append('folder', 'naiship/announcement')

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: form
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
    console.log(`  ✓ 圖片上傳: ${data.secure_url}`)
    return data.secure_url
}

// 從後往前建立，讓第一筆最後建立（createdAt 最新 → 出現在最上方）
const announcements = [
    {
        title: '工地作業與環境守則',
        content: '所有進場工班請詳閱工地作業規範，包含環境整潔、材料管理、安全守則及場地使用規定，進場前請確認已了解各項規範。',
        imageFile: '7',
        pinned: false,
    },
    {
        title: '柏延有限公司匯款資訊',
        content: '廠商匯款請使用柏延有限公司帳戶，玉山銀行東台南分行，統編 98646497。\n\n銀行：玉山銀行 808-0761\n帳號：0761-940-050817（東台南分行）\n戶名：柏延有限公司',
        imageFile: '3',
        pinned: false,
    },
    {
        title: '廠商請款與付款規則',
        content: '奈拾設計廠商請款與付款規則，每月固定 15 號及 30 號匯款，遇例假日順延至下一個工作日。\n\n・開工：20%（於開工前後依公司匯款日支付）\n・完工後：70%（15 號前完工當月 30 號匯；16 號後完工隔月 15 號匯）\n・發票送達後：10%（完工後一週內寄出發票，隔月 30 號匯）\n\n注意：報價單需為含稅價，工程開始前提供，設計總監驗收後付款。\n\n抬頭：奈拾室內裝修設計有限公司　統編：94201846',
        imageFile: '2',
        pinned: false,
    },
    {
        title: '案場開工拜拜流程',
        content: '案場正式開工前的祭拜流程說明，可於開工前提供業主參考。\n\n【供品】三牲（可素）、三果（香蕉、鳳梨、蘋果）、餅乾或發糕、金紙\n【道具】供桌、香爐、香、米酒杯 x3、盤子、夾子（插香）、米酒、紅錘子\n【方向】朝屋內方向\n\n拜完後用錘子敲牆一下象徵開工，並默念：\n「地基主公地基主婆，我們要開工了，請您保佑我們施工順利。」',
        imageFile: '6',
        pinned: false,
    },
    {
        title: '奈拾設計匯款資訊',
        content: '業主匯款請使用奈拾室內裝修設計有限公司帳戶。\n\n銀行：玉山銀行 808-0761\n帳號：0761-940-050557（東台南分行）\n戶名：奈拾室內裝修設計有限公司\n統編：94201846',
        imageFile: '4',
        pinned: false,
    },
    {
        title: '停車路線指示',
        content: '拜訪奈拾設計辦公室的停車指引，可轉發給預約拜訪的業主。\n\nB1 地下停車場入口位於崇明二十四街，貴賓專屬車格：32、33、34、35、36 號，如有空位皆可停放。\n有感應卡可直接入場。\n\n地址：台南市東區崇明二十四街 62 號',
        imageFile: '5',
        pinned: false,
    },
    {
        title: '裝修服務流程',
        content: '奈拾設計完整裝修服務流程，從初步勘驗到完工拍攝共 9 個階段，可轉發給業主說明合作流程。\n\n01 現場勘驗丈量／初步討論\n02 平面配置提案與簡報\n03 簽訂設計合約\n04 開始圖面繪製\n05 空間材質搭配與選樣\n06 簽訂工程合約\n07 工程排程規劃\n08 完工工程驗收\n09 拍攝完工照',
        imageFile: '1',
        pinned: true,
    },
]

async function main() {
    console.log('開始建立公司布達...\n')
    for (const ann of announcements) {
        console.log(`▶ ${ann.title}`)
        const filePath = `${DESKTOP}/LINE_ALBUM_公司用圖檔_260604_${ann.imageFile}.jpg`
        const imageUrl = await uploadToCloudinary(filePath, `ann_${ann.imageFile}.jpg`)
        await db.collection('announcements').add({
            title: ann.title,
            content: ann.content,
            images: [imageUrl],
            createdBy: 'seed',
            createdByName: '柏',
            pinned: ann.pinned,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        })
        console.log(`  ✓ Firestore 寫入完成\n`)
        await new Promise(r => setTimeout(r, 800))
    }
    console.log('全部完成，共建立 7 則公司布達。')
    process.exit(0)
}

main().catch(e => { console.error('錯誤:', e.message); process.exit(1) })
