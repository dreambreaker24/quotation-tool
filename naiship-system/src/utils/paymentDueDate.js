// 廠商工程款付款日計算，跟金額門檻判斷。WorkTypePanel.vue／DashboardView.vue 兩處都要用，
// 抽成共用檔案避免像 D3 那次一樣兩處各自維護不同步。
import { TAIWAN_HOLIDAYS } from '@/constants/holidays'

function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isNonWorkday(d) {
    if (d.getDay() === 0 || d.getDay() === 6) return true
    return TAIWAN_HOLIDAYS.has(toDateStr(d))
}

// 完工當月 15 號或月底，看哪個還沒過用哪個（完工日之後最快能付的那個日期）；
// 遇週休或國定假日往前提到最近的平日
export function calcVendorDueDate(endDate) {
    const d = new Date(endDate + 'T00:00:00')
    const day = d.getDate()
    const year = d.getFullYear()
    const month = d.getMonth()
    const targetDay = day <= 15 ? 15 : new Date(year, month + 1, 0).getDate()
    const result = new Date(year, month, targetDay)
    while (isNonWorkday(result)) result.setDate(result.getDate() - 1)
    return toDateStr(result)
}

export const VENDOR_CASH_THRESHOLD = 10000
export const VENDOR_MANUAL_FOLLOWUP_THRESHOLD = 100000

// 金額 1 萬以下：完工當天直接付現，不建立匯款提醒
// 金額 10 萬以下（但 > 1 萬）：照常建立提醒，但額外標記「手動提醒」
export function vendorReminderPlan(amount) {
    if (amount <= VENDOR_CASH_THRESHOLD) return { shouldRemind: false, needsManualFollowup: false }
    return { shouldRemind: true, needsManualFollowup: amount <= VENDOR_MANUAL_FOLLOWUP_THRESHOLD }
}
