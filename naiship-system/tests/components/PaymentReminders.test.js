// naiship-system/tests/components/PaymentReminders.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import PaymentReminders from '@/components/dashboard/PaymentReminders.vue'
import PaymentCompleteModal from '@/components/dashboard/PaymentCompleteModal.vue'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'

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
    afterEach(() => vi.useRealTimers())

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

    it('點擊「發票已收到」呼叫 casesStore.updateCase 把該工種標記為已收發票並補上時間戳記', async () => {
        vi.setSystemTime(new Date('2026-09-21T04:00:00Z'))
        const { wrapper, casesStore } = await mountWithCases([makeWt()])
        const updateSpy = vi.spyOn(casesStore, 'updateCase')

        await wrapper.find('#invoice-pending button').trigger('click')
        await flushPromises()

        expect(updateSpy).toHaveBeenCalledWith('c1', {
            workTypes: [expect.objectContaining({ id: 'wt-1', invoiceReceived: true, invoiceReceivedAt: '2026-09-21' })],
        })
    })

    it('只有待催發票有內容、其他兩塊都空時，整個付款清單區塊仍然顯示', async () => {
        const { wrapper } = await mountWithCases([makeWt()])
        expect(wrapper.find('#payment-reminders').exists()).toBe(true)
    })
})

describe('PaymentReminders — 廠商付款排程完成流程', () => {
    beforeEach(() => setActivePinia(createPinia()))
    afterEach(() => vi.useRealTimers())

    async function mountWithReminderAndCase() {
        const casesStore = useCasesStore()
        const authStore = useAuthStore()
        authStore.role = 'admin'
        casesStore.cases = [{
            id: 'c1', name: '大同區辦公室', companyId: 'tainan',
            workTypes: [{
                id: 'wt-1', name: '水電', vendorName: '甲廠商',
                vendorCostItems: [{ id: 'i1', amount: 10000 }],
                vendorPayments: [],
                invoiceReceived: false,
            }],
        }]
        const remindersStore = usePaymentRemindersStore()
        remindersStore.reminders = [{
            id: 'auto_vendor_item_wt-1_i1', type: 'vendor', source: 'auto', status: 'pending',
            caseId: 'c1', caseName: '大同區辦公室', workTypeId: 'wt-1', workTypeName: '水電',
            itemId: 'i1', amount: 10000, dueDate: '2026-09-01',
        }]
        const wrapper = mount(PaymentReminders, { global: { plugins: [router] } })
        await flushPromises()
        return { wrapper, casesStore, remindersStore }
    }

    it('點完成彈出輸入視窗，確認後寫回案件的 vendorPayments', async () => {
        const { wrapper, casesStore } = await mountWithReminderAndCase()
        await wrapper.find('#scheduled-reminders button').trigger('click')
        await flushPromises()
        expect(wrapper.findComponent(PaymentCompleteModal).exists()).toBe(true)

        const updateSpy = vi.spyOn(casesStore, 'updateCase')
        await wrapper.find('input[type="number"]').setValue(10000)
        await wrapper.find('[data-test="confirm-btn"]').trigger('click')
        await flushPromises()

        expect(updateSpy).toHaveBeenCalled()
        const [caseId, patch] = updateSpy.mock.calls[0]
        expect(caseId).toBe('c1')
        expect(patch.workTypes[0].vendorPayments).toHaveLength(1)
        expect(patch.workTypes[0].vendorPayments[0].amount).toBe(10000)
    })
})

describe('PaymentReminders — 廠商付款依日期顯示', () => {
    beforeEach(() => setActivePinia(createPinia()))
    afterEach(() => vi.useRealTimers())

    async function mountWithReminders(reminders) {
        vi.setSystemTime(new Date('2026-09-24T03:00:00Z'))
        const authStore = useAuthStore()
        authStore.role = 'admin'
        useCasesStore().cases = []
        usePaymentRemindersStore().reminders = reminders
        const wrapper = mount(PaymentReminders, { global: { plugins: [router] } })
        await flushPromises()
        return wrapper
    }

    function vendorReminder(id, dueDate, source = 'auto') {
        return { id, type: 'vendor', source, status: 'pending', caseId: 'c1', caseName: '大同區辦公室', workTypeName: '搗擺', amount: 1000, dueDate }
    }

    it('不再顯示本月底／下月分段標題，直接依付款日期排序', async () => {
        const wrapper = await mountWithReminders([
            vendorReminder('r2', '2026-11-17'),
            vendorReminder('r1', '2026-09-30'),
            vendorReminder('r3', '2026-10-05', 'manual'),
        ])
        const text = wrapper.find('#scheduled-reminders').text()
        expect(text).not.toContain('本月底')
        expect(text).not.toContain('下月')
        const headers = wrapper.findAll('[data-test="due-date-header"]').map(h => h.text())
        expect(headers).toEqual(['9月30日', '10月5日', '11月17日'])
    })

    it('逾期日期排最前面並標示逾期天數，未設日期排最後', async () => {
        const wrapper = await mountWithReminders([
            vendorReminder('r0', ''),
            vendorReminder('r1', '2026-10-01'),
            vendorReminder('r2', '2026-09-20', 'manual'),
        ])
        const headers = wrapper.findAll('[data-test="due-date-header"]').map(h => h.text())
        expect(headers[0]).toContain('9月20日')
        expect(headers[0]).toContain('逾期 4 天')
        expect(headers[1]).toBe('10月1日')
        expect(headers[2]).toBe('未設日期')
    })
})

describe('PaymentReminders — 工種細項顯示', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('工種有細項時顯示「工種・細項」', async () => {
        const authStore = useAuthStore()
        authStore.role = 'admin'
        useCasesStore().cases = [{ id: 'c1', name: '奈拾辦公室', workTypes: [{ id: 'wt-1', name: '系統櫃', subName: '組裝', vendorName: '陳盈志', vendorCostItems: [], vendorPayments: [] }] }]
        usePaymentRemindersStore().reminders = [{ id: 'r1', type: 'vendor', source: 'auto', status: 'pending', caseId: 'c1', caseName: '奈拾辦公室', workTypeId: 'wt-1', workTypeName: '系統櫃', amount: 3000, dueDate: '2099-01-01' }]
        const wrapper = mount(PaymentReminders, { global: { plugins: [router] } })
        await flushPromises()
        expect(wrapper.find('#scheduled-reminders').text()).toContain('系統櫃・組裝')
    })
})
