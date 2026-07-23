export function calcBalance(entries) {
    return entries.reduce((sum, e) => {
        if (e.type === 'topup') return sum + (e.amount || 0)
        if (e.type === 'expense') return sum - (e.amount || 0)
        return sum
    }, 0)
}

export function summarizeMonth(entries, yearMonth) {
    const monthEntries = entries
        .filter(e => e.date?.startsWith(yearMonth))
        .sort((a, b) => a.date.localeCompare(b.date))
    const totalTopup = monthEntries
        .filter(e => e.type === 'topup')
        .reduce((s, e) => s + (e.amount || 0), 0)
    const totalExpense = monthEntries
        .filter(e => e.type === 'expense')
        .reduce((s, e) => s + (e.amount || 0), 0)
    return { entries: monthEntries, totalTopup, totalExpense }
}

const TYPE_LABELS = { topup: '撥入', expense: '支出' }

export function buildPettyCashExportRows(entries, yearMonth) {
    const { entries: monthEntries, totalTopup, totalExpense } = summarizeMonth(entries, yearMonth)
    const rows = monthEntries.map(e => ({
        '日期': e.date,
        '類型': TYPE_LABELS[e.type] || e.type,
        '分類': e.category || '',
        '金額': e.type === 'expense' ? -(e.amount || 0) : (e.amount || 0),
        '用途說明': e.description || '',
        '憑證': e.hasReceipt ? '有' : '無',
    }))
    rows.push({
        '日期': '──',
        '類型': '合計',
        '分類': '',
        '金額': totalTopup - totalExpense,
        '用途說明': `撥入 ${totalTopup}／支出 ${totalExpense}`,
        '憑證': '',
    })
    return rows
}
