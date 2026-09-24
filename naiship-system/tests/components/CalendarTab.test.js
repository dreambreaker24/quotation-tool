import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import CalendarTab from '@/components/cases/CalendarTab.vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useCalendarEventsStore } from '@/stores/calendarEvents'
import { useCasesStore } from '@/stores/cases'
import { hoursToDays } from '@/utils/leaveConversion'
import { TAIWAN_HOLIDAY_NAMES } from '@/constants/holidays'
import { useToast } from '@/composables/useToast'

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

  it('onEventTap 對 milestone → 開案件狀況預覽；對 leave → 直接開編輯', async () => {
    const { wrapper } = await mountPlain()
    wrapper.vm.onEventTap(milestoneEvent(), '2026-09-10')
    expect(wrapper.vm.milestonePreview).not.toBeNull()
    wrapper.vm.milestonePreview = null

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

  it('openAddEventModal 會先取消進行中的 pendingAction', async () => {
    const { wrapper } = await mountPlain()
    wrapper.vm.startPendingAction('move', milestoneEvent())
    expect(wrapper.vm.pendingAction).not.toBeNull()
    wrapper.vm.openAddEventModal()
    expect(wrapper.vm.pendingAction).toBeNull()
    expect(wrapper.vm.showAddEvent).toBe(true)
  })

  it('Esc 鍵會取消進行中的 pendingAction', async () => {
    const { wrapper } = await mountPlain()
    wrapper.vm.startPendingAction('move', milestoneEvent())
    expect(wrapper.vm.pendingAction).not.toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.vm.pendingAction).toBeNull()
  })

  it('moveEvent 失敗時跳錯誤提示，不丟出例外', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    vi.spyOn(eventsStore, 'updateEvent').mockRejectedValue(new Error('boom'))
    await expect(wrapper.vm.moveEvent(milestoneEvent(), '2026-09-15')).resolves.toBe(false)
  })

  it('copyEvent 失敗時跳錯誤提示，不丟出例外', async () => {
    const { wrapper, eventsStore } = await mountPlain()
    vi.spyOn(eventsStore, 'addEvent').mockRejectedValue(new Error('boom'))
    await expect(wrapper.vm.copyEvent(milestoneEvent(), '2026-09-20')).resolves.toBe(null)
  })
})

describe('CalendarTab — 拖曳可拖曳判斷', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function mountAsManager() {
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    return { wrapper, authStore }
  }

  it('合併色塊（_merged）不可拖曳', async () => {
    const { wrapper } = await mountAsManager()
    const merged = { id: 'merged_x', type: 'milestone', _merged: true, date: { toDate: () => new Date(2026, 8, 10) } }
    expect(wrapper.vm.canDragEvent(merged, '2026-09-10')).toBe(false)
  })

  it('跨天事件只有起始日格子可拖曳', async () => {
    const { wrapper } = await mountAsManager()
    const event = { id: 'e1', type: 'note', label: '跨天', date: { toDate: () => new Date(2026, 8, 10) }, endDate: { toDate: () => new Date(2026, 8, 12) } }
    expect(wrapper.vm.canDragEvent(event, '2026-09-10')).toBe(true)
    expect(wrapper.vm.canDragEvent(event, '2026-09-11')).toBe(false)
    expect(wrapper.vm.canDragEvent(event, '2026-09-12')).toBe(false)
  })

  it('非本人非主管的請假事件不可拖曳', async () => {
    const authStore = useAuthStore()
    authStore.role = 'staff'
    authStore.name = '阿蚌'
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    const event = { id: 'e2', type: 'leave', personName: '柏', date: { toDate: () => new Date(2026, 8, 10) } }
    expect(wrapper.vm.canDragEvent(event, '2026-09-10')).toBe(false)
  })

  it('已透過薪資單折抵的請假事件不可拖曳', async () => {
    const { wrapper, authStore } = await mountAsManager()
    const event = { id: 'e3', type: 'leave', personName: authStore.name, leaveTypeLocked: true, date: { toDate: () => new Date(2026, 8, 10) } }
    expect(wrapper.vm.canDragEvent(event, '2026-09-10')).toBe(false)
  })

  it('重要記事/場勘施工/客戶跟進沒有權限限制，任何人可拖曳', async () => {
    const authStore = useAuthStore()
    authStore.role = 'staff'
    authStore.name = '阿蚌'
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    const event = { id: 'e4', type: 'followup', label: '跟進', date: { toDate: () => new Date(2026, 8, 10) } }
    expect(wrapper.vm.canDragEvent(event, '2026-09-10')).toBe(true)
  })
})

