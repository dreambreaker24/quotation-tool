import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import CalendarTab from '@/components/cases/CalendarTab.vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useCalendarEventsStore } from '@/stores/calendarEvents'
import { hoursToDays } from '@/utils/leaveConversion'

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
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-event-1' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn((...args) => args.join('/')),
  serverTimestamp: vi.fn(() => 'ts'),
  Timestamp: { fromDate: vi.fn(d => ({ toDate: () => d, toMillis: () => d.getTime() })) },
}))

// 動態算日期（都相對「現在」計算），避免硬編日期隨時間推移變成過去、跟 removeConflictingEvents
// 的「過去日期不退款」規則互相打架
function pad2(n) { return String(n).padStart(2, '0') }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d }

const EXISTING_START = fmtDate(addDays(5))   // 未來日期，衝突紀錄應該要退款
const EXISTING_END = fmtDate(addDays(7))
const OVERLAP_DATE = fmtDate(addDays(6))     // 落在 EXISTING_START~EXISTING_END 之間
const NO_OVERLAP_DATE = fmtDate(addDays(60)) // 遠離衝突區間，不重疊
const PAST_START = fmtDate(addDays(-10))     // 過去日期，衝突紀錄不應該退款
const PAST_END = fmtDate(addDays(-8))
const PAST_OVERLAP_DATE = fmtDate(addDays(-9))

function defaultExistingLeave() {
  return {
    id: 'existing-1', type: 'leave', personName: '蚌', leaveType: '特休', hours: 24,
    date: { toDate: () => new Date(EXISTING_START) },
    endDate: { toDate: () => new Date(EXISTING_END) },
  }
}

