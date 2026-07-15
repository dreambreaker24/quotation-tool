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
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => 'ts'),
  Timestamp: { fromDate: vi.fn(d => ({ toDate: () => d })) },
  getDocs: vi.fn(),
}))

import { getDocs } from 'firebase/firestore'

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