describe('CalendarTab — 拖放非請假事件', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useToast().toasts.value = []
  })

  async function mountAsManager() {
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    const eventsStore = useCalendarEventsStore()
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    return { wrapper, eventsStore }
  }

  it('直接拖放（move）呼叫 moveEvent 並在成功後顯示可復原的 toast', async () => {
    const { wrapper, eventsStore } = await mountAsManager()
    vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    const event = { id: 'note-1', type: 'note', label: '測試記事', companyId: 'south', date: { toDate: () => new Date(2026, 8, 10) } }

    wrapper.vm.dragState = { event, origDateStr: '2026-09-10', mode: 'move' }
    await wrapper.vm.onCellDrop({ dateStr: '2026-09-12' })
    await flushPromises()

    const [, payload] = eventsStore.updateEvent.mock.calls[0]
    expect(payload.date.toDate().getFullYear()).toBe(2026)
    expect(payload.date.toDate().getMonth()).toBe(8) // 9月，0-indexed
    expect(payload.date.toDate().getDate()).toBe(12)
    expect(payload.endDate).toBeNull()
    expect(wrapper.vm.dragState).toBeNull()
    const { toasts } = useToast()
    expect(toasts.value.at(-1)?.action?.label).toBe('復原')
  })

  it('按住 Ctrl 拖放（copy）呼叫 copyEvent 而不是 moveEvent', async () => {
    const { wrapper, eventsStore } = await mountAsManager()
    vi.spyOn(eventsStore, 'updateEvent')
    vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'note-copy-1' })
    const event = { id: 'note-2', type: 'note', label: '測試記事2', companyId: 'south', date: { toDate: () => new Date(2026, 8, 10) } }

    wrapper.vm.dragState = { event, origDateStr: '2026-09-10', mode: 'copy' }
    await wrapper.vm.onCellDrop({ dateStr: '2026-09-15' })
    await flushPromises()

    expect(eventsStore.addEvent).toHaveBeenCalled()
    expect(eventsStore.updateEvent).not.toHaveBeenCalled()
  })

  it('放到原本那一天不做任何事', async () => {
    const { wrapper, eventsStore } = await mountAsManager()
    vi.spyOn(eventsStore, 'updateEvent')
    const event = { id: 'note-3', type: 'note', label: '不變', companyId: 'south', date: { toDate: () => new Date(2026, 8, 10) } }

    wrapper.vm.dragState = { event, origDateStr: '2026-09-10', mode: 'move' }
    await wrapper.vm.onCellDrop({ dateStr: '2026-09-10' })
    await flushPromises()

    expect(eventsStore.updateEvent).not.toHaveBeenCalled()
  })
})

