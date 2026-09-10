// naiship-system/tests/stores/calendarEvents.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCalendarEventsStore } from '@/stores/calendarEvents'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn((db, coll, id) => ({ __path: `${coll}/${id}` })),
  serverTimestamp: vi.fn(() => 'ts'),
  Timestamp: { fromDate: vi.fn(d => ({ toDate: () => d })) },
  getDocs: vi.fn(),
}))

import { getDocs } from 'firebase/firestore'
import { addDoc, setDoc, doc } from 'firebase/firestore'

function fakeDoc(data) {
  return { data: () => data }
}

describe('useCalendarEventsStore.fetchMonthlyLeaveDetail', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('returns only leave-type events for the given person', async () => {
    getDocs.mockResolvedValue({
      docs: [
        fakeDoc({ type: 'leave', personName: '蚌', leaveType: '事假', hours: 8, date: { toDate: () => new Date('2026-07-03') } }),
        fakeDoc({ type: 'leave', personName: '賴賴', leaveType: '病假', hours: 4, date: { toDate: () => new Date('2026-07-05') } }),
        fakeDoc({ type: 'milestone', personName: '蚌', date: { toDate: () => new Date('2026-07-06') } }),
      ]
    })
    const store = useCalendarEventsStore()
    const result = await store.fetchMonthlyLeaveDetail(2026, 6, '蚌')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ leaveType: '事假', hours: 8 })
  })

  it('returns an empty array when nobody matches', async () => {
    getDocs.mockResolvedValue({ docs: [] })
    const store = useCalendarEventsStore()
    const result = await store.fetchMonthlyLeaveDetail(2026, 6, '蚌')
    expect(result).toEqual([])
  })
})

describe('useCalendarEventsStore.addEvent', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('無 dedupeId 時用 addDoc（自動 ID）', async () => {
    const store = useCalendarEventsStore()
    await store.addEvent({ type: 'note', label: 'x' })
    expect(addDoc).toHaveBeenCalledTimes(1)
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('有 dedupeId 時用 setDoc 寫到 calendarEvents/<dedupeId>', async () => {
    const store = useCalendarEventsStore()
    await store.addEvent({ type: 'leave', personName: '蚌' }, 'leave-south-蚌-20261015-single-事假-0900')
    expect(setDoc).toHaveBeenCalledTimes(1)
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'calendarEvents', 'leave-south-蚌-20261015-single-事假-0900')
    expect(addDoc).not.toHaveBeenCalled()
  })
})
