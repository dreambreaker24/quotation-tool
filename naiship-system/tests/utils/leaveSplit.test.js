import { describe, it, expect } from 'vitest'
import { splitLeaveRange, roundDownToHalfHour } from '@/utils/leaveSplit'

// 2026-09-23(三)、09-24(四) 都是上班日；09-25(五) 中秋節；09-26/27 週末；09-28(一) 教師節補假？以 businessDays 為準
describe('splitLeaveRange', () => {
    it('柏的例子：9/23~9/24 整天 16h，補休 15.5h → 事假從 9/24 17:30 開始', () => {
        const r = splitLeaveRange({ date: '2026-09-23', endDate: '2026-09-24', startTime: '', endTime: '', compHours: 15.5 })
        expect(r.comp).toEqual({ date: '2026-09-23', endDate: '2026-09-24', startTime: '09:00', endTime: '17:30' })
        expect(r.personal).toEqual({ date: '2026-09-24', endDate: '', startTime: '17:30', endTime: '18:00' })
    })

    it('切點剛好在上午下班（12:00）→ 事假從 13:00 開始，不從午休開始', () => {
        const r = splitLeaveRange({ date: '2026-09-23', endDate: '', startTime: '09:00', endTime: '18:00', compHours: 3 })
        expect(r.comp).toEqual({ date: '2026-09-23', endDate: '', startTime: '09:00', endTime: '12:00' })
        expect(r.personal).toEqual({ date: '2026-09-23', endDate: '', startTime: '13:00', endTime: '18:00' })
    })

    it('切點剛好在一天結束 → 事假從下一個上班日 09:00 開始', () => {
        const r = splitLeaveRange({ date: '2026-09-23', endDate: '2026-09-24', startTime: '09:00', endTime: '18:00', compHours: 8 })
        expect(r.comp).toEqual({ date: '2026-09-23', endDate: '', startTime: '09:00', endTime: '18:00' })
        expect(r.personal).toEqual({ date: '2026-09-24', endDate: '', startTime: '09:00', endTime: '18:00' })
    })

    it('切點落在下午 → 跨午休也算對', () => {
        const r = splitLeaveRange({ date: '2026-09-23', endDate: '', startTime: '10:00', endTime: '18:00', compHours: 4.5 })
        expect(r.comp).toEqual({ date: '2026-09-23', endDate: '', startTime: '10:00', endTime: '15:30' })
        expect(r.personal).toEqual({ date: '2026-09-23', endDate: '', startTime: '15:30', endTime: '18:00' })
    })

    it('跨假日：9/24 下班後跳過中秋與週末，事假從下一個上班日開始', () => {
        const r = splitLeaveRange({ date: '2026-09-24', endDate: '2026-09-29', startTime: '', endTime: '', compHours: 8 })
        expect(r.comp).toEqual({ date: '2026-09-24', endDate: '', startTime: '09:00', endTime: '18:00' })
        expect(r.personal.date > '2026-09-27').toBe(true)
        expect(r.personal.startTime).toBe('09:00')
        expect(r.personal.endDate || r.personal.date).toBe('2026-09-29')
    })

    it('補休 0 或超過申請時數 → 不拆（回傳 null）', () => {
        expect(splitLeaveRange({ date: '2026-09-23', endDate: '', startTime: '09:00', endTime: '18:00', compHours: 0 })).toBeNull()
        expect(splitLeaveRange({ date: '2026-09-23', endDate: '', startTime: '09:00', endTime: '18:00', compHours: 8 })).toBeNull()
    })
})

describe('roundDownToHalfHour', () => {
    it('往下取整到 0.5', () => {
        expect(roundDownToHalfHour(15.5)).toBe(15.5)
        expect(roundDownToHalfHour(15.25)).toBe(15)
        expect(roundDownToHalfHour(0.4)).toBe(0)
        expect(roundDownToHalfHour(3.99)).toBe(3.5)
    })
})
