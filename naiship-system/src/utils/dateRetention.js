// 判斷一個時間戳記是不是還在「最近 N 天內」——同時要吃 Firestore Timestamp（有 toDate()）
// 跟這個專案裡常見的純日期字串（YYYY-MM-DD，例如 paidDate/dueDate），因為兩種來源都會用到這個判斷。
export function isWithinDays(value, days) {
    if (!value) return false
    let date
    if (typeof value.toDate === 'function') {
        date = value.toDate()
    } else if (typeof value === 'string') {
        date = new Date(value)
    } else if (value instanceof Date) {
        date = value
    } else {
        return false
    }
    if (isNaN(date.getTime())) return false
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return date >= cutoff
}
