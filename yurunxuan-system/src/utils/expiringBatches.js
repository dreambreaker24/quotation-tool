export function daysUntilExpiry(expiryDate, todayStr) {
    const [ey, em, ed] = expiryDate.split('-').map(Number)
    const [ty, tm, td] = todayStr.split('-').map(Number)
    const expiry = Date.UTC(ey, em - 1, ed)
    const today = Date.UTC(ty, tm - 1, td)
    return Math.round((expiry - today) / (24 * 60 * 60 * 1000))
}

export function filterExpiringBatches(batches, todayStr, withinDays = 2) {
    return batches
        .filter(b => (b.remainingQty ?? 0) > 0)
        .map(b => ({ ...b, daysUntilExpiry: daysUntilExpiry(b.expiryDate, todayStr) }))
        .filter(b => b.daysUntilExpiry <= withinDays)
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
}
