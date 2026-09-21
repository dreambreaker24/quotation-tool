import { describe, it, expect, vi, afterEach } from 'vitest'
import { isWithinDays } from '@/utils/dateRetention'

describe('isWithinDays', () => {
    afterEach(() => vi.useRealTimers())

    it('Firestore Timestamp（有 toDate()）在範圍內回傳 true', () => {
        vi.setSystemTime(new Date('2026-09-21T00:00:00Z'))
        const ts = { toDate: () => new Date('2026-09-19T00:00:00Z') }
        expect(isWithinDays(ts, 3)).toBe(true)
    })

    it('Firestore Timestamp 超過範圍回傳 false', () => {
        vi.setSystemTime(new Date('2026-09-21T00:00:00Z'))
        const ts = { toDate: () => new Date('2026-09-10T00:00:00Z') }
        expect(isWithinDays(ts, 3)).toBe(false)
    })

    it('純日期字串（YYYY-MM-DD）在範圍內回傳 true', () => {
        vi.setSystemTime(new Date('2026-09-21T00:00:00Z'))
        expect(isWithinDays('2026-09-20', 3)).toBe(true)
    })

    it('純日期字串超過範圍回傳 false', () => {
        vi.setSystemTime(new Date('2026-09-21T00:00:00Z'))
        expect(isWithinDays('2026-09-01', 3)).toBe(false)
    })

    it('空值回傳 false', () => {
        expect(isWithinDays(null, 3)).toBe(false)
        expect(isWithinDays(undefined, 3)).toBe(false)
        expect(isWithinDays('', 3)).toBe(false)
    })

    it('無法解析的值回傳 false', () => {
        expect(isWithinDays('不是日期', 3)).toBe(false)
    })

    it('在非午夜時刻，邊界日期仍在範圍內（台北日曆日邊界）', () => {
        // 系統時間: 2026-09-21 14:00 台北時間 (2026-09-21T06:00:00Z)
        vi.setSystemTime(new Date('2026-09-21T06:00:00Z'))
        // 3 天前的日期: 2026-09-18（台北日曆日比較應該是 3 天前）
        expect(isWithinDays('2026-09-18', 3)).toBe(true)
    })
})
