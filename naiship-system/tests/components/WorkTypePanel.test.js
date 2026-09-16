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

    it('勾選的項目在送出前其實已經被其他付款紀錄付清，不會誤分攤金額也不會誤呼叫markDone', async () => {
        const wt = makeWt({
            vendorPayments: [{ id: 'vp0', amount: 6500, itemAllocations: [{ itemId: 'i1', amount: 6500 }] }],
        })
        const { wrapper } = await mountWithWorkType(wt)
        const remindersStore = usePaymentRemindersStore()
        const markDoneSpy = vi.spyOn(remindersStore, 'markDone').mockResolvedValue()

        wrapper.vm.openVendorPay(0)
        await wrapper.vm.$nextTick()
        // i1 其實已經付清了，但畫面上假設使用者還是把它跟i2一起勾選送出
        wrapper.vm.selectedPaymentItemIds = ['i1', 'i2']
        wrapper.vm.vendorPayForm.amount = 31710
        wrapper.vm.vendorPayForm.paidDate = '2026-09-09'
        await wrapper.vm.addVendorPayment()
        await flushPromises()

        // 全部31710應該分攤給i2（i1的owed是0，allocatePayment不會分給它）
        expect(markDoneSpy).toHaveBeenCalledWith('auto_vendor_item_wt1_i2')
        expect(markDoneSpy).not.toHaveBeenCalledWith('auto_vendor_item_wt1_i1')
    })

    it('勾選兩個項目但金額只夠付清第一個項目、部分付到第二個項目，只有真的付清的那個項目markDone', async () => {
        const wt = makeWt()
        const { wrapper } = await mountWithWorkType(wt)
        const remindersStore = usePaymentRemindersStore()
        const markDoneSpy = vi.spyOn(remindersStore, 'markDone').mockResolvedValue()

        wrapper.vm.openVendorPay(0)
        await wrapper.vm.$nextTick()
        wrapper.vm.selectedPaymentItemIds = ['i1', 'i2'] // i1=$6500, i2=$31710
        wrapper.vm.vendorPayForm.amount = 10000 // 夠付清i1（$6500），剩$3500分給i2（還欠$28210）
        wrapper.vm.vendorPayForm.paidDate = '2026-09-09'
        await wrapper.vm.addVendorPayment()
        await flushPromises()

        expect(markDoneSpy).toHaveBeenCalledWith('auto_vendor_item_wt1_i1')
        expect(markDoneSpy).not.toHaveBeenCalledWith('auto_vendor_item_wt1_i2')
    })

    it('整個工種已經全部付清時，即使個別項目沒有itemAllocations紀錄，也視為已付清', async () => {
        const wt = makeWt({
            vendorPayments: [{ id: 'vp_old', amount: 38210, paidDate: '2026-08-31', note: '舊資料無分攤' }],
        })
        const { wrapper } = await mountWithWorkType(wt)

        expect(wrapper.vm.isItemFullyPaid(wt, wt.vendorCostItems[0])).toBe(true)
    })
})

