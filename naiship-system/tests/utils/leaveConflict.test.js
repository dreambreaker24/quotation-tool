import { describe, it, expect } from 'vitest'
import { findOverlappingLeave } from '@/utils/leaveConflict'

describe('findOverlappingLeave', () => {
    it('同一人、日期完全重疊時回傳該筆', () => {
        const events = [
            { id: 'e1', personName: '蚌', date: '2026-08-24', endDate: '2026-08-26', leaveType: '特休', hours: 24 },
        ]
        const result = findOverlappingLeave(events, { personName: '蚌', date: '2026-08-24', endDate: '2026-08-26' })
        expect(result).toEqual(events)
    })

    it('日期區間部分重疊也算衝突（新的落在現有區間中間那天）', () => {
        const events = [
            { id: 'e1', personName: '蚌', date: '2026-08-24', endDate: '2026-08-26', leaveType: '特休', hours: 24 },
        ]
        const result = findOverlappingLeave(events, { personName: '蚌', date: '2026-08-25', endDate: '' })
        expect(result.map(e => e.id)).toEqual(['e1'])
    })

    it('日期沒有重疊時回傳空陣列', () => {
        const events = [
            { id: 'e1', personName: '蚌', date: '2026-08-24', endDate: '2026-08-26', leaveType: '特休', hours: 24 },
        ]
        const result = findOverlappingLeave(events, { personName: '蚌', date: '2026-08-27', endDate: '' })
        expect(result).toEqual([])
    })

    it('不同人即使日期重疊也不算衝突', () => {
        const events = [
            { id: 'e1', personName: '其宏', date: '2026-08-24', endDate: '2026-08-26', leaveType: '特休', hours: 24 },
        ]
        const result = findOverlappingLeave(events, { personName: '蚌', date: '2026-08-24', endDate: '2026-08-26' })
        expect(result).toEqual([])
    })

    it('excludeId 排除自己（編輯既有事件時不跟自己比對）', () => {
        const events = [
            { id: 'e1', personName: '蚌', date: '2026-08-24', endDate: '2026-08-26', leaveType: '特休', hours: 24 },
        ]
        const result = findOverlappingLeave(events, { personName: '蚌', date: '2026-08-24', endDate: '2026-08-26', excludeId: 'e1' })
        expect(result).toEqual([])
    })

    it('同一人同一天重複建立相同假別也算衝突（8/7重複事假那種情境）', () => {
        const events = [
            { id: 'e1', personName: '蚌', date: '2026-08-07', endDate: '', leaveType: '事假', hours: 8 },
        ]
        const result = findOverlappingLeave(events, { personName: '蚌', date: '2026-08-07', endDate: '' })
        expect(result.map(e => e.id)).toEqual(['e1'])
    })

    it('existing 事件沒有 endDate（單日假）時，用 date 當作 endDate 判斷重疊', () => {
        const events = [
            { id: 'e1', personName: '蚌', date: '2026-08-24', endDate: '', leaveType: '事假', hours: 8 },
        ]
        const result = findOverlappingLeave(events, { personName: '蚌', date: '2026-08-24', endDate: '2026-08-26' })
        expect(result.map(e => e.id)).toEqual(['e1'])
    })
})
