import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import CalendarTab from '@/components/cases/CalendarTab.vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useCalendarEventsStore } from '@/stores/calendarEvents'
import { hoursToDays } from '@/utils/leaveConversion'
import { TAIWAN_HOLIDAY_NAMES } from '@/constants/holidays'

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
  setDoc: vi.fn(() => Promise.resolve()),
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
const PAST_START = fmtDate(addDays(-10))     // 過去日期，衝突紀錄不應該退款
const PAST_END = fmtDate(addDays(-8))
const PAST_OVERLAP_DATE = fmtDate(addDays(-9))

function firstWorkdayFrom(offset) {
  const d = addDays(offset)
  while (d.getDay() === 0 || d.getDay() === 6 || TAIWAN_HOLIDAY_NAMES[fmtDate(d)]) {
    d.setDate(d.getDate() + 1)
  }
  return fmtDate(d)
}
const SAFE_WEEKDAY = firstWorkdayFrom(45)
const NO_OVERLAP_DATE = firstWorkdayFrom(60) // 遠離衝突區間，不重疊（且保證為上班日）

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

  it('改用新增時，若既有衝突事件的 id 剛好等於新紀錄的固定 doc ID，不會把新紀錄刪掉', async () => {
    const collidingId = `leave-south-蚌-${SAFE_WEEKDAY.replace(/-/g, '')}-single-事假-0900`
    const existing = {
      id: collidingId, type: 'leave', personName: '蚌', leaveType: '事假', hours: 8,
      date: { toDate: () => new Date(SAFE_WEEKDAY) },
    }
    const { wrapper, eventsStore } = await mountWithManager([existing])
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: collidingId })
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent').mockResolvedValue()

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = SAFE_WEEKDAY
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    wrapper.vm.eventForm.startTime = '09:00'
    wrapper.vm.eventForm.endTime = '18:00'
    await wrapper.vm.submitEvent()        // conflict modal opens
    await flushPromises()
    expect(wrapper.vm.conflictModal).not.toBeNull()
    await wrapper.vm.resolveConflict('personal')
    await flushPromises()

    expect(addSpy).toHaveBeenCalled()
    expect(addSpy.mock.calls[0][1]).toBe(collidingId)
    expect(deleteSpy).not.toHaveBeenCalledWith(collidingId)
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

  it('連續兩次 submitEvent（不 await 第一次）只會寫入一筆', async () => {
    const { wrapper, eventsStore } = await mountWithManager([])
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = SAFE_WEEKDAY
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'

    const p1 = wrapper.vm.submitEvent()
    const p2 = wrapper.vm.submitEvent()
    await Promise.all([p1, p2])
    await flushPromises()

    expect(addSpy).toHaveBeenCalledTimes(1)
  })

  it('請假日期是國定假日（2026-09-28 教師節）時擋下，不寫入', async () => {
    const { wrapper, eventsStore } = await mountWithManager([])
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = '2026-09-28'
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await flushPromises()

    expect(addSpy).not.toHaveBeenCalled()
    expect(wrapper.vm.conflictModal).toBeNull()
  })

  it('請假日期是週六時擋下，不寫入', async () => {
    const { wrapper, eventsStore } = await mountWithManager([])
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = '2026-10-17' // 週六
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await flushPromises()

    expect(addSpy).not.toHaveBeenCalled()
  })

  it('跨假日的區間假（含上班日）仍可送出', async () => {
    const { wrapper, eventsStore } = await mountWithManager([])
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = '2026-10-15'
    wrapper.vm.eventForm.endDate = '2026-10-19' // 含週末，但有 10/15、10/16、10/19 上班日
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 24
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await flushPromises()

    expect(addSpy).toHaveBeenCalled()
  })

  it('新增請假時 addEvent 會帶入穩定的 dedupe doc ID', async () => {
    const { wrapper, eventsStore } = await mountWithManager([])
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })

    const fill = () => {
      wrapper.vm.eventForm.type = 'leave'
      wrapper.vm.eventForm.date = '2026-10-15'
      wrapper.vm.eventForm.personName = '蚌'
      wrapper.vm.eventForm.hours = 8
      wrapper.vm.eventForm.leaveType = '事假'
      wrapper.vm.eventForm.startTime = '09:00'
      wrapper.vm.eventForm.endTime = '18:00'
    }

    fill()
    await wrapper.vm.submitEvent()
    await flushPromises()
    fill()
    await wrapper.vm.submitEvent()
    await flushPromises()

    const ids = addSpy.mock.calls.map(c => c[1])
    expect(ids[0]).toBe('leave-south-蚌-20261015-single-事假-0900')
    expect(ids[0]).toBe(ids[1])
  })

  it('非請假事件 addEvent 第二參數為 null（維持自動 ID）', async () => {
    const { wrapper, eventsStore } = await mountWithManager([])
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })

    wrapper.vm.eventForm.type = 'note'
    wrapper.vm.eventForm.date = '2026-10-15'
    wrapper.vm.eventForm.label = '測試記事'
    wrapper.vm.eventForm.startTime = '09:00'
    wrapper.vm.eventForm.endTime = '10:00'
    await wrapper.vm.submitEvent()
    await flushPromises()

    expect(addSpy.mock.calls[0][1] ?? null).toBeNull()
  })
})