describe('WorkTypePanel — 進場/退場日期防呆', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    async function mountEmpty() {
        const casesStore = useCasesStore()
        const authStore = useAuthStore()
        authStore.role = 'admin'
        authStore.name = '柏'
        casesStore.cases = [{ id: caseId, name: '大同區辦公室', companyId: 'north', workTypes: [] }]
        const wrapper = mount(WorkTypePanel, { props: { caseId, caseName: '大同區辦公室' } })
        await flushPromises()
        return { wrapper, casesStore }
    }

    it('進場/退場日期都沒填，跳確認視窗；使用者取消則不儲存', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false))
        const { wrapper, casesStore } = await mountEmpty()
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase')

        wrapper.vm.openAdd()
        await wrapper.vm.$nextTick()
        wrapper.vm.form.name = '油漆'
        await wrapper.vm.submitForm()
        await flushPromises()

        expect(global.confirm).toHaveBeenCalledWith('進場日期或退場日期尚未填寫，確定要儲存嗎？')
        expect(updateCaseSpy).not.toHaveBeenCalled()
    })

    it('進場/退場日期都沒填，使用者確認後仍正常儲存', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true))
        const { wrapper, casesStore } = await mountEmpty()
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase').mockResolvedValue()

        wrapper.vm.openAdd()
        await wrapper.vm.$nextTick()
        wrapper.vm.form.name = '油漆'
        await wrapper.vm.submitForm()
        await flushPromises()

        expect(updateCaseSpy).toHaveBeenCalled()
    })

    it('進場、退場日期都有填，不跳確認視窗，直接儲存', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true))
        const { wrapper, casesStore } = await mountEmpty()
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase').mockResolvedValue()

        wrapper.vm.openAdd()
        await wrapper.vm.$nextTick()
        wrapper.vm.form.name = '油漆'
        wrapper.vm.form.startDate = '2026-10-01'
        wrapper.vm.form.endDate = '2026-10-05'
        await wrapper.vm.submitForm()
        await flushPromises()

        expect(global.confirm).not.toHaveBeenCalled()
        expect(updateCaseSpy).toHaveBeenCalled()
    })

    it('只有退場日期沒填（進場日期有填），仍然跳確認視窗', async () => {
        vi.stubGlobal('confirm', vi.fn(() => true))
        const { wrapper, casesStore } = await mountEmpty()
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase').mockResolvedValue()

        wrapper.vm.openAdd()
        await wrapper.vm.$nextTick()
        wrapper.vm.form.name = '油漆'
        wrapper.vm.form.startDate = '2026-10-01'
        await wrapper.vm.submitForm()
        await flushPromises()

        expect(global.confirm).toHaveBeenCalledWith('進場日期或退場日期尚未填寫，確定要儲存嗎？')
        expect(updateCaseSpy).toHaveBeenCalled()
    })
})

describe('WorkTypePanel — 已完工收合', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    function makeWorkTypes() {
        return [
            { id: 'wt_a', name: '水電', done: false },
            { id: 'wt_b', name: '油漆', done: true },
            { id: 'wt_c', name: '木工', done: false },
            { id: 'wt_d', name: '泥作', done: true },
        ]
    }

    async function mountWithWorkTypes(workTypes) {
        const casesStore = useCasesStore()
        const authStore = useAuthStore()
        authStore.role = 'admin'
        authStore.name = '柏'
        casesStore.cases = [{ id: caseId, name: '大同區辦公室', companyId: 'north', workTypes }]
        const wrapper = mount(WorkTypePanel, { props: { caseId, caseName: '大同區辦公室' } })
        await flushPromises()
        return { wrapper, casesStore }
    }

    it('displayWorkTypes 把未完工排在前面、已完工排在後面，各自維持原本相對順序', async () => {
        const { wrapper } = await mountWithWorkTypes(makeWorkTypes())
        const ids = wrapper.vm.displayWorkTypes.map(({ wt }) => wt.id)
        expect(ids).toEqual(['wt_a', 'wt_c', 'wt_b', 'wt_d'])
    })

    it('doneCount 正確計算已完工工種數量', async () => {
        const { wrapper } = await mountWithWorkTypes(makeWorkTypes())
        expect(wrapper.vm.doneCount).toBe(2)
    })

    it('firstDoneDisplayIndex 指向 displayWorkTypes 裡第一個已完工項目的位置', async () => {
        const { wrapper } = await mountWithWorkTypes(makeWorkTypes())
        expect(wrapper.vm.firstDoneDisplayIndex).toBe(2)
    })

    it('沒有任何已完工工種時，firstDoneDisplayIndex 是 -1，收合列不顯示', async () => {
        const { wrapper } = await mountWithWorkTypes([
            { id: 'wt_a', name: '水電', done: false },
        ])
        expect(wrapper.vm.firstDoneDisplayIndex).toBe(-1)
        expect(wrapper.find('#worktype-card-wt_a').exists()).toBe(true)
        expect(wrapper.text()).not.toContain('已完工工種')
    })

    it('預設收合，已完工工種的卡片不顯示在畫面上', async () => {
        const { wrapper } = await mountWithWorkTypes(makeWorkTypes())
        expect(wrapper.find('#worktype-card-wt_a').exists()).toBe(true)
        expect(wrapper.find('#worktype-card-wt_c').exists()).toBe(true)
        expect(wrapper.find('#worktype-card-wt_b').exists()).toBe(false)
        expect(wrapper.find('#worktype-card-wt_d').exists()).toBe(false)
        expect(wrapper.text()).toContain('已完工工種（2）')
    })

    it('點擊收合列展開後，已完工工種的卡片會顯示出來', async () => {
        const { wrapper } = await mountWithWorkTypes(makeWorkTypes())
        const toggle = wrapper.findAll('button').find(b => b.text().includes('已完工工種'))
        await toggle.trigger('click')
        expect(wrapper.find('#worktype-card-wt_b').exists()).toBe(true)
        expect(wrapper.find('#worktype-card-wt_d').exists()).toBe(true)
    })

    it('全部工種都已完工時，收合列出現在最前面，展開後所有卡片都顯示', async () => {
        const { wrapper } = await mountWithWorkTypes([
            { id: 'wt_a', name: '水電', done: true },
            { id: 'wt_b', name: '油漆', done: true },
        ])
        expect(wrapper.vm.firstDoneDisplayIndex).toBe(0)
        expect(wrapper.text()).toContain('已完工工種（2）')
        expect(wrapper.find('#worktype-card-wt_a').exists()).toBe(false)
        const toggle = wrapper.findAll('button').find(b => b.text().includes('已完工工種'))
        await toggle.trigger('click')
        expect(wrapper.find('#worktype-card-wt_a').exists()).toBe(true)
        expect(wrapper.find('#worktype-card-wt_b').exists()).toBe(true)
    })
})

