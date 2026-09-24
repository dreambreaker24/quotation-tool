import { describe, it, expect } from 'vitest'
import { buildWeekEventBars, chainConsecutiveDailyEvents } from '@/utils/calendarEventBars'

// 一般的一週：週一到週日，週六日不上班，其餘都是上班日
const NORMAL_WEEK = [
    { date: '2026-10-05', isNonWorking: false }, // 一
    { date: '2026-10-06', isNonWorking: false }, // 二
    { date: '2026-10-07', isNonWorking: false }, // 三
    { date: '2026-10-08', isNonWorking: false }, // 四
    { date: '2026-10-09', isNonWorking: false }, // 五
    { date: '2026-10-10', isNonWorking: true },  // 六
    { date: '2026-10-11', isNonWorking: true },  // 日
]

// 週三是國定假日的一週
const HOLIDAY_MID_WEEK = [
    { date: '2026-10-05', isNonWorking: false },
    { date: '2026-10-06', isNonWorking: false },
    { date: '2026-10-07', isNonWorking: true },  // 週三國定假日
    { date: '2026-10-08', isNonWorking: false },
    { date: '2026-10-09', isNonWorking: false },
    { date: '2026-10-10', isNonWorking: true },
    { date: '2026-10-11', isNonWorking: true },
]

describe('buildWeekEventBars', () => {
    it('請假（skipNonWorking）橫跨整週，週六日自動斷開，只剩週一到週五一段', () => {
        const events = [{ id: 'e1', date: '2026-10-05', endDate: '2026-10-11', skipNonWorking: true }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([{ id: 'e1', colStart: 0, colSpan: 5, row: 0 }])
    })

    it('非請假事件橫跨整週，直接穿過週六日連成一條', () => {
        const events = [{ id: 'e1', date: '2026-10-05', endDate: '2026-10-11' }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([{ id: 'e1', colStart: 0, colSpan: 7, row: 0 }])
    })

    it('事件在週中間開始、週中間結束', () => {
        const events = [{ id: 'e1', date: '2026-10-07', endDate: '2026-10-09' }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([{ id: 'e1', colStart: 2, colSpan: 3, row: 0 }])
    })

    it('請假被週三的國定假日截斷成兩段', () => {
        const events = [{ id: 'e1', date: '2026-10-05', endDate: '2026-10-09', skipNonWorking: true }]
        const bars = buildWeekEventBars(HOLIDAY_MID_WEEK, events)
        expect(bars).toEqual([
            { id: 'e1', colStart: 0, colSpan: 2, row: 0 }, // 週一、週二
            { id: 'e1', colStart: 3, colSpan: 2, row: 0 }, // 週四、週五
        ])
    })

    it('事件跨到下一週：這一週只算屬於這一週的部分', () => {
        const events = [{ id: 'e1', date: '2026-10-08', endDate: '2026-10-14' }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([{ id: 'e1', colStart: 3, colSpan: 4, row: 0 }]) // 到這週日
    })

    it('同一週兩條跨天事件欄位重疊，分別排到第 0 列、第 1 列', () => {
        const events = [
            { id: 'e1', date: '2026-10-05', endDate: '2026-10-07' },
            { id: 'e2', date: '2026-10-06', endDate: '2026-10-09' },
        ]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([
            { id: 'e1', colStart: 0, colSpan: 3, row: 0 },
            { id: 'e2', colStart: 1, colSpan: 4, row: 1 },
        ])
    })

    it('同一週欄位不重疊的兩條事件可以共用第 0 列（不用各佔一列）', () => {
        const events = [
            { id: 'e1', date: '2026-10-05', endDate: '2026-10-06' },
            { id: 'e2', date: '2026-10-08', endDate: '2026-10-09' },
        ]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([
            { id: 'e1', colStart: 0, colSpan: 2, row: 0 },
            { id: 'e2', colStart: 3, colSpan: 2, row: 0 },
        ])
    })

    it('同一週三條事件欄位互相重疊，開第三列，全部都排得進去', () => {
        const events = [
            { id: 'e1', date: '2026-10-05', endDate: '2026-10-09' },
            { id: 'e2', date: '2026-10-05', endDate: '2026-10-09' },
            { id: 'e3', date: '2026-10-05', endDate: '2026-10-09' },
        ]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars.map(b => b.row).sort()).toEqual([0, 1, 2])
    })

    it('事件完全不重疊這一週，回傳空陣列', () => {
        const events = [{ id: 'e1', date: '2026-09-01', endDate: '2026-09-05' }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([])
    })
})

describe('chainConsecutiveDailyEvents', () => {
    const keyOf = e => e.key

    it('連續三天同 key 接成一條，記住每一筆的 id', () => {
        const events = [
            { id: 'a', date: '2026-09-02', key: 'x' },
            { id: 'b', date: '2026-09-03', key: 'x' },
            { id: 'c', date: '2026-09-04', key: 'x' },
        ]
        expect(chainConsecutiveDailyEvents(events, keyOf)).toEqual([
            { memberIds: ['a', 'b', 'c'], date: '2026-09-02', endDate: '2026-09-04', first: events[0] },
        ])
    })

    it('中間缺一天就斷成兩條，只剩一天的不算', () => {
        const events = [
            { id: 'a', date: '2026-09-23', key: 'x' },
            { id: 'b', date: '2026-09-24', key: 'x' },
            { id: 'c', date: '2026-09-26', key: 'x' },
        ]
        const chains = chainConsecutiveDailyEvents(events, keyOf)
        expect(chains).toHaveLength(1)
        expect(chains[0].memberIds).toEqual(['a', 'b'])
    })

    it('跨月份也接得起來', () => {
        const events = [
            { id: 'a', date: '2026-09-30', key: 'x' },
            { id: 'b', date: '2026-10-01', key: 'x' },
        ]
        expect(chainConsecutiveDailyEvents(events, keyOf)[0].endDate).toBe('2026-10-01')
    })

    it('key 不同不接、keyOf 回傳 null 的不參與', () => {
        const events = [
            { id: 'a', date: '2026-09-02', key: 'x' },
            { id: 'b', date: '2026-09-03', key: 'y' },
            { id: 'c', date: '2026-09-04', key: null },
            { id: 'd', date: '2026-09-05', key: null },
        ]
        expect(chainConsecutiveDailyEvents(events, keyOf)).toEqual([])
    })
})
