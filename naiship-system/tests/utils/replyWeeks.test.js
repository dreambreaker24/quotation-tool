import { describe, it, expect } from 'vitest'
import { getWeekStart } from '@/utils/replyWeeks'

function tsDate(isoDate) {
    return { toDate: () => new Date(`${isoDate}T12:00:00+08:00`) }
}

describe('getWeekStart', () => {
    it('回傳同一週內任一天的週一日期', () => {
        expect(getWeekStart(tsDate('2026-07-13'))).toBe('2026-07-13') // 週一本身
        expect(getWeekStart(tsDate('2026-07-15'))).toBe('2026-07-13') // 週三
        expect(getWeekStart(tsDate('2026-07-19'))).toBe('2026-07-13') // 週日（同週最後一天）
    })

    it('前一週跟下一週要落在不同的週一', () => {
        expect(getWeekStart(tsDate('2026-07-06'))).toBe('2026-07-06')
        expect(getWeekStart(tsDate('2026-07-20'))).toBe('2026-07-20')
    })

    it('跨月份邊界正確換算', () => {
        // 2026-07-27（一）～2026-08-02（日）同一週
        expect(getWeekStart(tsDate('2026-07-27'))).toBe('2026-07-27')
        expect(getWeekStart(tsDate('2026-08-02'))).toBe('2026-07-27')
    })

    it('跨年份邊界正確換算', () => {
        // 2025-12-29（一）～2026-01-04（日）同一週
        expect(getWeekStart(tsDate('2025-12-29'))).toBe('2025-12-29')
        expect(getWeekStart(tsDate('2026-01-04'))).toBe('2025-12-29')
    })

    it('沒有時間戳記回傳 null', () => {
        expect(getWeekStart(null)).toBe(null)
        expect(getWeekStart(undefined)).toBe(null)
    })

    it('也接受純 Date 物件（不是 Firestore Timestamp）', () => {
        expect(getWeekStart(new Date('2026-07-15T12:00:00+08:00'))).toBe('2026-07-13')
    })
})
