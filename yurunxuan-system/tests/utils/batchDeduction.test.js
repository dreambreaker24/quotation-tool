import { describe, it, expect } from 'vitest'
import { pickBatchesForDeduction } from '@/utils/batchDeduction'

describe('pickBatchesForDeduction', () => {
  it('單一批次庫存足夠時，直接從這批全扣', () => {
    const batches = [{ id: 'b1', remainingQty: 20 }]
    expect(pickBatchesForDeduction(batches, 5)).toEqual([
      { batchId: 'b1', deductQty: 5 }
    ])
  })
  it('單一批次不夠，跨批次繼續扣（依傳入順序，呼叫端要先依到期日排序）', () => {
    const batches = [{ id: 'b1', remainingQty: 3 }, { id: 'b2', remainingQty: 10 }]
    expect(pickBatchesForDeduction(batches, 5)).toEqual([
      { batchId: 'b1', deductQty: 3 },
      { batchId: 'b2', deductQty: 2 }
    ])
  })
  it('剛好扣完最後一批，不會多扣出第三批', () => {
    const batches = [{ id: 'b1', remainingQty: 3 }, { id: 'b2', remainingQty: 2 }, { id: 'b3', remainingQty: 10 }]
    expect(pickBatchesForDeduction(batches, 5)).toEqual([
      { batchId: 'b1', deductQty: 3 },
      { batchId: 'b2', deductQty: 2 }
    ])
  })
  it('所有批次加總都不夠扣時，拋出錯誤並附上目前可用瓶數', () => {
    const batches = [{ id: 'b1', remainingQty: 3 }, { id: 'b2', remainingQty: 2 }]
    expect(() => pickBatchesForDeduction(batches, 10)).toThrow('庫存不足，目前還有 5 瓶可用')
  })
  it('批次陣列是空的時候也視為庫存不足', () => {
    expect(() => pickBatchesForDeduction([], 1)).toThrow('庫存不足，目前還有 0 瓶可用')
  })
  it('bottlesNeeded 不是正數時拋出錯誤', () => {
    const batches = [{ id: 'b1', remainingQty: 20 }]
    expect(() => pickBatchesForDeduction(batches, 0)).toThrow('扣庫存數量必須是正數')
    expect(() => pickBatchesForDeduction(batches, -3)).toThrow('扣庫存數量必須是正數')
  })
})
