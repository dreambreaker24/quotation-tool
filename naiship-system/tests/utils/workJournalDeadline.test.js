import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { daysSince, canEditGeneralContent, canSelfEditOvertimeFuel, canApproveOvertimeFuel } from '@/utils/workJournalDeadline'

// 2026-07-13 12:00 台北時間
const MOCK_NOW = new Date('2026-07-13T04:00:00Z')

function tsDate(isoDate) {
    return { toDate: () => new Date(`${isoDate}T00:00:00`) }
}

describe('daysSince', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('is 0 for today', () => {
        expect(daysSince(tsDate('2026-07-13'))).toBe(0)
    })
    it('is 2 for two days ago', () => {
        expect(daysSince(tsDate('2026-07-11'))).toBe(2)
    })
    it('is 3 for three days ago', () => {
        expect(daysSince(tsDate('2026-07-10'))).toBe(3)
    })
})

describe('canEditGeneralContent', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('is true only when the log date is today', () => {
        expect(canEditGeneralContent(tsDate('2026-07-13'))).toBe(true)
        expect(canEditGeneralContent(tsDate('2026-07-12'))).toBe(false)
    })
})

describe('canSelfEditOvertimeFuel', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('is true within 3 days, false beyond', () => {
        expect(canSelfEditOvertimeFuel(tsDate('2026-07-13'))).toBe(true)
        expect(canSelfEditOvertimeFuel(tsDate('2026-07-11'))).toBe(true)
        expect(canSelfEditOvertimeFuel(tsDate('2026-07-10'))).toBe(true)
        expect(canSelfEditOvertimeFuel(tsDate('2026-07-09'))).toBe(false)
    })
})

describe('canApproveOvertimeFuel', () => {
    beforeEach(() => vi.setSystemTime(MOCK_NOW))
    afterEach(() => vi.useRealTimers())

    it('within 3 days: any manager can approve', () => {
        expect(canApproveOvertimeFuel(tsDate('2026-07-10'), false, true)).toBe(true)
        expect(canApproveOvertimeFuel(tsDate('2026-07-10'), false, false)).toBe(false)
    })
    it('beyond 3 days: only admin can approve, even if manager', () => {
        expect(canApproveOvertimeFuel(tsDate('2026-07-09'), false, true)).toBe(false)
        expect(canApproveOvertimeFuel(tsDate('2026-07-09'), true, true)).toBe(true)
    })
})
