// 補休／特休明細彈窗要合併顯示的多來源異動紀錄，統一格式 {date, hours, reason, kind}。
// hours 正數代表增加、負數代表減少；kind 用來決定畫面顯示顏色（accrual/adjustment/leave/cashout）。
// 這裡不新增任何 Firestore 寫入，全部讀取既有已經在寫的資料源。

export function mapCashoutEntries(cashouts) {
    return cashouts.map(c => ({
        date: c.createdAt?.toDate?.() ?? null,
        hours: -(c.hours || 0),
        reason: '換現金',
        kind: 'cashout',
    }))
}

export function mapLeaveEntries(events, leaveType, unitConverter = (h) => h) {
    return events
        .filter(e => e.leaveType === leaveType)
        .map(e => ({
            date: e.date?.toDate?.() ?? null,
            hours: -unitConverter(e.hours || 0),
            reason: '請假扣款',
            kind: 'leave',
        }))
}

export function mergeCompHistory(...entryLists) {
    return entryLists.flat().sort((a, b) => {
        if (!a.date && !b.date) return 0
        if (!a.date) return 1
        if (!b.date) return -1
        return b.date - a.date
    })
}

// 把 mergeCompHistory 的攤平輸出依年月重新分組：組間新到舊、組內舊到新。
// 日期是 null 的異動（理論上不會發生，這裡防禦性處理）歸進「日期不明」分組放最後。
export function groupHistoryByMonth(entries) {
    const groups = new Map()
    const noDate = []
    for (const e of entries) {
        if (!e.date) { noDate.push(e); continue }
        const monthKey = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`
        if (!groups.has(monthKey)) groups.set(monthKey, [])
        groups.get(monthKey).push(e)
    }
    const result = [...groups.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([monthKey, monthEntries]) => ({
            monthKey,
            label: `${monthKey.slice(0, 4)}年${Number(monthKey.slice(5, 7))}月`,
            entries: [...monthEntries].sort((a, b) => a.date - b.date),
        }))
    if (noDate.length) {
        result.push({ monthKey: null, label: '日期不明', entries: noDate })
    }
    return result
}
