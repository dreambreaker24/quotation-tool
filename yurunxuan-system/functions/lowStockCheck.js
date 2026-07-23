const LOW_STOCK_COOLDOWN_MS = 60_000

export function shouldSendLowStockPush({ totalRemainingQty, threshold, lastPushAt, now }) {
    if (threshold == null) return false
    if (totalRemainingQty >= threshold) return false
    if (lastPushAt != null && (now - lastPushAt) < LOW_STOCK_COOLDOWN_MS) return false
    return true
}
