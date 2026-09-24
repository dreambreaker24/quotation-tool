// 算「一週」裡跨天事件要畫成哪些長條段：橫跨哪幾欄（0-6，週一到週日）、佔第幾列，以及長條跟單格一起補位排列。
// 純函式，不認識 Vue/Firestore，只吃 { date, endDate, skipNonWorking } 這種 'YYYY-MM-DD' 字串比較的最小資料形狀。
// skipNonWorking 為 true 的事件（請假）遇到非上班日會切成不連續的段，其餘事件直接穿過週末/假日。
// 列數不設上限，同一週每段都一定排得進去。

function segmentsForEvent(event, weekDays) {
    const segments = []
    let start = -1
    for (let col = 0; col < weekDays.length; col++) {
        const day = weekDays[col]
        const covered = day.date >= event.date && day.date <= event.endDate
        const usable = covered && !(event.skipNonWorking && day.isNonWorking)
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
 * 算出每個事件在這一週要畫的段落（還沒排列），請假遇到非上班日會切成多段
 * @param {Array<{date: string, isNonWorking: boolean}>} weekDays 這一週 7 天（週一到週日），date 為 'YYYY-MM-DD'
 * @param {Array<{id: string, date: string, endDate: string, skipNonWorking?: boolean}>} events 可能跨這一週的事件
 * @returns {Array<{id: string, colStart: number, colSpan: number}>}
 */
export function buildWeekSegments(weekDays, events) {
    return events.flatMap(event => segmentsForEvent(event, weekDays))
}

/**
 * 依傳入順序，把每一項放進它所佔欄位「最上面都還空著」的那一列（Google 日曆的補位排法）。
 * 長條、單格都用同一套列，所以全部落在固定列距上，又不會留下多餘空位。
 * @param {Array<{colStart: number, colSpan: number}>} items 已排好優先順序的項目
 * @returns {Array<object>} 每一項加上 row
 */
export function packWeekItems(items) {
    const occupied = []
    return items.map(item => {
        const cols = Array.from({ length: item.colSpan }, (_, i) => item.colStart + i)
        let row = 0
        while (cols.some(c => occupied[row]?.[c])) row++
        occupied[row] ??= []
        cols.forEach(c => { occupied[row][c] = true })
        return { ...item, row }
    })
}

/**
 * @param {Array<{date: string, isNonWorking: boolean}>} weekDays 這一週 7 天（週一到週日），date 為 'YYYY-MM-DD'
 * @param {Array<{id: string, date: string, endDate: string, skipNonWorking?: boolean}>} events 可能跨這一週的事件
 * @returns {Array<{id: string, colStart: number, colSpan: number, row: number}>} 排進長條的段落
 */
export function buildWeekEventBars(weekDays, events) {
    const segments = buildWeekSegments(weekDays, events)
    segments.sort((a, b) =>
        a.colStart - b.colStart || b.colSpan - a.colSpan || String(a.id).localeCompare(String(b.id))
    )
    return packWeekItems(segments)
}

/**
 * 把「連續幾天、每天各一筆、內容一模一樣」的單日事件接成一條虛擬跨天事件。
 * 只接 key 相同、日期剛好連續（中間不缺天）的；只有一天的不算。
 * @param {Array<{id: string, date: string}>} events 單日事件，date 為 'YYYY-MM-DD'
 * @param {(event: object) => string|null} keyOf 回傳同組判斷用的 key，回傳 null 代表這筆不參與串接
 * @returns {Array<{memberIds: string[], date: string, endDate: string, first: object}>}
 */
export function chainConsecutiveDailyEvents(events, keyOf) {
    const byKey = new Map()
    for (const e of events) {
        const key = keyOf(e)
        if (key === null) continue
        if (!byKey.has(key)) byKey.set(key, new Map())
        const byDate = byKey.get(key)
        if (!byDate.has(e.date)) byDate.set(e.date, e)
    }

    const chains = []
    for (const byDate of byKey.values()) {
        const dates = [...byDate.keys()].sort()
        let run = []
        const flush = () => {
            if (run.length >= 2) {
                chains.push({
                    memberIds: run.map(d => byDate.get(d).id),
                    date: run[0],
                    endDate: run[run.length - 1],
                    first: byDate.get(run[0]),
                })
            }
        }
        for (const date of dates) {
            if (run.length && nextDateStr(run[run.length - 1]) !== date) {
                flush()
                run = []
            }
            run.push(date)
        }
        flush()
    }
    return chains
}

function nextDateStr(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}
