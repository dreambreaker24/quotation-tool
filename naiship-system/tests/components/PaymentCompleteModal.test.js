import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import PaymentCompleteModal from '@/components/dashboard/PaymentCompleteModal.vue'

describe('PaymentCompleteModal', () => {
    it('金額可編輯模式，預設值帶入 defaultAmount', () => {
        const wrapper = mount(PaymentCompleteModal, {
            props: { title: '記一筆付款', defaultAmount: 5000, fixedAmount: false },
        })
        const input = wrapper.find('input[type="number"]')
        expect((input.element).value).toBe('5000')
    })

    it('固定金額模式不顯示金額輸入框，改顯示純文字', () => {
        const wrapper = mount(PaymentCompleteModal, {
            props: { title: '標記分期完成', defaultAmount: 30000, fixedAmount: true },
        })
        expect(wrapper.find('input[type="number"]').exists()).toBe(false)
        expect(wrapper.text()).toContain('30,000')
    })

    it('點確認送出 amount 跟 paidDate', async () => {
        const wrapper = mount(PaymentCompleteModal, {
            props: { title: '記一筆付款', defaultAmount: 5000, fixedAmount: false },
        })
        await wrapper.find('input[type="number"]').setValue(3000)
        await wrapper.find('input[type="date"]').setValue('2026-09-21')
        await wrapper.find('[data-test="confirm-btn"]').trigger('click')
        expect(wrapper.emitted('confirm')[0][0]).toEqual({ amount: 3000, paidDate: '2026-09-21' })
    })

    it('點取消觸發 close 事件', async () => {
        const wrapper = mount(PaymentCompleteModal, {
            props: { title: '記一筆付款', defaultAmount: 5000, fixedAmount: false },
        })
        await wrapper.find('[data-test="cancel-btn"]').trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
    })
})
