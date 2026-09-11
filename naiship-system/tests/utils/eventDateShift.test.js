import { describe, it, expect } from 'vitest'
import { shiftedRange, buildCopyDraft } from '@/utils/eventDateShift'

describe('shiftedRange', () => {
    it('單日事件（無結束日）→ endDate 為 null', () => {
        expect(shiftedRange('2026-09-10', '', '2026-09-15')).toEqual({ date: '2026-09-15', endDate: null })
    })

    it('結束日不晚於開始日 → 當單日處理', () => {
        expect(shiftedRange('2026-09-10', '2026-09-10', '2026-09-15')).toEqual({ date: '2026-09-15', endDate: null })
        expect(shiftedRange('2026-09-10', '2026-09-05', '2026-09-15')).toEqual({ date: '2026-09-15', endDate: null })
    })

    it('區間事件 → 整段平移保持天數', () => {
        expect(shiftedRange('2026-09-10', '2026-09-12', '2026-09-15')).toEqual({ date: '2026-09-15', endDate: '2026-09-17' })
    })

    it('區間跨月平移正確', () => {
        expect(shiftedRange('2026-09-29', '2026-10-01', '2026-10-30')).toEqual({ date: '2026-10-30', endDate: '2026-11-01' })
    })
})

describe('buildCopyDraft', () => {
    const milestone = {
        id: 'm1', type: 'milestone', label: '大同 場勘',
        companyId: 'south', caseIds: ['c1', 'c2'], caseNames: ['大同區辦公室'],
        personNames: ['蚌'], startTime: '09:00', endTime: '12:00',
    }

    it('milestone：照抄欄位、換日期、createdBy 用 uid', () => {
        const d = buildCopyDraft(milestone, '2026-09-10', '', '2026-09-20', { region: 'south', uid: 'u-bo' })
        expect(d).toEqual({
            companyId: 'south', type: 'milestone', label: '大同 場勘', createdBy: 'u-bo',
            date: '2026-09-20',
            caseIds: ['c1', 'c2'], caseNames: ['大同區辦公室'],
            personNames: ['蚌'], startTime: '09:00', endTime: '12:00',
        })
    })

    it('區間 milestone：複製也保持天數', () => {
        const d = buildCopyDraft(milestone, '2026-09-10', '2026-09-12', '2026-09-20', { region: 'south', uid: 'u-bo' })
        expect(d.date).toBe('2026-09-20')
        expect(d.endDate).toBe('2026-09-22')
    })

    it('note 無時間、無案件：不帶 startTime/endTime/caseIds', () => {
        const note = { id: 'n1', type: 'note', label: '年度品質回顧', companyId: 'north', personNames: [] }
        const d = buildCopyDraft(note, '2026-09-10', '', '2026-09-20', { region: 'south', uid: 'u-bo' })
        expect(d).toEqual({ companyId: 'north', type: 'note', label: '年度品質回顧', createdBy: 'u-bo', date: '2026-09-20' })
        expect('startTime' in d).toBe(false)
        expect('endDate' in d).toBe(false)
    })

    it('event.companyId 缺 → 用 region 補', () => {
        const d = buildCopyDraft({ type: 'followup', label: 'x' }, '2026-09-10', '', '2026-09-20', { region: 'central', uid: '' })
        expect(d.companyId).toBe('central')
    })

    it('舊格式事件（單數 caseId / personName）複製時要 fallback 補回陣列', () => {
        const legacy = { type: 'milestone', label: '舊格式場勘', caseId: 'c9', personName: '阿蚌' }
        const d = buildCopyDraft(legacy, '2026-09-10', '', '2026-09-20', { region: 'south', uid: 'u' })
        expect(d.caseIds).toEqual(['c9'])
        expect(d.personNames).toEqual(['阿蚌'])
    })

    it('非 milestone 的舊格式事件：單數 personName 不 fallback（跟 openEditEvent 現有邏輯一致）', () => {
        const legacy = { type: 'followup', label: '舊格式跟進', personName: '阿蚌' }
        const d = buildCopyDraft(legacy, '2026-09-10', '', '2026-09-20', { region: 'south', uid: 'u' })
        expect('personNames' in d).toBe(false)
    })
})