describe('CalendarTab — 請假衝突偵測', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function mountWithManager(existingEvents = [defaultExistingLeave()]) {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [
      { id: 'u-bang', name: '蚌', annualLeaveHours: 0 },
    ]
    vi.spyOn(eventsStore, 'fetchLeaveEventsByPerson').mockResolvedValue(existingEvents)
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    return { wrapper, usersStore, eventsStore, authStore }
  }

  it('新增跟既有請假重疊的事假時，跳出衝突視窗而不是直接寫入', async () => {
    const { wrapper, eventsStore } = await mountWithManager()
    const addSpy = vi.spyOn(eventsStore, 'addEvent')

    await wrapper.vm.$nextTick()
    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await flushPromises()

    expect(addSpy).not.toHaveBeenCalled()
    expect(wrapper.vm.conflictModal).not.toBeNull()
    expect(wrapper.vm.conflictModal.conflicts.map(c => c.id)).toEqual(['existing-1'])
  })

  it('沒有重疊時正常寫入，不跳出衝突視窗', async () => {
    const { wrapper, eventsStore } = await mountWithManager()
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = NO_OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await flushPromises()

    expect(wrapper.vm.conflictModal).toBeNull()
    expect(addSpy).toHaveBeenCalled()
  })

  it('選擇「保留現有」時中止新增，不寫入新的一筆', async () => {
    const { wrapper, eventsStore } = await mountWithManager()
    const addSpy = vi.spyOn(eventsStore, 'addEvent')
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent')

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await wrapper.vm.resolveConflict('keep')
    await flushPromises()

    expect(addSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(wrapper.vm.conflictModal).toBeNull()
  })

  it('選擇「改用新增（事假）」時，先確認新紀錄寫入成功才刪除並精確退回原本衝突的特休時數', async () => {
    const { wrapper, eventsStore, usersStore } = await mountWithManager()
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent').mockResolvedValue()
    const adjustSpy = vi.spyOn(usersStore, 'adjustAnnualLeaveHours').mockResolvedValue()

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await wrapper.vm.resolveConflict('personal')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('existing-1')
    // 舊的特休 24h（未來日期）要精確退回：hoursToDays(24) = 3 天
    expect(adjustSpy).toHaveBeenCalledWith('u-bang', hoursToDays(24))
    expect(addSpy).toHaveBeenCalled()
    const addedPayload = addSpy.mock.calls[0][0]
    expect(addedPayload.leaveType).toBe('事假')
  })

  it('選擇「改用新增（補休）」時，寫入補休並刪除原本衝突的那筆', async () => {
    const { wrapper, eventsStore, usersStore } = await mountWithManager()
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent').mockResolvedValue()
    vi.spyOn(usersStore, 'adjustAnnualLeaveHours').mockResolvedValue()
    vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue([
      { id: 'e1', type: '平日', hours: 8, remainingHours: 8, createdAt: { toMillis: () => 1 } },
    ])
    const applyLedgerSpy = vi.spyOn(usersStore, 'applyLedgerConsumption').mockResolvedValue()

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await wrapper.vm.resolveConflict('comp')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('existing-1')
    expect(applyLedgerSpy).toHaveBeenCalled()
    expect(addSpy).toHaveBeenCalled()
    const addedPayload = addSpy.mock.calls[0][0]
    expect(addedPayload.leaveType).toBe('補休')
  })

  it('編輯模式下跟既有請假重疊時，也會跳出衝突視窗，選擇「改用新增（事假）」後改用 updateEvent 寫入', async () => {
    const { wrapper, eventsStore, usersStore } = await mountWithManager()
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent').mockResolvedValue()
    const adjustSpy = vi.spyOn(usersStore, 'adjustAnnualLeaveHours').mockResolvedValue()

    wrapper.vm.editingEventId = 'edit-target-1'
    wrapper.vm.editForm = {
      type: 'leave', date: OVERLAP_DATE, endDate: '', label: '',
      personName: '蚌', hours: 8, leaveType: '事假', caseIds: [], personNames: [],
      startTime: '', endTime: '',
      _origLeaveType: '', _origHours: 0, _origPersonName: '蚌',
      _origDate: OVERLAP_DATE, _origCompConsumption: [],
    }
    await wrapper.vm.saveEditEvent()
    await flushPromises()

    expect(updateSpy).not.toHaveBeenCalled()
    expect(wrapper.vm.conflictModal).not.toBeNull()
    expect(wrapper.vm.conflictModal.mode).toBe('edit')
    expect(wrapper.vm.conflictModal.conflicts.map(c => c.id)).toEqual(['existing-1'])

    await wrapper.vm.resolveConflict('personal')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('existing-1')
    expect(adjustSpy).toHaveBeenCalledWith('u-bang', hoursToDays(24))
    expect(updateSpy).toHaveBeenCalledWith('edit-target-1', expect.objectContaining({ leaveType: '事假' }))
    expect(wrapper.vm.conflictModal).toBeNull()
  })

  it('衝突紀錄日期是過去日期時，刪除但不退回餘額', async () => {
    const { wrapper, eventsStore, usersStore } = await mountWithManager([
      {
        id: 'existing-past', type: 'leave', personName: '蚌', leaveType: '特休', hours: 24,
        date: { toDate: () => new Date(PAST_START) },
        endDate: { toDate: () => new Date(PAST_END) },
      },
    ])
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent').mockResolvedValue()
    const adjustSpy = vi.spyOn(usersStore, 'adjustAnnualLeaveHours').mockResolvedValue()

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = PAST_OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await wrapper.vm.resolveConflict('personal')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('existing-past')
    expect(adjustSpy).not.toHaveBeenCalled()
    expect(addSpy).toHaveBeenCalled()
  })

  it('resolveConflict 連續呼叫兩次（模擬手快連點）時，第二次不會重複退回餘額', async () => {
    const { wrapper, eventsStore, usersStore } = await mountWithManager()
    vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })
    vi.spyOn(eventsStore, 'deleteEvent').mockResolvedValue()
    const adjustSpy = vi.spyOn(usersStore, 'adjustAnnualLeaveHours').mockResolvedValue()

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()

    // 不 await 第一次呼叫就立刻觸發第二次，模擬使用者連點兩次
    const first = wrapper.vm.resolveConflict('personal')
    const second = wrapper.vm.resolveConflict('personal')
    await Promise.all([first, second])
    await flushPromises()

    expect(adjustSpy).toHaveBeenCalledTimes(1)
  })

  it('新紀錄寫入成功但刪除舊衝突紀錄失敗時，直接關閉視窗、不留給使用者重試（避免重複寫入/重複扣款）', async () => {
    const { wrapper, eventsStore, usersStore } = await mountWithManager()
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })
    // 模擬刪除舊衝突紀錄時網路斷線失敗
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent').mockRejectedValue(new Error('network error'))
    vi.spyOn(usersStore, 'adjustAnnualLeaveHours').mockResolvedValue()

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await wrapper.vm.resolveConflict('personal')
    await flushPromises()

    // 新紀錄已經寫入成功，視窗直接關閉，不保留給使用者重試整個流程
    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).toHaveBeenCalledWith('existing-1')
    expect(wrapper.vm.conflictModal).toBeNull()

    // 使用者若在畫面上又點了一次（例如殘留的按鈕事件），也不會觸發任何新的呼叫，
    // 因為 conflictModal 已經是 null，resolveConflict 一開頭就會直接 return
    await wrapper.vm.resolveConflict('personal')
    await flushPromises()

    expect(addSpy).toHaveBeenCalledTimes(1)
  })

  it('衝突紀錄裡有一筆已透過薪資單折抵鎖定時，「改用新增」按鈕disable，且resolveConflict函式層面也擋下刪除', async () => {
    const { wrapper, eventsStore } = await mountWithManager([
      {
        id: 'existing-locked', type: 'leave', personName: '蚌', leaveType: '補休', hours: 8,
        date: { toDate: () => new Date(EXISTING_START) },
        endDate: { toDate: () => new Date(EXISTING_END) },
        leaveTypeLocked: true,
      },
    ])
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent')
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = OVERLAP_DATE
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await flushPromises()

    expect(wrapper.vm.conflictModal).not.toBeNull()
    expect(wrapper.vm.conflictModal.conflicts[0].leaveTypeLocked).toBe(true)

    // 畫面層面：「改用新增（補休）」「改用新增（事假）」按鈕要 disabled，「保留現有」「取消」維持可點
    const buttons = wrapper.findAll('button')
    const compBtn = buttons.find(b => b.text().includes('改用新增（補休）'))
    const personalBtn = buttons.find(b => b.text().includes('改用新增（事假）'))
    const keepBtn = buttons.find(b => b.text() === '保留現有')
    expect(compBtn.attributes('disabled')).toBeDefined()
    expect(personalBtn.attributes('disabled')).toBeDefined()
    expect(keepBtn.attributes('disabled')).toBeUndefined()

    // 函式層面：即使直接呼叫 resolveConflict('comp') / ('personal') 模擬繞過 disabled 屬性，
    // 也不應該寫入新紀錄或刪除鎖定事件
    await wrapper.vm.resolveConflict('comp')
    await flushPromises()
    expect(addSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(wrapper.vm.conflictModal).not.toBeNull()

    await wrapper.vm.resolveConflict('personal')
    await flushPromises()
    expect(addSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(wrapper.vm.conflictModal).not.toBeNull()
  })
})

