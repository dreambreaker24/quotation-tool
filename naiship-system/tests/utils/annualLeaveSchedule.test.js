import { describe, it, expect } from 'vitest'
import { getAnnualLeaveCycleInfo } from '@/utils/annualLeaveSchedule'

describe('getAnnualLeaveCycleInfo', () => {
  it('沒有到職日回傳 null', () => {
    expect(getAnnualLeaveCycleInfo('')).toBe(null)
    expect(getAnnualLeaveCycleInfo(null)).toBe(null)
  })

  it('到職未滿 6 個月，目前週期是到職日當天、0 天，下個週期是 6 個月後、3 天', () => {
    const info = getAnnualLeaveCycleInfo('2026-06-01', new Date(2026, 7, 1)) // 2026/08/01，未滿6個月
    expect(info.currentCycleStart).toBe('2026-06-01')
    expect(info.currentCycleDays).toBe(0)
    expect(info.nextCycleStart).toBe('2026-12-01')
    expect(info.nextCycleDays).toBe(3)
  })

  it('剛好滿 6 個月當天算已經進入 3 天週期（起算日當天就算數，不是隔天）', () => {
    const info = getAnnualLeaveCycleInfo('2026-06-01', new Date(2026, 11, 1)) // 2026/12/01
    expect(info.currentCycleStart).toBe('2026-12-01')
    expect(info.currentCycleDays).toBe(3)
    expect(info.nextCycleStart).toBe('2027-06-01')
    expect(info.nextCycleDays).toBe(7)
  })

  it('滿 1 年是 7 天，滿 2 年跳到 10 天', () => {
    const oneYear = getAnnualLeaveCycleInfo('2024-11-01', new Date(2025, 10, 1)) // 2025/11/01
    expect(oneYear.currentCycleDays).toBe(7)
    expect(oneYear.nextCycleStart).toBe('2026-11-01')
    expect(oneYear.nextCycleDays).toBe(10)
  })

  it('其宏/Ramy/柏的實際案例：到職 2024/11/01，今天 2026/08/25 落在「滿1年未滿2年」，目前7天，下次2026/11/01起10天', () => {
    const info = getAnnualLeaveCycleInfo('2024-11-01', new Date(2026, 7, 25))
    expect(info.currentCycleStart).toBe('2025-11-01')
    expect(info.currentCycleDays).toBe(7)
    expect(info.nextCycleStart).toBe('2026-11-01')
    expect(info.nextCycleDays).toBe(10)
  })

  it('賴賴的實際案例：到職 2025/09/01，今天 2026/08/25 還沒到 1 年，目前3天，下次2026/09/01起7天', () => {
    const info = getAnnualLeaveCycleInfo('2025-09-01', new Date(2026, 7, 25))
    expect(info.currentCycleStart).toBe('2026-03-01')
    expect(info.currentCycleDays).toBe(3)
    expect(info.nextCycleStart).toBe('2026-09-01')
    expect(info.nextCycleDays).toBe(7)
  })

  it('滿 3、4 年都是 14 天（各自獨立一個週期，不是共用同一個）', () => {
    const y3 = getAnnualLeaveCycleInfo('2020-01-01', new Date(2023, 0, 1))
    expect(y3.currentCycleDays).toBe(14)
    expect(y3.nextCycleStart).toBe('2024-01-01')
    expect(y3.nextCycleDays).toBe(14)
  })

  it('滿 5~9 年都是 15 天', () => {
    const y5 = getAnnualLeaveCycleInfo('2015-01-01', new Date(2020, 0, 1))
    expect(y5.currentCycleDays).toBe(15)
    const y9 = getAnnualLeaveCycleInfo('2015-01-01', new Date(2024, 0, 1))
    expect(y9.currentCycleDays).toBe(15)
  })

  it('滿 10 年是 16 天，之後每滿一年 +1 天，封頂 30 天', () => {
    const y10 = getAnnualLeaveCycleInfo('2010-01-01', new Date(2020, 0, 1))
    expect(y10.currentCycleDays).toBe(16)
    const y24 = getAnnualLeaveCycleInfo('2000-01-01', new Date(2024, 0, 1))
    expect(y24.currentCycleDays).toBe(30)
    const y30 = getAnnualLeaveCycleInfo('2000-01-01', new Date(2035, 0, 1))
    expect(y30.currentCycleDays).toBe(30) // 封頂，不會超過30
  })
})