describe('CalendarTab — leaveTypeLocked 鎖定', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const FUTURE_DATE = firstWorkdayFrom(30) // 保證為上班日，避免撞到週末/國定假日硬擋

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

describe('CalendarTab — 事件移動 / 複製', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function tsYMD(ts) {
    const d = ts.toDate()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  async function mountPlain() {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    authStore.user = { uid: 'u-bo' }
    usersStore.users = [{ id: 'u-bang', name: '蚌' }]
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    return { wrapper, eventsStore }
  }

  function milestoneEvent(overrides = {}) {
    return {
      id: 'm1', type: 'milestone', label: '大同 場勘', companyId: 'south',
      caseIds: ['c1'], caseNames: ['大同區辦公室'], personNames: ['蚌'],
      startTime: '09:00', endTime: '12:00',
      date: { toDate: () => new Date('2026-09-10') },
      ...overrides,
    }
  }

  it('moveEvent 單日：updateEvent 帶新日期、endDate 為 null', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    const spy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    await wrapper.vm.moveEvent(milestoneEvent(), '2026-09-15')
    expect(spy).toHaveBeenCalledTimes(1)
    const [id, payload] = spy.mock.calls[0]
    expect(id).toBe('m1')
    expect(tsYMD(payload.date)).toBe('2026-09-15')
    expect(payload.endDate).toBeNull()
  })

  it('moveEvent 區間：整段平移保持天數', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    const spy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    const evt = milestoneEvent({ endDate: { toDate: () => new Date('2026-09-12') } })
    await wrapper.vm.moveEvent(evt, '2026-09-20')
    const [, payload] = spy.mock.calls[0]
    expect(tsYMD(payload.date)).toBe('2026-09-20')
    expect(tsYMD(payload.endDate)).toBe('2026-09-22')
  })

  it('moveEvent 移到原本同一天：不呼叫 updateEvent', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    const spy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    await wrapper.vm.moveEvent(milestoneEvent(), '2026-09-10')
    expect(spy).not.toHaveBeenCalled()
  })

  it('copyEvent：addEvent 帶照抄的欄位 + 新日期，不動原事件', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new' })
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    await wrapper.vm.copyEvent(milestoneEvent(), '2026-09-20')
    expect(updateSpy).not.toHaveBeenCalled()
    expect(addSpy).toHaveBeenCalledTimes(1)
    const [payload, dedupeId] = addSpy.mock.calls[0]
    expect(dedupeId ?? null).toBeNull()           // 複製不帶固定 doc ID
    expect(payload.type).toBe('milestone')
    expect(payload.label).toBe('大同 場勘')
    expect(payload.caseIds).toEqual(['c1'])
    expect(payload.personNames).toEqual(['蚌'])
    expect(payload.startTime).toBe('09:00')
    expect(payload.createdBy).toBe('u-bo')
    expect(tsYMD(payload.date)).toBe('2026-09-20')
  })

  it('startPendingAction → pickTargetDate 會執行 move 並清掉 pendingAction', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    const spy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    wrapper.vm.startPendingAction('move', milestoneEvent())
    expect(wrapper.vm.pendingAction).not.toBeNull()
    await wrapper.vm.pickTargetDate('2026-09-15')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.pendingAction).toBeNull()
  })

  it('startPendingAction(copy) → pickTargetDate 會執行 copy', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new' })
    wrapper.vm.startPendingAction('copy', milestoneEvent())
    await wrapper.vm.pickTargetDate('2026-09-21')
    await flushPromises()
    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.pendingAction).toBeNull()
  })

  it('cancelPendingAction 清掉 pendingAction', async () => {
    const { wrapper } = await mountPlain()
    wrapper.vm.startPendingAction('move', milestoneEvent())
    wrapper.vm.cancelPendingAction()
    expect(wrapper.vm.pendingAction).toBeNull()
  })

  it('選日模式中 onCellClick 選到目標日、不開當天詳情', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    const spy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    wrapper.vm.startPendingAction('move', milestoneEvent())
    await wrapper.vm.onCellClick({ currentMonth: true, dateStr: '2026-09-15' })
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.showDayDetail).toBe(false)
  })

  it('非選日模式 onCellClick 照舊開當天詳情', async () => {
    const { wrapper } = await mountPlain()
    await wrapper.vm.onCellClick({ currentMonth: true, dateStr: '2026-09-15' })
    expect(wrapper.vm.showDayDetail).toBe(true)
  })

  it('onEventTap 對 milestone → 開小視窗；對 leave → 直接開編輯', async () => {
    const { wrapper } = await mountPlain()
    wrapper.vm.onEventTap(milestoneEvent(), '2026-09-10')
    expect(wrapper.vm.eventActionModal).not.toBeNull()
    wrapper.vm.eventActionModal = null

    const leave = { id: 'L1', type: 'leave', personName: '柏', leaveType: '事假', label: '柏 事假', date: { toDate: () => new Date('2026-09-10') } }
    wrapper.vm.onEventTap(leave, '2026-09-10')
    expect(wrapper.vm.eventActionModal).toBeNull()
    expect(wrapper.vm.showEditEvent).toBe(true)
  })

  it('onEventTap 在選日模式中 → 選那一天當目標，不開小視窗', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    const spy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    wrapper.vm.startPendingAction('move', milestoneEvent())
    wrapper.vm.onEventTap(milestoneEvent(), '2026-09-18')
    await flushPromises()
    expect(wrapper.vm.eventActionModal).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(tsYMD(spy.mock.calls[0][1].date)).toBe('2026-09-18')
  })

  it('onEventTap 對 _merged → 開當天詳情', async () => {
    const { wrapper } = await mountPlain()
    wrapper.vm.onEventTap({ ...milestoneEvent(), _merged: true }, '2026-09-10')
    expect(wrapper.vm.showDayDetail).toBe(true)
    expect(wrapper.vm.eventActionModal).toBeNull()
  })
})
