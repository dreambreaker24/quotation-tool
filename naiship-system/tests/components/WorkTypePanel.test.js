// naiship-system/tests/components/WorkTypePanel.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import WorkTypePanel from '@/components/cases/WorkTypePanel.vue'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(), signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(), signOut: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
  updateDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'r1' })),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => undefined })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  setDoc: vi.fn(), deleteDoc: vi.fn(),
  doc: vi.fn((...args) => args.join('/')),
  serverTimestamp: vi.fn(() => 'ts'),
  Timestamp: { fromDate: vi.fn(d => d), now: vi.fn(() => 'ts') },
}))

const caseId = 'case1'
function makeWt(overrides) {
    return {
        id: 'wt1', name: '清運拆除', vendorName: '來右裝潢設計材料行',
        vendorCostItems: [
            { id: 'i1', description: '垃圾搬運至1樓', amount: 6500 },
            { id: 'i2', description: '垃圾車清運', amount: 31710 },
        ],
        vendorPayments: [],
        ...overrides,
    }
}

describe('WorkTypePanel — 廠商付款項目分攤', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    async function mountWithWorkType(wt) {
        const casesStore = useCasesStore()
        const authStore = useAuthStore()
        authStore.role = 'admin'
        authStore.name = '柏'
        casesStore.cases = [{ id: caseId, name: '大同區辦公室', companyId: 'north', workTypes: [wt] }]
        const wrapper = mount(WorkTypePanel, { props: { caseId, caseName: '大同區辦公室' } })
        await flushPromises()
        return { wrapper, casesStore }
    }

    it('記錄付款並勾選兩個項目、金額剛好等於加總時，兩個項目的提醒都被標記完成', async () => {
        const wt = makeWt()
        const { wrapper } = await mountWithWorkType(wt)
        const remindersStore = usePaymentRemindersStore()
        const markDoneSpy = vi.spyOn(remindersStore, 'markDone').mockResolvedValue()

        wrapper.vm.openVendorPay(0)
        await wrapper.vm.$nextTick()
        wrapper.vm.selectedPaymentItemIds = ['i1', 'i2']
        wrapper.vm.vendorPayForm.amount = 38210
        wrapper.vm.vendorPayForm.paidDate = '2026-09-08'
        await wrapper.vm.addVendorPayment()
        await flushPromises()

        expect(markDoneSpy).toHaveBeenCalledWith('auto_vendor_item_wt1_i1')
        expect(markDoneSpy).toHaveBeenCalledWith('auto_vendor_item_wt1_i2')
    })

    it('只勾選一個項目、只付部分金額時，那個項目的提醒不會被標記完成', async () => {
        const wt = makeWt()
        const { wrapper } = await mountWithWorkType(wt)
        const remindersStore = usePaymentRemindersStore()
        const markDoneSpy = vi.spyOn(remindersStore, 'markDone').mockResolvedValue()

        wrapper.vm.openVendorPay(0)
        await wrapper.vm.$nextTick()
        wrapper.vm.selectedPaymentItemIds = ['i1']
        wrapper.vm.vendorPayForm.amount = 3000
        wrapper.vm.vendorPayForm.paidDate = '2026-09-09'
        await wrapper.vm.addVendorPayment()
        await flushPromises()

        expect(markDoneSpy).not.toHaveBeenCalledWith('auto_vendor_item_wt1_i1')
    })

    it('不勾選任何項目直接記錄付款，itemAllocations是空陣列，不呼叫任何項目提醒的markDone', async () => {
        const wt = makeWt()
        const { wrapper, casesStore } = await mountWithWorkType(wt)
        const remindersStore = usePaymentRemindersStore()
        const markDoneSpy = vi.spyOn(remindersStore, 'markDone').mockResolvedValue()
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase')

        wrapper.vm.openVendorPay(0)
        await wrapper.vm.$nextTick()
        wrapper.vm.vendorPayForm.amount = 5000
        wrapper.vm.vendorPayForm.paidDate = '2026-09-09'
        await wrapper.vm.addVendorPayment()
        await flushPromises()

        const savedWt = updateCaseSpy.mock.calls[0][1].workTypes[0]
        expect(savedWt.vendorPayments[0].itemAllocations).toEqual([])
        expect(markDoneSpy).not.toHaveBeenCalledWith(expect.stringContaining('auto_vendor_item_'))
    })

    it('整個工種所有項目都付清時，也會呼叫舊制的markDone(auto_vendor_${wt.id})，維持既有行為不變', async () => {
        const wt = makeWt()
        const { wrapper } = await mountWithWorkType(wt)
        const remindersStore = usePaymentRemindersStore()
        const markDoneSpy = vi.spyOn(remindersStore, 'markDone').mockResolvedValue()

        wrapper.vm.openVendorPay(0)
        await wrapper.vm.$nextTick()
        wrapper.vm.selectedPaymentItemIds = ['i1', 'i2']
        wrapper.vm.vendorPayForm.amount = 38210
        wrapper.vm.vendorPayForm.paidDate = '2026-09-08'
        await wrapper.vm.addVendorPayment()
        await flushPromises()

        expect(markDoneSpy).toHaveBeenCalledWith('auto_vendor_wt1')
    })
})
