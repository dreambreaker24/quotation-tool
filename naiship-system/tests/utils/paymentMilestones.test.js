import { describe, it, expect } from 'vitest'
import { applyMilestonePayment } from '@/utils/paymentMilestones'

describe('applyMilestonePayment', () => {
    function makeMilestones() {
        return [
            { id: 'pm1', label: '訂金（簽約款）', amount: 100000, dueDate: '2026-09-01', paidAmount: 0, paidDate: '' },
            { id: 'pm2', label: '尾款', amount: 50000, dueDate: '2026-10-01', paidAmount: 0, paidDate: '' },
        ]
    }

    it('找不到期款時回傳 null', () => {
        expect(applyMilestonePayment(makeMilestones(), 'no-such-id', { paidAmount: 1000, paidDate: '2026-09-21' })).toBeNull()
    })

    it('付清整筆金額，fullyPaid 回傳 true', () => {
        const result = applyMilestonePayment(makeMilestones(), 'pm1', { paidAmount: 100000, paidDate: '2026-09-21' })
        expect(result.fullyPaid).toBe(true)
        expect(result.milestone).toMatchObject({ id: 'pm1', paidAmount: 100000, paidDate: '2026-09-21' })
        expect(result.milestones.find(m => m.id === 'pm2')).toEqual(makeMilestones()[1])
    })

    it('部分付款，fullyPaid 回傳 false', () => {
        const result = applyMilestonePayment(makeMilestones(), 'pm1', { paidAmount: 30000, paidDate: '2026-09-21' })
        expect(result.fullyPaid).toBe(false)
    })

    it('不影響原始陣列（純函式）', () => {
        const milestones = makeMilestones()
        applyMilestonePayment(milestones, 'pm1', { paidAmount: 100000, paidDate: '2026-09-21' })
        expect(milestones[0].paidAmount).toBe(0)
    })
})
