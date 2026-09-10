import { TAIWAN_HOLIDAY_NAMES } from '@/constants/holidays'

// 回傳 dateStr~endDateStr 之間的「上班日」清單（YYYY-MM-DD 字串陣列），
// 排除週六、週日與 TAIWAN_HOLIDAY_NAMES 裡的國定假日。
// endDateStr 空或不晚於 dateStr 時視為單日。
export function getBusinessDays(dateStr, endDateStr) {
    if (!dateStr) return []
    const start = new Date(dateStr)
    const end = endDateStr && endDateStr > dateStr ? new Date(endDateStr) : new Date(dateStr)
    const days = []
    const cur = new Date(start)
    while (cur <= end) {
        const dow = cur.getDay()
        const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        if (dow !== 0 && dow !== 6 && !TAIWAN_HOLIDAY_NAMES[ds]) days.push(ds)
        cur.setDate(cur.getDate() + 1)
    }
    return days
}
