// 判斷一個時間戳記是不是還在「最近 N 天內」——同時要吃 Firestore Timestamp（有 toDate()）
// 跟這個專案裡常見的純日期字串（YYYY-MM-DD，例如 paidDate/dueDate），因為兩種來源都會用到這個判斷。
// 使用台北日曆日比較避免時區時段邊界問題。

function taipeiDateStr(date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

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

    // 轉換成台北日曆日字串並計算日期差（避免依時段閃爍）
    const dateStr = taipeiDateStr(date)
    const todayStr = taipeiDateStr(new Date())

    const dateMs = new Date(`${dateStr}T00:00:00`).getTime()
    const todayMs = new Date(`${todayStr}T00:00:00`).getTime()

    const dayDiff = Math.round((todayMs - dateMs) / 86400000)

    return dayDiff >= 0 && dayDiff <= days
}
