function taipeiDateStr(date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

export function getWeekStart(ts) {
    if (!ts) return null
    const d = ts.toDate?.() ?? new Date(ts)
    const [y, m, day] = taipeiDateStr(d).split('-').map(Number)
    const monday = new Date(y, m - 1, day)
    const dow = monday.getDay() // 0=日 ... 6=六
    const diffToMonday = dow === 0 ? -6 : 1 - dow
    monday.setDate(monday.getDate() + diffToMonday)
    const yy = monday.getFullYear()
    const mm = String(monday.getMonth() + 1).padStart(2, '0')
    const dd = String(monday.getDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
}
