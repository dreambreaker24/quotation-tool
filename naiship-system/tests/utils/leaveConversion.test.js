import { describe, it, expect } from 'vitest'
import { hoursToDays } from '@/utils/leaveConversion'

describe('hoursToDays', () => {
  it('converts a full 8-hour block to 1 day', () => {
    expect(hoursToDays(8)).toBe(1)
  })
  it('rounds remainder <= 4 hours down to half day', () => {
    expect(hoursToDays(4)).toBe(0.5)
    expect(hoursToDays(12)).toBe(1.5)
  })
  it('rounds remainder > 4 hours up to full day', () => {
    expect(hoursToDays(5)).toBe(1)
    expect(hoursToDays(13)).toBe(1.5)
  })
  it('handles zero', () => {
    expect(hoursToDays(0)).toBe(0)
  })
  it('preserves sign for negative hours', () => {
    expect(hoursToDays(-8)).toBe(-1)
    expect(hoursToDays(-5)).toBe(-1)
  })
})
