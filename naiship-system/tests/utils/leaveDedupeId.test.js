import { describe, it, expect } from 'vitest'
import { leaveDedupeId } from '@/utils/leaveDedupeId'

describe('leaveDedupeId', () => {
    const base = {
        companyId: 'south', personName: '蚌',
        date: '2026-09-23', endDate: '2026-09-24',
        leaveType: '事假', startTime: '09:00',
    }

    it('相同輸入回傳相同 ID', () => {
        expect(leaveDedupeId(base)).toBe(leaveDedupeId({ ...base }))
    })

    it('組出預期格式（日期去掉分隔、時間去掉冒號）', () => {
        expect(leaveDedupeId(base)).toBe('leave-south-蚌-20260923-20260924-事假-0900')
    })

    it('endDate 空字串 → single', () => {
        expect(leaveDedupeId({ ...base, endDate: '' })).toBe('leave-south-蚌-20260923-single-事假-0900')
    })

    it('startTime 空 → allday', () => {
        expect(leaveDedupeId({ ...base, startTime: '' })).toBe('leave-south-蚌-20260923-20260924-事假-allday')
    })

    it('leaveType 空 → na', () => {
        expect(leaveDedupeId({ ...base, leaveType: '' })).toBe('leave-south-蚌-20260923-20260924-na-0900')
    })

    it('半天假：同日期同假別但開始時間不同 → 不同 ID', () => {
        const am = leaveDedupeId({ ...base, endDate: '', startTime: '09:00' })
        const pm = leaveDedupeId({ ...base, endDate: '', startTime: '14:00' })
        expect(am).not.toBe(pm)
    })

    it('過濾掉會破壞 doc ID 的字元（斜線、空白）', () => {
        const id = leaveDedupeId({ ...base, personName: 'a/b c' })
        expect(id).toBe('leave-south-abc-20260923-20260924-事假-0900')
        expect(id).not.toContain('/')
    })

    it('endDate 不晚於 date 時視為單日（與 getBusinessDays 一致）', () => {
        expect(leaveDedupeId({ ...base, endDate: '2026-09-23' })).toBe('leave-south-蚌-20260923-single-事假-0900')
        expect(leaveDedupeId({ ...base, endDate: '2026-09-20' })).toBe('leave-south-蚌-20260923-single-事假-0900')
    })

    it('缺欄位不丟錯', () => {
        expect(() => leaveDedupeId({})).not.toThrow()
    })
})