describe('CalendarTab — 拖放請假事件', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useToast().toasts.value = []
  })

  async function mountAsManager(existingEvents = []) {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u-bang', name: '蚌', annualLeaveHours: 0 }]
    vi.spyOn(eventsStore, 'fetchLeaveEventsByPerson').mockResolvedValue(existingEvents)
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    return { wrapper, eventsStore, authStore }
  }

  it('移動請假到週末會擋下，不寫入', async () => {
    const { wrapper, eventsStore } = await mountAsManager()
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent')
    const event = { id: 'leave-1', type: 'leave', personName: '蚌', leaveType: '事假', hours: 8, date: { toDate: () => new Date(SAFE_WEEKDAY) } }

    const d = new Date(SAFE_WEEKDAY)
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
    const saturday = fmtDate(d)

    wrapper.vm.dragState = { event, origDateStr: SAFE_WEEKDAY, mode: 'move' }
    await wrapper.vm.onCellDrop({ dateStr: saturday })
    await flushPromises()

    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('移動請假到有重疊的日期會開衝突視窗，不直接寫入', async () => {
    const existing = {
      id: 'existing-1', type: 'leave', personName: '蚌', leaveType: '特休', hours: 24,
      date: { toDate: () => new Date(NO_OVERLAP_DATE) },
      endDate: { toDate: () => new Date(NO_OVERLAP_DATE) },
    }
    const { wrapper, eventsStore } = await mountAsManager([existing])
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent')
    const event = { id: 'leave-2', type: 'leave', personName: '蚌', leaveType: '事假', hours: 8, date: { toDate: () => new Date(SAFE_WEEKDAY) } }

    wrapper.vm.dragState = { event, origDateStr: SAFE_WEEKDAY, mode: 'move' }
    await wrapper.vm.onCellDrop({ dateStr: NO_OVERLAP_DATE })
    await flushPromises()

    expect(updateSpy).not.toHaveBeenCalled()
    expect(wrapper.vm.conflictModal).not.toBeNull()
  })

  it('移動沒有衝突的請假：只更新日期，成功後有可復原的 toast', async () => {
    const { wrapper, eventsStore } = await mountAsManager()
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    const event = {
      id: 'leave-3', type: 'leave', personName: '蚌', leaveType: '事假', hours: 8,
      date: { toDate: () => new Date(SAFE_WEEKDAY) },
    }
    eventsStore.events = [event]

    wrapper.vm.dragState = { event, origDateStr: SAFE_WEEKDAY, mode: 'move' }
    await wrapper.vm.onCellDrop({ dateStr: NO_OVERLAP_DATE })
    await flushPromises()

    expect(updateSpy).toHaveBeenCalled()
    const payload = updateSpy.mock.calls[0][1]
    expect(payload.leaveType).toBe('事假')
    expect(payload.hours).toBe(8)
    const { toasts } = useToast()
    expect(toasts.value.at(-1)?.action?.label).toBe('復原')
  })

  it('複製請假事件會走新增流程並核銷餘額', async () => {
    const { wrapper, eventsStore, authStore } = await mountAsManager()
    const usersStore = useUsersStore()
    vi.spyOn(eventsStore, 'addEvent').mockResolvedValue()
    const adjustSpy = vi.spyOn(usersStore, 'adjustAnnualLeaveHours').mockResolvedValue()
    const event = { id: 'leave-4', type: 'leave', personName: authStore.name, leaveType: '特休', hours: 8, date: { toDate: () => new Date(SAFE_WEEKDAY) } }
    usersStore.users.push({ id: 'u-bo', name: authStore.name, annualLeaveHours: 999 })

    wrapper.vm.dragState = { event, origDateStr: SAFE_WEEKDAY, mode: 'copy' }
    await wrapper.vm.onCellDrop({ dateStr: NO_OVERLAP_DATE })
    await flushPromises()

    expect(eventsStore.addEvent).toHaveBeenCalled()
    expect(adjustSpy).toHaveBeenCalled()
  })

  it('複製請假的「復原」會呼叫 removeEvent 對應的歸還邏輯（deleteEvent 前一定先歸還餘額）', async () => {
    const { wrapper, eventsStore, authStore } = await mountAsManager()
    const usersStore = useUsersStore()
    let createdDoc = null
    vi.spyOn(eventsStore, 'addEvent').mockImplementation(async (payload, dedupeId) => {
      createdDoc = { id: dedupeId, ...payload }
      eventsStore.events = [createdDoc]
    })
    vi.spyOn(usersStore, 'adjustAnnualLeaveHours').mockResolvedValue()
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent').mockResolvedValue()
    usersStore.users.push({ id: 'u-bo', name: authStore.name, annualLeaveHours: 999 })
    const event = { id: 'leave-5', type: 'leave', personName: authStore.name, leaveType: '特休', hours: 8, date: { toDate: () => new Date(SAFE_WEEKDAY) } }

    wrapper.vm.dragState = { event, origDateStr: SAFE_WEEKDAY, mode: 'copy' }
    await wrapper.vm.onCellDrop({ dateStr: NO_OVERLAP_DATE })
    await flushPromises()

    const { toasts } = useToast()
    const undoToast = toasts.value.at(-1)
    expect(undoToast?.action?.label).toBe('復原')
    expect(createdDoc).not.toBeNull()

    await undoToast.action.onClick()
    await flushPromises()

    expect(usersStore.adjustAnnualLeaveHours).toHaveBeenCalledTimes(2)
    expect(deleteSpy).toHaveBeenCalledWith(createdDoc.id)
  })
})