describe('WorkTypePanel — 工種拖曳排序', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    function makeWorkTypes() {
        return [
            { id: 'wt_a', name: '水電', done: false },
            { id: 'wt_b', name: '油漆', done: false },
            { id: 'wt_c', name: '木工', done: false },
        ]
    }

    async function mountWithWorkTypes(workTypes) {
        const casesStore = useCasesStore()
        const authStore = useAuthStore()
        authStore.role = 'admin'
        authStore.name = '柏'
        casesStore.cases = [{ id: caseId, name: '大同區辦公室', companyId: 'north', workTypes }]
        const wrapper = mount(WorkTypePanel, { props: { caseId, caseName: '大同區辦公室' } })
        await flushPromises()
        return { wrapper, casesStore }
    }

    it('把第一筆拖到第三筆卡片上，插入到第三筆前面並正確存檔', async () => {
        const { wrapper, casesStore } = await mountWithWorkTypes(makeWorkTypes())
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase').mockResolvedValue()

        wrapper.vm.onCardDragStart(0, {})
        await wrapper.vm.onCardDrop(2)
        await flushPromises()

        const savedIds = updateCaseSpy.mock.calls[0][1].workTypes.map(wt => wt.id)
        expect(savedIds).toEqual(['wt_b', 'wt_a', 'wt_c'])
    })

    it('把第三筆拖到第一筆卡片上，插入到第一筆前面並正確存檔', async () => {
        const { wrapper, casesStore } = await mountWithWorkTypes(makeWorkTypes())
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase').mockResolvedValue()

        wrapper.vm.onCardDragStart(2, {})
        await wrapper.vm.onCardDrop(0)
        await flushPromises()

        const savedIds = updateCaseSpy.mock.calls[0][1].workTypes.map(wt => wt.id)
        expect(savedIds).toEqual(['wt_c', 'wt_a', 'wt_b'])
    })

    it('拖到自己原本的位置，不會呼叫 updateCase', async () => {
        const { wrapper, casesStore } = await mountWithWorkTypes(makeWorkTypes())
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase').mockResolvedValue()

        wrapper.vm.onCardDragStart(1, {})
        await wrapper.vm.onCardDrop(1)
        await flushPromises()

        expect(updateCaseSpy).not.toHaveBeenCalled()
    })

    it('已完工工種夾在中間時，拖曳未完工項目不影響已完工項目的位置', async () => {
        const workTypes = [
            { id: 'wt_a', name: '水電', done: false },
            { id: 'wt_x', name: '油漆', done: true },
            { id: 'wt_b', name: '木工', done: false },
        ]
        const { wrapper, casesStore } = await mountWithWorkTypes(workTypes)
        const updateCaseSpy = vi.spyOn(casesStore, 'updateCase').mockResolvedValue()

        wrapper.vm.onCardDragStart(2, {})
        await wrapper.vm.onCardDrop(0)
        await flushPromises()

        const savedIds = updateCaseSpy.mock.calls[0][1].workTypes.map(wt => wt.id)
        expect(savedIds).toEqual(['wt_b', 'wt_a', 'wt_x'])
    })
})
