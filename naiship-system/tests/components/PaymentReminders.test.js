// naiship-system/tests/components/PaymentReminders.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import PaymentReminders from '@/components/dashboard/PaymentReminders.vue'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  signOut: vi.fn()
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
  updateDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'r1' })),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => undefined })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn((...args) => args.join('/')),
  serverTimestamp: vi.fn(() => 'ts'),
  Timestamp: { fromDate: vi.fn(d => d), now: vi.fn(() => 'ts') },
}))

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/cases', component: { template: '<div/>' } }] })

function makeWt(overrides) {
    return {
        id: 'wt-1',
        name: '水電',
        vendorName: '甲廠商',
        vendorCostItems: [{ amount: 10000 }],
        vendorPayments: [{ amount: 10000, paidDate: '2026-08-01' }],
        invoiceReceived: false,
        ...overrides,
    }
}

describe('PaymentReminders — 待催發票區塊', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    async function mountWithCases(workTypes) {
        const casesStore = useCasesStore()
        const authStore = useAuthStore()
        authStore.role = 'admin'
        casesStore.cases = [{ id: 'c1', name: '大同區辦公室', companyId: 'tainan', workTypes }]
        const wrapper = mount(PaymentReminders, { global: { plugins: [router] } })
        await flushPromises()
        return { wrapper, casesStore }
    }

    it('款項已付清但未收發票的工種顯示在待催發票區塊', async () => {
        const { wrapper } = await mountWithCases([makeWt()])
        expect(wrapper.find('#invoice-pending').exists()).toBe(true)
        expect(wrapper.text()).toContain('待催發票')
        expect(wrapper.text()).toContain('水電')
        expect(wrapper.text()).toContain('已付 $10,000')
    })

    it('已收發票的工種不出現在待催發票區塊', async () => {
        const { wrapper } = await mountWithCases([makeWt({ invoiceReceived: true })])
        expect(wrapper.find('#invoice-pending').exists()).toBe(false)
    })

    it('款項未付清的工種不出現在待催發票區塊', async () => {
        const { wrapper } = await mountWithCases([makeWt({
            vendorCostItems: [{ amount: 20000 }],
            vendorPayments: [{ amount: 10000, paidDate: '2026-08-01' }],
        })])
        expect(wrapper.find('#invoice-pending').exists()).toBe(false)
    })

    it('點擊「發票已收到」呼叫 casesStore.updateCase 把該工種標記為已收發票', async () => {
        const { wrapper, casesStore } = await mountWithCases([makeWt()])
        const updateSpy = vi.spyOn(casesStore, 'updateCase')

        await wrapper.find('#invoice-pending button').trigger('click')
        await flushPromises()

        expect(updateSpy).toHaveBeenCalledWith('c1', {
            workTypes: [expect.objectContaining({ id: 'wt-1', invoiceReceived: true })],
        })
    })

    it('只有待催發票有內容、其他兩塊都空時，整個付款清單區塊仍然顯示', async () => {
        const { wrapper } = await mountWithCases([makeWt()])
        expect(wrapper.find('#payment-reminders').exists()).toBe(true)
    })
})