describe('CalendarTab — leaveTypeLocked 鎖定', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const FUTURE_DATE = fmtDate(addDays(30))

  it('openEditEvent 讀到 leaveTypeLocked 事件時，saveEditEvent 不會改動假別/時數，也不會動到 compConsumption', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u-bang', name: '蚌' }]
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()

    wrapper.vm.openEditEvent({
      id: 'ev-1', type: 'leave', personName: '蚌', leaveType: '補休', hours: 8,
      date: { toDate: () => new Date(FUTURE_DATE) },
      leaveTypeLocked: true, convertedFromLeaveType: '事假', compConsumption: [{ id: 'led-1', hours: 8 }],
    })
    expect(wrapper.vm.editForm._leaveTypeLocked).toBe(true)

    wrapper.vm.editForm.leaveType = '事假' // 模擬繞過 disable 屬性直接改
    wrapper.vm.editForm.hours = 100
    // 假別/時數被鎖定重設回原值後，跟原值完全相同（noChange），finalizeEditEvent 應該整段跳過
    // 退回/重新核銷邏輯，不應該呼叫 fetchCompLedger／applyLedgerConsumption
    const fetchLedgerSpy = vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue([])
    const applyLedgerSpy = vi.spyOn(usersStore, 'applyLedgerConsumption').mockResolvedValue()
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    await wrapper.vm.saveEditEvent()
    await flushPromises()

    const savedPayload = updateSpy.mock.calls[0][1]
    expect(savedPayload.leaveType).toBe('補休')
    expect(savedPayload.hours).toBe(8)
    // compConsumption 沒有被設定：updateDoc 是部分合併，原本存的 compConsumption 會維持不變
    expect(savedPayload.compConsumption).toBeUndefined()
    expect(fetchLedgerSpy).not.toHaveBeenCalled()
    expect(applyLedgerSpy).not.toHaveBeenCalled()
  })

  it('鎖定事件如果被繞過改了 personName，saveEditEvent 存檔後會還原回原本的人員', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u-bang', name: '蚌' }, { id: 'u-qh', name: '其宏' }]
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()

    wrapper.vm.openEditEvent({
      id: 'ev-1', type: 'leave', personName: '蚌', leaveType: '補休', hours: 8,
      date: { toDate: () => new Date(FUTURE_DATE) },
      leaveTypeLocked: true, compConsumption: [{ id: 'led-1', hours: 8 }],
    })
    expect(wrapper.vm.editForm._leaveTypeLocked).toBe(true)

    wrapper.vm.editForm.personName = '其宏' // 模擬繞過 disable 屬性直接改指派對象
    const fetchLedgerSpy = vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue([])
    const applyLedgerSpy = vi.spyOn(usersStore, 'applyLedgerConsumption').mockResolvedValue()
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    await wrapper.vm.saveEditEvent()
    await flushPromises()

    expect(wrapper.vm.editForm.personName).toBe('蚌')
    const savedPayload = updateSpy.mock.calls[0][1]
    expect(savedPayload.personName).toBe('蚌')
    expect(savedPayload.compConsumption).toBeUndefined()
    expect(fetchLedgerSpy).not.toHaveBeenCalled()
    expect(applyLedgerSpy).not.toHaveBeenCalled()
  })

  it('leaveTypeLocked 事件呼叫 removeEvent 會被擋下', async () => {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u-bang', name: '蚌' }]
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()

    wrapper.vm.openEditEvent({
      id: 'ev-1', type: 'leave', personName: '蚌', leaveType: '補休', hours: 8,
      date: { toDate: () => new Date(FUTURE_DATE) },
      leaveTypeLocked: true,
    })
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent')
    await wrapper.vm.removeEvent()

    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
