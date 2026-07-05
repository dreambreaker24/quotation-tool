import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSegment, overdueDays, groupByCase, computeBoundaries } from '@/utils/paymentSegments'

// 2026-06-30 08:00 Taipei = 2026-06-30 00:00 UTC+8
// 2026-06-29 16:00 UTC
const MOCK_NOW = new Date('2026-06-29T16:00:00Z')

describe('computeBoundaries', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('today is 2026-06-30', () => {
        expect(computeBoundaries().today).toBe('2026-06-30')
    })

    it('thisMonthEnd is last day of June', () => {
        expect(computeBoundaries().thisMonthEnd).toBe('2026-06-30')
    })

    it('nextMonthMid is July 15', () => {
        expect(computeBoundaries().nextMonthMid).toBe('2026-07-15')
    })

    it('nextMonthEnd is July 31', () => {
        expect(computeBoundaries().nextMonthEnd).toBe('2026-07-31')
    })
})

describe('computeBoundaries — December rollover', () => {
    // 2026-12-31 08:00 Taipei = 2026-12-31 00:00 UTC+8 = 2026-12-30 16:00 UTC
    beforeEach(() => vi.setSystemTime(new Date('2026-12-30T16:00:00Z')))
    afterEach(() => vi.useRealTimers())

    it('nextMonthEnd is Jan 31 of next year', () => {
        const b = computeBoundaries()
        expect(b.nextMonthMid).toBe('2027-01-15')
        expect(b.nextMonthEnd).toBe('2027-01-31')
    })
})

describe('getSegment', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('returns undated for null or empty string', () => {
        expect(getSegment(null)).toBe('undated')
        expect(getSegment('')).toBe('undated')
        expect(getSegment(undefined)).toBe('undated')
    })

    it('returns overdue for past dates', () => {
        expect(getSegment('2026-06-29')).toBe('overdue')
        expect(getSegment('2026-01-01')).toBe('overdue')
    })

    it('returns this-month for today', () => {
        expect(getSegment('2026-06-30')).toBe('this-month')
    })

    it('returns next-first for next month day 1', () => {
        expect(getSegment('2026-07-01')).toBe('next-first')
    })

    it('returns next-first for next month day 15', () => {
        expect(getSegment('2026-07-15')).toBe('next-first')
    })

    it('returns next-second for next month day 16', () => {
        expect(getSegment('2026-07-16')).toBe('next-second')
    })

    it('returns next-second for last day of next month', () => {
        expect(getSegment('2026-07-31')).toBe('next-second')
    })

    it('returns beyond for dates after next month', () => {
        expect(getSegment('2026-08-01')).toBe('beyond')
    })
})

describe('overdueDays', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('returns 0 for null', () => {
        expect(overdueDays(null)).toBe(0)
    })

    it('returns 0 for today', () => {
        expect(overdueDays('2026-06-30')).toBe(0)
    })

    it('returns 2 for 2 days ago', () => {
        expect(overdueDays('2026-06-28')).toBe(2)
    })

    it('returns 10 for 10 days ago', () => {
        expect(overdueDays('2026-06-20')).toBe(10)
    })
})

describe('groupByCase', () => {
    it('groups items by caseId and sorts by dueDate', () => {
        const items = [
            { id: 'r1', caseId: 'c1', caseName: '案件A', dueDate: '2026-07-10' },
            { id: 'r2', caseId: 'c2', caseName: '案件B', dueDate: '2026-07-05' },
            { id: 'r3', caseId: 'c1', caseName: '案件A', dueDate: '2026-07-03' },
        ]
        const groups = groupByCase(items)
        expect(groups).toHaveLength(2)
        const groupA = groups.find(g => g.caseId === 'c1')
        expect(groupA.items).toHaveLength(2)
        expect(groupA.items[0].id).toBe('r3')
        expect(groupA.items[1].id).toBe('r1')
    })

    it('uses unknown as key for items without caseId', () => {
        const items = [{ id: 'r1', dueDate: '2026-07-01' }]
        const groups = groupByCase(items)
        expect(groups[0].caseId).toBe('unknown')
        expect(groups[0].caseName).toBe('未命名案件')
    })

    it('returns empty array for empty input', () => {
        expect(groupByCase([])).toEqual([])
    })

    it('preserves caseName from first item of group', () => {
        const items = [
            { id: 'r1', caseId: 'c1', caseName: '測試案件', dueDate: '2026-07-01' },
        ]
        expect(groupByCase(items)[0].caseName).toBe('測試案件')
    })
})
