// naiship-system/tests/components/CompensatoryPanel.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import CompensatoryPanel from '@/components/cases/CompensatoryPanel.vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { getAnnualLeaveCycleInfo } from '@/utils/annualLeaveSchedule'

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

  it('調整平日補休時數時，行為維持不變（仍走稽核路徑）', async () => {
    const { wrapper, usersStore } = await mountWithAdminUser()
    const adjustSpy = vi.spyOn(usersStore, 'adjustCompensatoryField')

    const weekdayButtons = wrapper.findAll('button').filter(b => b.text() === '調整')
    await weekdayButtons[0].trigger('click') // 第一個是平日補休

    await wrapper.find('input[type="number"]').setValue(8)
    await wrapper.find('button.rounded-xl').trigger('click')
    await flushPromises()

    expect(adjustSpy).toHaveBeenCalledWith('u1', 'compensatoryHours', 8, 2, '柏')
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

    const adjustSpy = vi.spyOn(usersStore, 'adjustCompensatoryField')
    const updateSpy = vi.spyOn(usersStore, 'updateUser')

    const applyButton = wrapper.findAll('button').find(b => b.text() === '套用')
    expect(applyButton.attributes('disabled')).toBeUndefined()
    await applyButton.trigger('click')
    await flushPromises()

    expect(adjustSpy).toHaveBeenCalledWith('u1', 'annualLeaveHours', 5 + info.currentCycleDays, 5, '柏')
    expect(updateSpy).toHaveBeenCalledWith('u1', { annualLeaveAppliedCycleStart: info.currentCycleStart })
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
