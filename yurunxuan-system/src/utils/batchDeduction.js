export function pickBatchesForDeduction(batches, bottlesNeeded) {
    const validBottlesNeeded = Number(bottlesNeeded)
    if (!Number.isFinite(validBottlesNeeded) || validBottlesNeeded <= 0) {
        throw new Error('扣庫存數量必須是正數')
    }

    const totalAvailable = batches.reduce((sum, b) => sum + (b.remainingQty || 0), 0)
    if (validBottlesNeeded > totalAvailable) {
        throw new Error(`庫存不足，目前還有 ${totalAvailable} 瓶可用`)
    }

    const plan = []
    let remaining = validBottlesNeeded
    for (const batch of batches) {
        if (remaining <= 0) break
        const deductQty = Math.min(batch.remainingQty, remaining)
        plan.push({ batchId: batch.id, deductQty })
        remaining -= deductQty
    }
    return plan
}
