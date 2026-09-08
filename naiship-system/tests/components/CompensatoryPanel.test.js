// naiship-system/tests/components/CompensatoryPanel.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import CompensatoryPanel from '@/components/cases/CompensatoryPanel.vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { getAnnualLeaveCycleInfo } from '@/utils/annualLeaveSchedule'
import { addDoc } from 'firebase/firestore'

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
  addDoc: vi.fn(() => Promise.resolve({ id: 'adj-1' })),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => undefined })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn((...args) => args.join('/')),
  increment: vi.fn(n => ({ __increment: n })),
  serverTimestamp: vi.fn(() => 'ts'),
  Timestamp: { fromDate: vi.fn(d => d) },
  arrayUnion: vi.fn(),
  runTransaction: vi.fn(async (db, cb) => cb({ get: vi.fn(() => Promise.resolve({ data: () => ({}) })), set: vi.fn(), update: vi.fn() }))
}))

describe('CompensatoryPanel — 特休人工調整稽核', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  async function mountWithAdminUser() {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u1', name: '蚌', annualLeaveHours: 5, compensatoryHours: 2, compensatoryHolidayHours: 1 }]
    const wrapper = mount(CompensatoryPanel)
    await flushPromises()
    return { wrapper, usersStore }
  }

  it('調整特休時數時，跟補休一樣寫入稽核記錄（呼叫 adjustCompensatoryField，不是單純 updateUser）', async () => {
    const { wrapper, usersStore } = await mountWithAdminUser()
    const adjustSpy = vi.spyOn(usersStore, 'adjustCompensatoryField')
    const updateSpy = vi.spyOn(usersStore, 'updateUser')

    const annualLeaveButtons = wrapper.findAll('button').filter(b => b.text() === '調整')
    await annualLeaveButtons[2].trigger('click') // 平日補休、休息日補休、特休 依序排列，第三個是特休

    await wrapper.find('input[type="number"]').setValue(10)
    await wrapper.find('button.rounded-xl').trigger('click') // 儲存按鈕
    await flushPromises()

    expect(adjustSpy).toHaveBeenCalledWith('u1', 'annualLeaveHours', 10, 5, '柏')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('歸零特休時數時，跟補休一樣寫入稽核記錄', async () => {
    const { wrapper, usersStore } = await mountWithAdminUser()
    const adjustSpy = vi.spyOn(usersStore, 'adjustCompensatoryField')
    const updateSpy = vi.spyOn(usersStore, 'updateUser')

    const resetButtons = wrapper.findAll('button').filter(b => b.text() === '歸零')
    await resetButtons[2].trigger('click') // 第三個是特休
    await flushPromises()

    expect(adjustSpy).toHaveBeenCalledWith('u1', 'annualLeaveHours', 0, 5, '柏')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('調整平日補休時數時，改為寫入compLedger分錄，不再走adjustCompensatoryField', async () => {
    const { wrapper, usersStore } = await mountWithAdminUser()
    const addLedgerSpy = vi.spyOn(usersStore, 'addLedgerEntry').mockResolvedValue('e1')
    const adjustSpy = vi.spyOn(usersStore, 'adjustCompensatoryField')

    const weekdayButtons = wrapper.findAll('button').filter(b => b.text() === '調整')
    await weekdayButtons[0].trigger('click') // 第一個是平日補休

    await wrapper.find('input[type="number"]').setValue(8)
    await wrapper.find('button.rounded-xl').trigger('click')
    await flushPromises()

    expect(addLedgerSpy).toHaveBeenCalledWith('u1', expect.objectContaining({ type: '平日', hours: 8, remainingHours: 8 }))
    expect(adjustSpy).not.toHaveBeenCalled()
  })
})

describe('CompensatoryPanel — 特休依到職日試算套用', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('已到期時，套用按鈕可點擊，點擊後餘額加上目前週期天數並記錄套用週期', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    const info = getAnnualLeaveCycleInfo('2000-01-01')
    usersStore.users = [{
      id: 'u1', name: '蚌', annualLeaveHours: 5, compensatoryHours: 0, compensatoryHolidayHours: 0,
      hireDate: '2000-01-01', annualLeaveAppliedCycleStart: '1999-01-01',
    }]
    const wrapper = mount(CompensatoryPanel)
    await flushPromises()

    const applySpy = vi.spyOn(usersStore, 'applyAnnualLeaveCycle')

    const applyButton = wrapper.findAll('button').find(b => b.text() === '套用')
    expect(applyButton.attributes('disabled')).toBeUndefined()
    await applyButton.trigger('click')
    await flushPromises()

    expect(applySpy).toHaveBeenCalledWith('u1', 5 + info.currentCycleDays, 5, info.currentCycleStart, '柏')
  })

  it('未到期時，套用按鈕停用', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    const info = getAnnualLeaveCycleInfo('2000-01-01')
    usersStore.users = [{
      id: 'u1', name: '蚌', annualLeaveHours: 5, compensatoryHours: 0, compensatoryHolidayHours: 0,
      hireDate: '2000-01-01', annualLeaveAppliedCycleStart: info.currentCycleStart,
    }]
    const wrapper = mount(CompensatoryPanel)
    await flushPromises()

    const applyButton = wrapper.findAll('button').find(b => b.text() === '套用')
    expect(applyButton.attributes('disabled')).toBeDefined()
  })

  it('沒有到職日的人不顯示套用按鈕', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u1', name: '蚌', annualLeaveHours: 5, compensatoryHours: 0, compensatoryHolidayHours: 0 }]
    const wrapper = mount(CompensatoryPanel)
    await flushPromises()

    expect(wrapper.findAll('button').find(b => b.text() === '套用')).toBeUndefined()
  })
})

