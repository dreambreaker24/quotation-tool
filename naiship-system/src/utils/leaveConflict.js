// 純函式：判斷同一人在指定日期區間內，events 陣列裡有沒有其他請假事件跟這個區間重疊
// events/target 的 date、endDate 都必須是已經正規化的 'YYYY-MM-DD' 字串（呼叫端用 tsToDateStr() 轉換），
// endDate 空字串代表跟 date 同一天，不接受 Firestore Timestamp 或 Date 物件
export function findOverlappingLeave(events, target) {
    const targetStart = target.date
    const targetEnd = target.endDate || target.date
    return events.filter(e => {
        if (target.excludeId && e.id === target.excludeId) return false
        if (e.personName !== target.personName) return false
        const evStart = e.date
        const evEnd = e.endDate || e.date
        return evStart <= targetEnd && evEnd >= targetStart
    })
}
