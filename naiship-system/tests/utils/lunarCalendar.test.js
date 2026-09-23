import { describe, it, expect } from 'vitest'
import { getLunarLabel } from '@/utils/lunarCalendar'

describe('getLunarLabel', () => {
    it('一般農曆日期（2026-10-11 農曆九月初二）', () => {
        expect(getLunarLabel(new Date(2026, 9, 11))).toBe('初二')
    })

    it('農曆月初一顯示月份名而非「初一」（2026-10-10 農曆九月初一）', () => {
        expect(getLunarLabel(new Date(2026, 9, 10))).toBe('九月')
    })

    it('節氣當天顯示節氣名稱，取代農曆日期（2026-10-08 寒露）', () => {
        expect(getLunarLabel(new Date(2026, 9, 8))).toBe('寒露')
    })

    it('節氣當天顯示節氣名稱，取代農曆日期（2026-10-23 霜降）', () => {
        expect(getLunarLabel(new Date(2026, 9, 23))).toBe('霜降')
    })

    it('農曆新年邊界 — 除夕當天（2026-02-16 農曆十二月廿九）', () => {
        expect(getLunarLabel(new Date(2026, 1, 16))).toBe('廿九')
    })

    it('農曆新年邊界 — 初一當天（2026-02-17 農曆正月初一）', () => {
        expect(getLunarLabel(new Date(2026, 1, 17))).toBe('正月')
    })

    it('跨西曆月份仍正確換算（2026-11-01 農曆九月廿三）', () => {
        expect(getLunarLabel(new Date(2026, 10, 1))).toBe('廿三')
    })

    it('中秋節當天（2026-09-25 農曆八月十五）', () => {
        expect(getLunarLabel(new Date(2026, 8, 25))).toBe('十五')
    })

    it('閏月年份，閏月初一顯示「閏」加月份名（2025-07-25 農曆閏六月初一）', () => {
        expect(getLunarLabel(new Date(2025, 6, 25))).toBe('閏六月')
    })

    it('閏月年份，閏月第二天正常顯示日期（2025-07-26 農曆閏六月初二）', () => {
        expect(getLunarLabel(new Date(2025, 6, 26))).toBe('初二')
    })

    it('超出 1900-2100 範圍回傳空字串，不拋錯', () => {
        expect(getLunarLabel(new Date(1899, 0, 1))).toBe('')
        expect(getLunarLabel(new Date(2101, 0, 1))).toBe('')
    })
})