describe('CalendarTab — 場勘/施工案件狀況預覽', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function mountWithCases() {
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    const casesStore = useCasesStore()
    casesStore.cases = [
      { id: 'case-1', name: '大同區辦公室', status: 'construction', assigneeName: '柏、其宏' },
    ]
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    return { wrapper, casesStore }
  }

  it('點場勘/施工事件開的是 milestonePreview 而不是 eventActionModal', async () => {
    const { wrapper } = await mountWithCases()
    const event = { id: 'ms-1', type: 'milestone', label: '大同區辦公室 木作進場', caseIds: ['case-1'], caseNames: ['大同區辦公室'], date: { toDate: () => new Date() } }

    wrapper.vm.onEventTap(event, '2026-09-14')

    expect(wrapper.vm.milestonePreview).toEqual(event)
    expect(wrapper.vm.eventActionModal).toBeNull()
  })

  it('點重要記事/客戶跟進仍然開 eventActionModal', async () => {
    const { wrapper } = await mountWithCases()
    const event = { id: 'note-1', type: 'note', label: '重要記事', date: { toDate: () => new Date() } }

    wrapper.vm.onEventTap(event, '2026-09-14')

    expect(wrapper.vm.eventActionModal).toEqual(event)
    expect(wrapper.vm.milestonePreview).toBeNull()
  })

  it('查看詳情會 emit jump-to-case 並帶正確的 caseId', async () => {
    const { wrapper } = await mountWithCases()
    const event = { id: 'ms-2', type: 'milestone', label: '大同區辦公室 木作進場', caseIds: ['case-1'], caseNames: ['大同區辦公室'], date: { toDate: () => new Date() } }
    wrapper.vm.milestonePreview = event
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-test="milestone-preview-case-detail"]').trigger('click')

    expect(wrapper.emitted('jump-to-case')).toBeTruthy()
    expect(wrapper.emitted('jump-to-case')[0]).toEqual(['case-1'])
  })

  it('沒有關聯案件時顯示「未關聯案件」', async () => {
    const { wrapper } = await mountWithCases()
    const event = { id: 'ms-3', type: 'milestone', label: '沒有案件的記事', caseIds: [], caseNames: [], date: { toDate: () => new Date() } }
    wrapper.vm.milestonePreview = event
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('未關聯案件')
  })
})

