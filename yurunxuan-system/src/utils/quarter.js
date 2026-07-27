export function getQuarterKeyFromDate(dateStr) {
    const [year, month] = dateStr.split('-').map(Number)
    const q = Math.ceil(month / 3)
    return `${year}-Q${q}`
}

export function getQuarterDateRange(quarterKey) {
    const [yearStr, qStr] = quarterKey.split('-Q')
    const year = Number(yearStr)
    const q = Number(qStr)
    const startMonth = (q - 1) * 3 + 1
    const endMonth = startMonth + 2
    const start = `${year}-${String(startMonth).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
    const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { start, end }
}

export function shiftQuarterKey(quarterKey, offset) {
    const [yearStr, qStr] = quarterKey.split('-Q')
    const year = Number(yearStr)
    const q = Number(qStr)
    const totalQuarters = year * 4 + (q - 1) + offset
    const newYear = Math.floor(totalQuarters / 4)
    const newQ = (totalQuarters % 4) + 1
    return `${newYear}-Q${newQ}`
}

export function listRecentQuarterKeys(count, currentKey) {
    return Array.from({ length: count }, (_, i) => shiftQuarterKey(currentKey, -i))
}
