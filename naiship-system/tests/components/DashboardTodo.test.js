import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import DashboardTodo from '@/components/dashboard/DashboardTodo.vue'
import { useCasesStore } from '@/stores/cases'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
    onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'r1' })),
    doc: vi.fn((...args) => args.join('/')),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    serverTimestamp: vi.fn(() => 'ts'),
}))

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/cases', name: 'cases', component: { template: '<div/>' } }] })

describe('DashboardTodo — 逾期未收款', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.setSystemTime(new Date('2026-09-21T04:00:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    it('點擊逾期未收款項目會帶 caseId 跟 caseTab=payment 跳轉', async () => {
        const casesStore = useCasesStore()
        casesStore.cases = [{
            id: 'c1', name: '案件A', companyId: 'tainan',
            paymentMilestones: [{ id: 'pm1', label: '訂金', amount: 10000, dueDate: '2026-09-01', paidAmount: 0, paidDate: '' }],
        }]
        const wrapper = mount(DashboardTodo, { global: { plugins: [router] } })
        await flushPromises()
        const pushSpy = vi.spyOn(router, 'push')
        await wrapper.find('.bg-orange-50').trigger('click')
        expect(pushSpy).toHaveBeenCalledWith({ name: 'cases', query: { region: 'tainan', caseId: 'c1', caseTab: 'payment' } })
    })

    it('已收清但 3 天內才收的期款仍顯示為已完成', async () => {
        const casesStore = useCasesStore()
        casesStore.cases = [{
            id: 'c1', name: '案件A', companyId: 'tainan',
            paymentMilestones: [{ id: 'pm1', label: '訂金', amount: 10000, dueDate: '2026-09-01', paidAmount: 10000, paidDate: '2026-09-20' }],
        }]
        const wrapper = mount(DashboardTodo, { global: { plugins: [router] } })
        await flushPromises()
        expect(wrapper.text()).toContain('已完成')
    })

    it('超過 3 天前收清的期款不再顯示', async () => {
        const casesStore = useCasesStore()
        casesStore.cases = [{
            id: 'c1', name: '案件A', companyId: 'tainan',
            paymentMilestones: [{ id: 'pm1', label: '訂金', amount: 10000, dueDate: '2026-09-01', paidAmount: 10000, paidDate: '2026-09-01' }],
        }]
        const wrapper = mount(DashboardTodo, { global: { plugins: [router] } })
        await flushPromises()
        expect(wrapper.text()).not.toContain('訂金')
    })
})
