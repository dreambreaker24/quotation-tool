import { describe, it, expect } from 'vitest'
import { getQuarterKeyFromDate, getQuarterDateRange, shiftQuarterKey, listRecentQuarterKeys } from '../../src/utils/quarter'

describe('getQuarterKeyFromDate', () => {
  it('1-3 月屬於 Q1', () => {
    expect(getQuarterKeyFromDate('2026-01-15')).toBe('2026-Q1')
    expect(getQuarterKeyFromDate('2026-03-31')).toBe('2026-Q1')
  })
  it('4-6 月屬於 Q2，7-9 月屬於 Q3，10-12 月屬於 Q4', () => {
    expect(getQuarterKeyFromDate('2026-04-01')).toBe('2026-Q2')
    expect(getQuarterKeyFromDate('2026-07-27')).toBe('2026-Q3')
    expect(getQuarterKeyFromDate('2026-12-25')).toBe('2026-Q4')
  })
})

describe('getQuarterDateRange', () => {
  it('Q1 回傳 1/1 到 3/31', () => {
    expect(getQuarterDateRange('2026-Q1')).toEqual({ start: '2026-01-01', end: '2026-03-31' })
  })
  it('Q2 回傳 4/1 到 6/30（處理 30 天月份）', () => {
    expect(getQuarterDateRange('2026-Q2')).toEqual({ start: '2026-04-01', end: '2026-06-30' })
  })
  it('Q4 回傳 10/1 到 12/31', () => {
    expect(getQuarterDateRange('2026-Q4')).toEqual({ start: '2026-10-01', end: '2026-12-31' })
  })
  it('閏年 Q1 的 2 月要算到 29 天不影響（Q1 用 3/31 結尾，不受閏年影響）', () => {
    expect(getQuarterDateRange('2028-Q1')).toEqual({ start: '2028-01-01', end: '2028-03-31' })
  })
})

describe('shiftQuarterKey', () => {
  it('往前推一季，跨年份要正確進位', () => {
    expect(shiftQuarterKey('2026-Q1', -1)).toBe('2025-Q4')
  })
  it('往後推一季，跨年份要正確進位', () => {
    expect(shiftQuarterKey('2026-Q3', 1)).toBe('2026-Q4')
    expect(shiftQuarterKey('2026-Q4', 1)).toBe('2027-Q1')
  })
  it('offset 為 0 回傳原本的季別', () => {
    expect(shiftQuarterKey('2026-Q2', 0)).toBe('2026-Q2')
  })
})

describe('listRecentQuarterKeys', () => {
  it('從指定季別往回列出指定數量，由新到舊', () => {
    expect(listRecentQuarterKeys(4, '2026-Q2')).toEqual(['2026-Q2', '2026-Q1', '2025-Q4', '2025-Q3'])
  })
})
