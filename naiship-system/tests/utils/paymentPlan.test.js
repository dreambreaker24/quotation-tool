import { describe, it, expect } from 'vitest'
import { suggestPaymentPlan } from '@/utils/paymentPlan'

describe('suggestPaymentPlan', () => {
    it('總額為 0 時回傳現金模式', () => {
        const plan = suggestPaymentPlan(0)
        expect(plan.mode).toBe('cash')
        expect(plan.cashDate).toBe('')
        expect(plan.autoSuggested).toBe(true)
    })

    it('總額剛好 1 萬時回傳現金模式', () => {
        const plan = suggestPaymentPlan(10000)
        expect(plan.mode).toBe('cash')
    })

    it('總額超過 1 萬、剛好 10 萬時回傳全款模式，一個階段100%', () => {
        const plan = suggestPaymentPlan(100000)
        expect(plan.mode).toBe('plan')
        expect(plan.stages).toHaveLength(1)
        expect(plan.stages[0]).toMatchObject({ name: '完工全款', pct: 100, status: 'pending', dueDate: '' })
        expect(plan.stages[0].id).toMatch(/^stage_/)
    })

    it('總額超過 10 萬時回傳分期模式，四個階段 30/30/30/10', () => {
        const plan = suggestPaymentPlan(350000)
        expect(plan.mode).toBe('plan')
        expect(plan.stages).toHaveLength(4)
        expect(plan.stages.map(s => s.name)).toEqual(['訂金', '中間', '驗收', '完工'])
        expect(plan.stages.map(s => s.pct)).toEqual([30, 30, 30, 10])
        plan.stages.forEach(s => {
            expect(s.status).toBe('pending')
            expect(s.dueDate).toBe('')
            expect(s.id).toMatch(/^stage_/)
        })
    })

    it('每次呼叫都回傳新的階段 id，不會共用同一個物件參照', () => {
        const plan1 = suggestPaymentPlan(350000)
        const plan2 = suggestPaymentPlan(350000)
        expect(plan1.stages[0].id).not.toBe(plan2.stages[0].id)
    })
})
