export function todayStr() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

export function computeBoundaries() {
    const today = todayStr()
    const [y, m] = today.split('-').map(Number)
    const thisMonthEnd = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    const nextMonthMid = `${nextY}-${String(nextM).padStart(2, '0')}-15`
    const nextMonthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-${String(new Date(nextY, nextM, 0).getDate()).padStart(2, '0')}`
    return { today, thisMonthEnd, nextMonthMid, nextMonthEnd }
}

export function getSegment(dueDate) {
    if (!dueDate) return 'undated'
    const { today, thisMonthEnd, nextMonthMid, nextMonthEnd } = computeBoundaries()
    if (dueDate < today) return 'overdue'
    if (dueDate <= thisMonthEnd) return 'this-month'
    if (dueDate <= nextMonthMid) return 'next-first'
    if (dueDate <= nextMonthEnd) return 'next-second'
    return 'beyond'
}

export function overdueDays(dueDate) {
    if (!dueDate) return 0
    const today = new Date(todayStr())
    const due = new Date(dueDate)
    return Math.max(0, Math.floor((today - due) / 86400000))
}

export function groupByCase(items) {
    const map = new Map()
    for (const r of items) {
        const key = r.caseId || 'unknown'
        if (!map.has(key)) map.set(key, { caseId: key, caseName: r.caseName || '未命名案件', items: [] })
        map.get(key).items.push(r)
    }
    return Array.from(map.values()).map(g => ({
        ...g,
        items: g.items.slice().sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    }))
}
