// 算「一週」裡跨天事件要畫成哪些長條段：橫跨哪幾欄（0-6，週一到週日）、佔第幾列（0 或 1）。
// 純函式，不認識 Vue/Firestore，只吃 { date, endDate } 這種 'YYYY-MM-DD' 字串比較的最小資料形狀。
// 遇到非上班日會把同一個事件切成不連續的段；同一週最多容納 2 列，
// 欄位互相重疊、兩列都放不下的段直接不出現在回傳結果裡，呼叫端要自己判斷
// 「這個事件在這一天有沒有被排進長條」，沒有的話維持原本逐日顯示，不會拋錯。

function segmentsForEvent(event, weekDays) {
    const segments = []
    let start = -1
    for (let col = 0; col < weekDays.length; col++) {
        const day = weekDays[col]
        const covered = day.date >= event.date && day.date <= event.endDate
        const usable = covered && !day.isNonWorking
        if (usable) {
            if (start === -1) start = col
        } else if (start !== -1) {
            segments.push({ id: event.id, colStart: start, colSpan: col - start })
            start = -1
        }
    }
    if (start !== -1) segments.push({ id: event.id, colStart: start, colSpan: weekDays.length - start })
    return segments
}

/**
 * @param {Array<{date: string, isNonWorking: boolean}>} weekDays 這一週 7 天（週一到週日），date 為 'YYYY-MM-DD'
 * @param {Array<{id: string, date: string, endDate: string}>} events 可能跨這一週的事件，date/endDate 為 'YYYY-MM-DD'
 * @returns {Array<{id: string, colStart: number, colSpan: number, row: number}>} 排進長條的段落
 */
export function buildWeekEventBars(weekDays, events) {
    const allSegments = events.flatMap(event => segmentsForEvent(event, weekDays))
    allSegments.sort((a, b) => a.colStart - b.colStart || String(a.id).localeCompare(String(b.id)))

    const rows = [[], []]
    const placed = []
    for (const seg of allSegments) {
        const colEnd = seg.colStart + seg.colSpan
        const rowIndex = rows.findIndex(row =>
            row.every(other => colEnd <= other.colStart || seg.colStart >= other.colStart + other.colSpan)
        )
        if (rowIndex === -1) continue
        rows[rowIndex].push(seg)
        placed.push({ ...seg, row: rowIndex })
    }
    return placed
}