describe('CompensatoryPanel — 補休分錄化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('補休時數顯示為compLedger裡remainingHours的加總', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u1', name: '蚌', annualLeaveHours: 5, compensatoryHours: 0, compensatoryHolidayHours: 0 }]
    vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue([
      { id: 'e1', type: '平日', hours: 3, remainingHours: 3, value: 600, createdAt: null },
      { id: 'e2', type: '平日', hours: 2, remainingHours: 1.5, value: 400, createdAt: null },
    ])
    const wrapper = mount(CompensatoryPanel)
    await flushPromises()

    expect(wrapper.text()).toContain('4.5')
  })

  it('已到期分錄顯示提醒與確認換現金按鈕', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u1', name: '蚌', annualLeaveHours: 5, compensatoryHours: 0, compensatoryHolidayHours: 0 }]
    vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue([
      { id: 'e1', type: '平日', hours: 3, remainingHours: 3, value: 600, expireDate: '2020-01-01', createdAt: null },
    ])
    const wrapper = mount(CompensatoryPanel)
    await flushPromises()

    expect(wrapper.text()).toContain('已到期未用完')
    expect(wrapper.findAll('button').find(b => b.text() === '確認到期換現金')).toBeTruthy()
  })

  it('沒有到期分錄時不顯示提醒', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u1', name: '蚌', annualLeaveHours: 5, compensatoryHours: 0, compensatoryHolidayHours: 0 }]
    vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue([
      { id: 'e1', type: '平日', hours: 3, remainingHours: 3, value: 600, expireDate: '2099-01-01', createdAt: null },
    ])
    const wrapper = mount(CompensatoryPanel)
    await flushPromises()

    expect(wrapper.text()).not.toContain('已到期未用完')
  })

  it('換現金部分消耗最後一筆分錄時，金額依實際消耗比例計算（不會多算成整筆分錄的比例）', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u1', name: '蚌', annualLeaveHours: 5, compensatoryHours: 0, compensatoryHolidayHours: 0 }]
    vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue([
      { id: 'e1', type: '平日', hours: 3, remainingHours: 3, value: 600, createdAt: null },
      { id: 'e2', type: '平日', hours: 2, remainingHours: 1.5, value: 400, createdAt: null },
    ])
    vi.spyOn(usersStore, 'applyLedgerConsumption').mockResolvedValue()
    addDoc.mockClear()

    const wrapper = mount(CompensatoryPanel)
    await flushPromises()

    const cashoutButtons = wrapper.findAll('button').filter(b => b.text() === '換現金')
    await cashoutButtons[0].trigger('click') // 平日補休的換現金按鈕

    await wrapper.find('input[type="number"]').setValue(4) // 只換4小時：e1全消耗3h、e2只消耗1h（不是1.5h全部）
    await wrapper.find('button.rounded-xl').trigger('click') // 換現金 Modal 的送出按鈕
    await flushPromises()

    const payload = addDoc.mock.calls.map(c => c[1]).find(p => p && p.amount !== undefined)
    expect(payload).toBeTruthy()
    expect(payload.amount).toBe(800) // 600 + (1/2)*400，不是600 + (1.5/2)*400=900
    expect(payload.hours).toBe(4)
  })
})
