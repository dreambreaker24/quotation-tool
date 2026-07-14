function taipeiDateStr(date) {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

export function daysSince(logDate) {
    if (!logDate) return Infinity
    const d = logDate.toDate?.() ?? new Date(logDate)
    const logMs = new Date(`${taipeiDateStr(d)}T00:00:00`).getTime()
    const todayMs = new Date(`${taipeiDateStr(new Date())}T00:00:00`).getTime()
    return Math.round((todayMs - logMs) / 86400000)
}

export function canEditGeneralContent(logDate) {
    return daysSince(logDate) === 0
}

export function canSelfEditOvertimeFuel(logDate) {
    return daysSince(logDate) <= 2
}

export function canApproveOvertimeFuel(logDate, isAdmin, isManager) {
    return daysSince(logDate) <= 2 ? isManager : isAdmin
}
