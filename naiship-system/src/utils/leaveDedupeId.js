// 為請假事件產生「固定 doc ID」，讓同一人、同日期區間、同假別、同開始時間的請假
// 在重複送出時覆蓋同一筆 Firestore 文件，而不是新增第二筆。
// 只保留英數、底線與中日韓漢字，其餘（斜線、冒號、空白、破折號…）一律去掉，
// 結果只當 Firestore doc ID 用。
const clean = (s) => String(s ?? '').replace(/[^\w一-鿿]/g, '')

export function leaveDedupeId({ companyId, personName, date, endDate, leaveType, startTime } = {}) {
    const dateKey = clean(date)
    const endKey = (endDate && date && endDate > date) ? clean(endDate) : 'single'
    const typeKey = clean(leaveType) || 'na'
    const startKey = clean(startTime) || 'allday'
    return `leave-${clean(companyId)}-${clean(personName)}-${dateKey}-${endKey}-${typeKey}-${startKey}`
}
