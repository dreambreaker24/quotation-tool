import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import CalendarTab from '@/components/cases/CalendarTab.vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useCalendarEventsStore } from '@/stores/calendarEvents'

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

describe('CalendarTab — 請假衝突偵測', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function mountWithManager() {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    usersStore.users = [
      { id: 'u-bang', name: '蚌', annualLeaveHours: 0 },
    ]
    vi.spyOn(eventsStore, 'fetchLeaveEventsByPerson').mockResolvedValue([
      {
        id: 'existing-1', type: 'leave', personName: '蚌', leaveType: '特休', hours: 24,
        date: { toDate: () => new Date('2026-08-24') },
        endDate: { toDate: () => new Date('2026-08-26') },
      },
    ])
    const wrapper = mount(CalendarTab, { props: { region: 'south' } })
    await flushPromises()
    return { wrapper, usersStore, eventsStore, authStore }
  }

  it('新增跟既有請假重疊的事假時，跳出衝突視窗而不是直接寫入', async () => {
    const { wrapper, eventsStore } = await mountWithManager()
    const addSpy = vi.spyOn(eventsStore, 'addEvent')

    await wrapper.vm.$nextTick()
    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = '2026-08-24'
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
    wrapper.vm.eventForm.date = '2026-09-01'
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
    wrapper.vm.eventForm.date = '2026-08-24'
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

  it('選擇「改用新增（事假）」時刪除原本衝突的那筆並寫入新的事假', async () => {
    const { wrapper, eventsStore } = await mountWithManager()
    const addSpy = vi.spyOn(eventsStore, 'addEvent').mockResolvedValue({ id: 'new-1' })
    const deleteSpy = vi.spyOn(eventsStore, 'deleteEvent').mockResolvedValue()
    const adjustSpy = vi.spyOn(useUsersStore(), 'adjustAnnualLeaveHours').mockResolvedValue()

    wrapper.vm.eventForm.type = 'leave'
    wrapper.vm.eventForm.date = '2026-08-24'
    wrapper.vm.eventForm.personName = '蚌'
    wrapper.vm.eventForm.hours = 8
    wrapper.vm.eventForm.leaveType = '事假'
    await wrapper.vm.submitEvent()
    await wrapper.vm.resolveConflict('personal')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('existing-1')
    expect(adjustSpy).toHaveBeenCalled() // 舊的特休24h要先退回
    expect(addSpy).toHaveBeenCalled()
    const addedPayload = addSpy.mock.calls[0][0]
    expect(addedPayload.leaveType).toBe('事假')
  })
})
