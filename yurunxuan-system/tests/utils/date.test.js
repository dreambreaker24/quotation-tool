import { describe, it, expect } from 'vitest'
import { calcExpiryDate } from '@/utils/date'

describe('calcExpiryDate', () => {
  it('一般情況：生產日加 7 天', () => {
    expect(calcExpiryDate('2026-07-21')).toBe('2026-07-28')
  })
  it('跨月：月底生產，到期日跨到下個月', () => {
    expect(calcExpiryDate('2026-07-28')).toBe('2026-08-04')
  })
  it('跨年：年底生產，到期日跨到隔年一月', () => {
    expect(calcExpiryDate('2026-12-31')).toBe('2027-01-07')
  })
  it('閏年 2 月：2024 年是閏年，2 月 29 日存在，到期日正確跨到 3 月', () => {
    expect(calcExpiryDate('2024-02-29')).toBe('2024-03-07')
  })
  it('平年 2 月：2026 年不是閏年，2 月只到 28 日', () => {
    expect(calcExpiryDate('2026-02-25')).toBe('2026-03-04')
  })
})
