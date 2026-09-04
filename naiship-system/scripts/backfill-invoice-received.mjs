// 一次性 backfill：舊資料是逐筆付款各自標記「有發票」（vendorPayments[].hasInvoice），
// 邏輯改成整個工種一次開發票之後，只要有任何一筆舊付款曾經標過有發票，
// 就把新欄位 wt.invoiceReceived 設成 true，避免舊紀錄消失變成「未收發票」。
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

const snap = await db.collection('cases').get()
let caseCount = 0
let workTypeCount = 0

for (const doc of snap.docs) {
    const data = doc.data()
    const workTypes = data.workTypes || []
    let changed = false
    const updated = workTypes.map(wt => {
        const alreadyHadInvoice = (wt.vendorPayments || []).some(vp => vp.hasInvoice === true)
        if (alreadyHadInvoice && !wt.invoiceReceived) {
            changed = true
            workTypeCount++
            console.log(`  ${data.name}／${wt.name}：舊資料有標過發票 -> invoiceReceived = true`)
            return { ...wt, invoiceReceived: true }
        }
        return wt
    })
    if (changed) {
        await doc.ref.update({ workTypes: updated })
        caseCount++
    }
}

console.log(`完成：更新了 ${caseCount} 個案件、共 ${workTypeCount} 個工種的 invoiceReceived 欄位`)
process.exit(0)
