import { describe, it, expect } from 'vitest'
import { daysUntilExpiry, filterExpiringBatches } from '@/utils/expiringBatches'

describe('daysUntilExpiry', () => {
  it('到期日就是今天，回傳 0', () => {
    expect(daysUntilExpiry('2026-07-22', '2026-07-22')).toBe(0)
  })
  it('到期日是明天，回傳 1', () => {
    expect(daysUntilExpiry('2026-07-23', '2026-07-22')).toBe(1)
  })
  it('到期日是 2 天後，回傳 2', () => {
    expect(daysUntilExpiry('2026-07-24', '2026-07-22')).toBe(2)
  })
  it('已經過期 1 天，回傳 -1', () => {
    expect(daysUntilExpiry('2026-07-21', '2026-07-22')).toBe(-1)
  })
  it('跨月份計算正確', () => {
    expect(daysUntilExpiry('2026-08-01', '2026-07-30')).toBe(2)
  })
  it('跨年份計算正確', () => {
    expect(daysUntilExpiry('2027-01-02', '2026-12-31')).toBe(2)
  })
})

describe('filterExpiringBatches', () => {
  const today = '2026-07-22'

  it('只篩出到期天數 <= 2（含已過期）且 remainingQty > 0 的批次，依到期天數由小到大排序', () => {
    const batches = [
      { id: 'a', drinkName: '潤雪飲', remainingQty: 3, expiryDate: '2026-07-25' },
      { id: 'b', drinkName: '潤澤飲', remainingQty: 5, expiryDate: '2026-07-23' },
      { id: 'c', drinkName: '潤潤飲', remainingQty: 2, expiryDate: '2026-07-21' },
      { id: 'd', drinkName: '潤雪飲', remainingQty: 0, expiryDate: '2026-07-22' }
    ]
    const result = filterExpiringBatches(batches, today)
    expect(result.map(b => b.id)).toEqual(['c', 'b'])
    expect(result[0].daysUntilExpiry).toBe(-1)
    expect(result[1].daysUntilExpiry).toBe(1)
  })

  it('remainingQty 是負數的髒資料也要排除', () => {
    const batches = [{ id: 'x', remainingQty: -2, expiryDate: '2026-07-22' }]
    expect(filterExpiringBatches(batches, today)).toEqual([])
  })

  it('withinDays 參數可以自訂，預設是 2', () => {
    const batches = [{ id: 'y', remainingQty: 1, expiryDate: '2026-07-25' }]
    expect(filterExpiringBatches(batches, today)).toEqual([])
    expect(filterExpiringBatches(batches, today, 3).map(b => b.id)).toEqual(['y'])
  })

  it('空陣列回傳空陣列', () => {
    expect(filterExpiringBatches([], today)).toEqual([])
  })
})