describe('CalendarTab — 月曆長條與色塊排版', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function ts(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return { toDate: () => date, toMillis: () => date.getTime() }
  }
  function ev(id, date, extra = {}) {
    return { id, type: 'milestone', date: ts(date), caseIds: ['case-dt'], caseNames: ['大同區辦公室'], ...extra }
  }

  async function mountMonth(events, month = 8) {
    const authStore = useAuthStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    const eventsStore = useCalendarEventsStore()
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    wrapper.vm.currentYear = 2026
    wrapper.vm.currentMonth = month
    await flushPromises()
    eventsStore.events = events
    await wrapper.vm.$nextTick()
    return wrapper
  }

  function weekOf(wrapper, dateStr) {
    return wrapper.vm.weekLayouts.find(w => w.cells.some(c => c.dateStr === dateStr))
  }
  function itemsOn(wrapper, dateStr) {
    const week = weekOf(wrapper, dateStr)
    const col = week.cells.findIndex(c => c.dateStr === dateStr)
    return week.items.filter(i => col >= i.colStart && col < i.colStart + i.colSpan)
  }

  it('同案場連續幾天的跨天事件、每日事件、單次事件合成一條長條，標題列出這段的項目', async () => {
    const wrapper = await mountMonth([
      ev('water', '2026-09-01', { endDate: ts('2026-09-04'), label: '大同區辦公室 水電進場' }),
      ev('mud1', '2026-09-02', { label: '大同區辦公室 泥作進場', startTime: '08:00' }),
      ev('mud2', '2026-09-03', { label: '大同區辦公室 泥作進場', startTime: '08:00' }),
      ev('clean', '2026-09-04', { label: '大同區辦公室 清運進場' }),
    ])
    const week = weekOf(wrapper, '2026-09-01')
    expect(week.items).toHaveLength(1)
    const lane = week.items[0]
    expect(lane.kind).toBe('bar')
    expect(lane.event._lane).toBe(true)
    expect([lane.colStart, lane.colSpan]).toEqual([1, 4])
    expect(lane.event.label).toBe('大同區辦公室：水電進場、泥作進場、清運進場')
  })

  it('同案場中間空一天就斷成兩段；只剩一天的變單格並顯示原本的事件', async () => {
    const wrapper = await mountMonth([
      ev('a', '2026-09-01', { endDate: ts('2026-09-02'), label: '大同區辦公室 水電進場' }),
      ev('b', '2026-09-04', { label: '大同區辦公室 對講機 維修', startTime: '10:00' }),
    ])
    const lane = itemsOn(wrapper, '2026-09-01')[0]
    expect(lane.event.id).toBe('a')
    expect(wrapper.vm.canDragEvent(lane.event, '2026-09-01')).toBe(true)
    const chip = itemsOn(wrapper, '2026-09-04')[0]
    expect(chip.kind).toBe('chip')
    expect(chip.event.id).toBe('b')
  })

  it('同一天同案場多筆單次事件維持合併成一個色塊', async () => {
    const wrapper = await mountMonth([
      ev('x', '2026-09-09', { label: '大同區辦公室 監視器廠勘', startTime: '15:00' }),
      ev('y', '2026-09-09', { label: '大同區辦公室 結案+場勘', startTime: '10:30' }),
    ])
    const items = itemsOn(wrapper, '2026-09-09')
    expect(items).toHaveLength(1)
    expect(items[0].event._merged).toBe(true)
  })

  it('單格補進該欄最上面的空位，不會因為別欄有兩條長條就空一格', async () => {
    const wrapper = await mountMonth([
      { id: 'leave', type: 'leave', label: 'Ramy 事假', date: ts('2026-10-05'), endDate: ts('2026-10-08') },
      { id: 'wood', type: 'note', label: '木工進場', date: ts('2026-10-05'), endDate: ts('2026-10-06') },
      { id: 'chip', type: 'note', label: '水電', date: ts('2026-10-07'), startTime: '08:00' },
      { id: 'chip2', type: 'note', label: '業主', date: ts('2026-10-13'), startTime: '08:00' },
      { id: 'leave2', type: 'leave', label: 'Ramy 事假', date: ts('2026-10-12'), endDate: ts('2026-10-12') },
    ], 9)
    expect(itemsOn(wrapper, '2026-10-07').find(i => i.event.id === 'chip').row).toBe(1)
    expect(itemsOn(wrapper, '2026-10-13').find(i => i.event.id === 'chip2').row).toBe(0)
  })

  it('請假長條週末斷開，週末也不會冒出單格色塊', async () => {
    const wrapper = await mountMonth([
      { id: 'leave', type: 'leave', label: 'Ramy 事假 56h', date: ts('2026-10-01'), endDate: ts('2026-10-12') },
    ])
    expect(itemsOn(wrapper, '2026-10-03')).toEqual([])
    expect(itemsOn(wrapper, '2026-10-04')).toEqual([])
    expect(itemsOn(wrapper, '2026-10-02')[0].event.id).toBe('leave')
  })

  it('不屬於案場的每日相同事件仍會接成一條長條', async () => {
    const wrapper = await mountMonth(['2026-09-14', '2026-09-15', '2026-09-16'].map((d, i) =>
      ({ id: `n${i}`, type: 'note', label: '早會', date: ts(d), startTime: '09:00' })))
    const items = weekOf(wrapper, '2026-09-14').items
    expect(items).toHaveLength(1)
    expect(items[0].event._chain).toBe(true)
  })

  it('同一個人跨天的補休＋事假合成一條，標題列出假別與時數', async () => {
    const wrapper = await mountMonth([
      { id: 'comp', type: 'leave', personName: '蚌', leaveType: '補休', hours: 15.5, label: '蚌 補休 15.5h', date: ts('2026-09-23'), endDate: ts('2026-09-24'), startTime: '09:00', endTime: '17:30' },
      { id: 'personal', type: 'leave', personName: '蚌', leaveType: '事假', hours: 0.5, label: '蚌 事假 0.5h', date: ts('2026-09-24'), startTime: '17:30', endTime: '18:00' },
      { id: 'ramy', type: 'leave', personName: 'Ramy', leaveType: '補休', hours: 3.5, label: 'Ramy 補休 3.5h', date: ts('2026-09-24'), startTime: '14:30', endTime: '18:00' },
    ])
    const onDay24 = itemsOn(wrapper, '2026-09-24')
    const bang = onDay24.filter(i => i.event.personName === '蚌')
    expect(bang).toHaveLength(1)
    expect(bang[0].event._lane).toBe(true)
    expect([bang[0].colStart, bang[0].colSpan]).toEqual([2, 2])
    expect(bang[0].event.label).toBe('蚌：補休 15.5h、事假 0.5h')
    expect(onDay24.find(i => i.event.id === 'ramy').kind).toBe('chip')
  })

  it('同一個人同一天兩筆假合成一個色塊', async () => {
    const wrapper = await mountMonth([
      { id: 'a', type: 'leave', personName: 'Ramy', leaveType: '補休', hours: 3.5, date: ts('2026-09-17'), startTime: '09:00', endTime: '12:30' },
      { id: 'b', type: 'leave', personName: 'Ramy', leaveType: '事假', hours: 1, date: ts('2026-09-17'), startTime: '17:00', endTime: '18:00' },
    ])
    const items = itemsOn(wrapper, '2026-09-17')
    expect(items).toHaveLength(1)
    expect(items[0].event._merged).toBe(true)
    expect(items[0].event.label).toBe('Ramy：補休 3.5h、事假 1h')
  })

  it('同一個人週五跟下週一請假：週末不顯示，切開後各剩一天一筆就照單筆顯示', async () => {
    const wrapper = await mountMonth([
      { id: 'fri', type: 'leave', personName: '蚌', leaveType: '特休', hours: 8, date: ts('2026-10-02') },
      { id: 'mon', type: 'leave', personName: '蚌', leaveType: '事假', hours: 8, date: ts('2026-10-05') },
    ], 9)
    expect(itemsOn(wrapper, '2026-10-03')).toEqual([])
    // 週末切開後兩邊各只剩一天一筆，照單筆顯示（可以直接點開那一筆）
    const fri = itemsOn(wrapper, '2026-10-02')[0]
    const mon = itemsOn(wrapper, '2026-10-05')[0]
    expect([fri.kind, fri.event.id]).toEqual(['chip', 'fri'])
    expect([mon.kind, mon.event.id]).toEqual(['chip', 'mon'])
  })

  it('合併長條與串接長條都不可拖曳', async () => {
    const wrapper = await mountMonth([])
    expect(wrapper.vm.canDragEvent({ id: 'case_x', type: 'milestone', _lane: true, date: ts('2026-09-02') }, '2026-09-02')).toBe(false)
    expect(wrapper.vm.canDragEvent({ id: 'chain_x', type: 'note', _chain: true, date: ts('2026-09-02') }, '2026-09-02')).toBe(false)
  })

  it('不同案場用不同顏色，同案場顏色固定', async () => {
    const casesStore = useCasesStore()
    casesStore.cases = [
      { id: 'case-dt', name: '大同區辦公室', createdAt: ts('2026-08-01') },
      { id: 'case-yr', name: '鈺潤軒', createdAt: ts('2026-08-02') },
    ]
    const wrapper = await mountMonth([
      ev('a', '2026-09-02', { label: '大同區辦公室 泥作進場' }),
      ev('b', '2026-09-02', { label: '鈺潤軒 玻璃清潔', caseIds: ['case-yr'], caseNames: ['鈺潤軒'] }),
    ])
    const [dt, yr] = ['case-dt', 'case-yr'].map(id => wrapper.vm.itemColor({ type: 'milestone', caseIds: [id] }))
    expect(dt).not.toBe(yr)
    expect(wrapper.vm.monthCaseLegend.map(c => c.name)).toEqual(['大同區辦公室', '鈺潤軒'])
  })
})

