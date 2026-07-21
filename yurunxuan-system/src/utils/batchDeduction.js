/**
 * 依先進先出（FIFO）從批次清單扣除指定瓶數。
 * 呼叫端必須先把 batches 依到期日由早到晚排序好，這支函式不會自己排序，只依傳入順序扣。
 */
export function pickBatchesForDeduction(batches, bottlesNeeded) {
    const validBottlesNeeded = Number(bottlesNeeded)
    if (!Number.isFinite(validBottlesNeeded) || validBottlesNeeded <= 0) {
        throw new Error('扣庫存數量必須是正數')
    }

    const safeBatches = batches.map(b => ({ id: b.id, remainingQty: Math.max(0, Number(b.remainingQty) || 0) }))

    const totalAvailable = safeBatches.reduce((sum, b) => sum + b.remainingQty, 0)
    if (validBottlesNeeded > totalAvailable) {
        throw new Error(`庫存不足，目前還有 ${totalAvailable} 瓶可用`)
    }

    const plan = []
    let remaining = validBottlesNeeded
    for (const batch of safeBatches) {
        if (remaining <= 0) break
        const deductQty = Math.min(batch.remainingQty, remaining)
        plan.push({ batchId: batch.id, deductQty })
        remaining -= deductQty
    }
    return plan
}
