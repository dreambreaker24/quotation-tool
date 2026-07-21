import { describe, it, expect } from 'vitest'
import { calcMonthlyProfit } from '@/utils/dashboardSummary'

describe('calcMonthlyProfit', () => {
  it('營收減支出（含攤提）算出毛估損益', () => {
    expect(calcMonthlyProfit(100000, 30000, 5000)).toBe(65000)
  })
  it('支出大於營收時回傳負數（虧損）', () => {
    expect(calcMonthlyProfit(10000, 15000, 5000)).toBe(-10000)
  })
  it('三個數字都是 0 時回傳 0', () => {
    expect(calcMonthlyProfit(0, 0, 0)).toBe(0)
  })
  it('傳入 null/undefined 時當成 0 計算，不報錯', () => {
    expect(calcMonthlyProfit(null, undefined, 5000)).toBe(-5000)
  })
})