describe('CalendarTab — 補休不足自動拆成事假', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useToast().toasts.value = []
  })

  async function setup({ ledger = [], existing = [] } = {}) {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [{ id: 'u-bang', name: '蚌', annualLeaveHours: 0 }]
    vi.spyOn(eventsStore, 'fetchLeaveEventsByPerson').mockResolvedValue(existing)
    // 模擬帳會跟著退回/扣除變動，比照正式環境每次重新讀資料庫
    vi.spyOn(usersStore, 'fetchCompLedger').mockImplementation(async () => ledger.map(e => ({ ...e })))
    const applyLedgerSpy = vi.spyOn(usersStore, 'applyLedgerConsumption').mockImplementation(async (uid, deltas) => {
      for (const d of deltas) ledger.find(e => e.id === d.id).remainingHours += d.delta
    })
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'x' })
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    return { wrapper, applyLedgerSpy, addSpy, updateSpy }
  }

  function ledgerOf(hours) {
    return [{ id: 'e1', type: '平日', hours, remainingHours: hours, createdAt: { toMillis: () => 1 } }]
  }

  function fillAdd(wrapper) {
    Object.assign(wrapper.vm.eventForm, {
      type: 'leave', date: SAFE_WEEKDAY, endDate: '', personName: '蚌', leaveType: '補休',
      startTime: '09:00', endTime: '18:00', hours: 8,
    })
  }

  it('補休 5.5h 申請 8h：跳出確認，同意後寫入補休 5.5h + 事假 2.5h 兩筆，時間切在 15:30', async () => {
    const { wrapper, applyLedgerSpy, addSpy } = await setup({ ledger: ledgerOf(5.5) })
    fillAdd(wrapper)
    const pending = wrapper.vm.submitEvent()
    await flushPromises()
    expect(wrapper.vm.compSplitPrompt).toMatchObject({ balance: 5.5, total: 8, compHours: 5.5, personalHours: 2.5 })
    wrapper.vm.answerCompSplit(true)
    await pending
    await flushPromises()

    expect(addSpy).toHaveBeenCalledTimes(2)
    const [comp, compId] = addSpy.mock.calls[0]
    const [personal, personalId] = addSpy.mock.calls[1]
    expect(comp).toMatchObject({ leaveType: '補休', hours: 5.5, startTime: '09:00', endTime: '15:30', label: '蚌 補休 5.5h', splitGroupId: compId })
    expect(comp.compConsumption).toEqual([{ id: 'e1', hours: 5.5 }])
    expect(personal).toMatchObject({ leaveType: '事假', hours: 2.5, startTime: '15:30', endTime: '18:00', label: '蚌 事假 2.5h', splitGroupId: compId })
    expect(personal.compConsumption).toBeUndefined()
    expect(personalId).not.toBe(compId)
    expect(applyLedgerSpy).toHaveBeenCalledWith('u-bang', [{ id: 'e1', delta: -5.5 }])
    expect(wrapper.vm.lastLeaveWriteIds).toEqual([compId, personalId])
  })

  it('從「請假重疊」視窗選改用補休：補休不足時一樣跳確認，同意後寫入兩筆再刪掉舊的那筆', async () => {
    const old = {
      id: 'old-personal', type: 'leave', personName: '蚌', leaveType: '事假', hours: 8,
      date: { toDate: () => new Date(SAFE_WEEKDAY) }, startTime: '09:00', endTime: '18:00',
    }
    const { wrapper, addSpy } = await setup({ ledger: ledgerOf(5.5), existing: [old] })
    const deleteSpy = vi.spyOn(useCalendarEventsStore(), 'deleteEvent').mockResolvedValue()
    fillAdd(wrapper)
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await flushPromises()
    expect(wrapper.vm.conflictModal).not.toBeNull()
    const pending = wrapper.vm.resolveConflict('comp')
    await flushPromises()
    expect(wrapper.vm.compSplitPrompt).toMatchObject({ compHours: 5.5, personalHours: 2.5 })
    wrapper.vm.answerCompSplit(true)
    await pending
    await flushPromises()
    expect(addSpy).toHaveBeenCalledTimes(2)
    expect(deleteSpy).toHaveBeenCalledWith('old-personal')
    expect(wrapper.vm.conflictModal).toBeNull()
  })

  it('確認視窗按取消：什麼都不寫入、補休不扣', async () => {
    const { wrapper, applyLedgerSpy, addSpy } = await setup({ ledger: ledgerOf(5.5) })
    fillAdd(wrapper)
    const pending = wrapper.vm.submitEvent()
    await flushPromises()
    wrapper.vm.answerCompSplit(false)
    expect(await pending).toBe(false)
    expect(addSpy).not.toHaveBeenCalled()
    expect(applyLedgerSpy).not.toHaveBeenCalled()
  })

  it('完全沒有補休：維持原本整筆擋下，不跳確認', async () => {
    const { wrapper, addSpy } = await setup({ ledger: [] })
    fillAdd(wrapper)
    expect(await wrapper.vm.submitEvent()).toBe(false)
    expect(wrapper.vm.compSplitPrompt).toBeNull()
    expect(addSpy).not.toHaveBeenCalled()
    expect(useToast().toasts.value.at(-1)?.message).toBe('補休時數不足')
  })

  it('補休只剩 0.25h（不足半小時）：視同沒有，整筆擋下', async () => {
    const { wrapper, addSpy } = await setup({ ledger: ledgerOf(0.25) })
    fillAdd(wrapper)
    expect(await wrapper.vm.submitEvent()).toBe(false)
    expect(wrapper.vm.compSplitPrompt).toBeNull()
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('補休有零頭 5.75h：補休取 5.5h，其餘 2.5h 事假', async () => {
    const { wrapper } = await setup({ ledger: ledgerOf(5.75) })
    fillAdd(wrapper)
    const pending = wrapper.vm.submitEvent()
    await flushPromises()
    expect(wrapper.vm.compSplitPrompt).toMatchObject({ balance: 5.75, compHours: 5.5, personalHours: 2.5 })
    wrapper.vm.answerCompSplit(false)
    await pending
  })

  it('手填時數跟時段對不上：不自動拆，擋下並說明原因', async () => {
    const { wrapper, addSpy } = await setup({ ledger: ledgerOf(5.5) })
    fillAdd(wrapper)
    await flushPromises()
    wrapper.vm.eventForm.hours = 7
    expect(await wrapper.vm.submitEvent()).toBe(false)
    expect(wrapper.vm.compSplitPrompt).toBeNull()
    expect(addSpy).not.toHaveBeenCalled()
    expect(useToast().toasts.value.at(-1)?.message).toContain('對不上')
  })

  function existingComp(hours, endTime) {
    return {
      id: 'comp-1', type: 'leave', companyId: 'south', personName: '蚌', leaveType: '補休', hours,
      date: { toDate: () => new Date(SAFE_WEEKDAY) }, startTime: '09:00', endTime,
      compConsumption: [{ id: 'e1', hours }],
    }
  }

  it('編輯：原本補休 4h 改成 8h，退回後可用 6h → 拆成補休 6h（更新原筆）+ 事假 2h（新增）', async () => {
    const ledger = [{ id: 'e1', type: '平日', hours: 10, remainingHours: 2, createdAt: { toMillis: () => 1 } }]
    const { wrapper, applyLedgerSpy, addSpy, updateSpy } = await setup({ ledger })
    wrapper.vm.populateEditForm(existingComp(4, '13:00'))
    Object.assign(wrapper.vm.editForm, { endTime: '18:00', hours: 8 })
    const pending = wrapper.vm.saveEditEvent()
    await flushPromises()
    expect(wrapper.vm.compSplitPrompt).toMatchObject({ balance: 6, compHours: 6, personalHours: 2 })
    wrapper.vm.answerCompSplit(true)
    await pending
    await flushPromises()

    const [id, compPayload] = updateSpy.mock.calls[0]
    expect(id).toBe('comp-1')
    expect(compPayload).toMatchObject({ leaveType: '補休', hours: 6, startTime: '09:00', endTime: '16:00', endDate: null, splitGroupId: 'comp-1' })
    const [personal] = addSpy.mock.calls[0]
    expect(personal).toMatchObject({ companyId: 'south', type: 'leave', leaveType: '事假', hours: 2, startTime: '16:00', endTime: '18:00', splitGroupId: 'comp-1' })
    // 先退回原本 4h，再扣 6h
    expect(applyLedgerSpy.mock.calls.map(c => c[1])).toEqual([[{ id: 'e1', delta: 4 }], [{ id: 'e1', delta: -6 }]])
  })

  it('編輯：補休不足時按取消，補休帳完全不動（原本會先退回卻沒扣回）', async () => {
    const ledger = [{ id: 'e1', type: '平日', hours: 10, remainingHours: 2, createdAt: { toMillis: () => 1 } }]
    const { wrapper, applyLedgerSpy, updateSpy } = await setup({ ledger })
    wrapper.vm.populateEditForm(existingComp(4, '13:00'))
    Object.assign(wrapper.vm.editForm, { endTime: '18:00', hours: 8 })
    const pending = wrapper.vm.saveEditEvent()
    await flushPromises()
    wrapper.vm.answerCompSplit(false)
    expect(await pending).toBe(false)
    expect(applyLedgerSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('編輯拆單產生的其中一筆時，同組的另一筆不算重疊衝突', async () => {
    const sibling = {
      id: 'personal-1', type: 'leave', personName: '蚌', leaveType: '事假', hours: 2, splitGroupId: 'comp-1',
      date: { toDate: () => new Date(SAFE_WEEKDAY) }, startTime: '16:00', endTime: '18:00',
    }
    const { wrapper } = await setup({ existing: [sibling] })
    expect(await wrapper.vm.checkLeaveConflict('蚌', SAFE_WEEKDAY, '', 'comp-1', 'comp-1')).toEqual([])
    expect(await wrapper.vm.checkLeaveConflict('蚌', SAFE_WEEKDAY, '', 'comp-1', '')).toHaveLength(1)
  })
})
