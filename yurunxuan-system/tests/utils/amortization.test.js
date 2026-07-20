import { describe, it, expect } from 'vitest'
import { calcMonthlyAmortization } from '@/utils/amortization'

describe('calcMonthlyAmortization', () => {
  it('60 個月（5年）攤提 30 萬，每月攤提 5000 元', () => {
    expect(calcMonthlyAmortization(300000, 60)).toBe(5000)
  })
  it('36 個月（3年）攤提 108000 元，每月攤提 3000 元', () => {
    expect(calcMonthlyAmortization(108000, 36)).toBe(3000)
  })
  it('攤提年限是 0 或未填時回傳 0（避免除以 0）', () => {
    expect(calcMonthlyAmortization(300000, 0)).toBe(0)
    expect(calcMonthlyAmortization(300000, null)).toBe(0)
  })
  it('金額是 0 或未填時回傳 0', () => {
    expect(calcMonthlyAmortization(0, 60)).toBe(0)
    expect(calcMonthlyAmortization(null, 60)).toBe(0)
  })
  it('除不盡時四捨五入到整數（10萬/7個月）', () => {
    expect(calcMonthlyAmortization(100000, 7)).toBe(14286)
  })
})
