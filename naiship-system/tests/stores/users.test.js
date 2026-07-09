import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUsersStore, monthStr, prevMonthStr } from '@/stores/users'

const txGet = vi.fn()
const txSet = vi.fn()
const txUpdate = vi.fn()

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
  updateDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(),
  doc: vi.fn((...args) => args.join('/')),
  increment: vi.fn(n => ({ __increment: n })),
  serverTimestamp: vi.fn(() => 'ts'),
  runTransaction: vi.fn(async (db, cb) => cb({ get: txGet, set: txSet, update: txUpdate })),
}))

describe('month helpers', () => {
  // 統一用「台北時間中午」建構測試日期，避免測試機器時區不同造成跨日誤判
  it('monthStr formats year-month with zero padding', () => {
    expect(monthStr(new Date('2026-07-09T04:00:00Z'))).toBe('2026-07') // 台北 7/9 中午
    expect(monthStr(new Date('2026-01-01T04:00:00Z'))).toBe('2026-01') // 台北 1/1 中午
  })

  it('prevMonthStr returns the month before, crossing year boundary', () => {
    expect(prevMonthStr(new Date('2026-08-01T04:00:00Z'))).toBe('2026-07') // 台北 8/1 中午
    expect(prevMonthStr(new Date('2026-01-15T04:00:00Z'))).toBe('2025-12') // 台北 1/15 中午
  })
})

describe('useUsersStore', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('store still exposes users list', () => {
    const store = useUsersStore()
    expect(store.users).toEqual([])
  })

  describe('useUsersStore.ensureMonthClosed', () => {
    beforeEach(() => {
      setActivePinia(createPinia())
      txGet.mockReset(); txSet.mockReset(); txUpdate.mockReset()
    })

    // 統一用「台北時間中午」建構測試日期，避免測試機器時區不同造成跨日誤判
    it('first call with no compClosedMonth only sets the baseline, no snapshot taken', async () => {
      txGet.mockResolvedValue({ data: () => ({}) })
      const store = useUsersStore()
      await store.ensureMonthClosed('u1', new Date('2026-07-09T04:00:00Z')) // 台北 7/9
      expect(txSet).toHaveBeenCalledWith(expect.anything(), { compClosedMonth: '2026-06' }, { merge: true })
      expect(txUpdate).not.toHaveBeenCalled()
    })

    it('handles a missing user document on first call without throwing', async () => {
      txGet.mockResolvedValue({ data: () => undefined })
      const store = useUsersStore()
      await expect(store.ensureMonthClosed('u1', new Date('2026-07-09T04:00:00Z'))).resolves.not.toThrow()
      expect(txSet).toHaveBeenCalledWith(expect.anything(), { compClosedMonth: '2026-06' }, { merge: true })
      expect(txUpdate).not.toHaveBeenCalled()
    })

    it('does nothing when already closed through last month', async () => {
      txGet.mockResolvedValue({ data: () => ({ compClosedMonth: '2026-06', compensatoryHours: 5 }) })
      const store = useUsersStore()
      await store.ensureMonthClosed('u1', new Date('2026-07-09T04:00:00Z')) // prevMonth = '2026-06'，已經結過
      expect(txSet).not.toHaveBeenCalled()
      expect(txUpdate).not.toHaveBeenCalled()
    })

    it('closes last month: snapshots current balance and zeroes it out', async () => {
      txGet.mockResolvedValue({ data: () => ({ compClosedMonth: '2026-06', compensatoryHours: 12, compensatoryHolidayHours: 4 }) })
      const store = useUsersStore()
      await store.ensureMonthClosed('u1', new Date('2026-08-01T04:00:00Z')) // 台北 8/1，prevMonth = '2026-07'
      expect(txSet).toHaveBeenCalledWith(expect.anything(), { weekdayHours: 12, holidayHours: 4, closedAt: 'ts' })
      expect(txUpdate).toHaveBeenCalledWith(expect.anything(), {
        compensatoryHours: 0,
        compensatoryHolidayHours: 0,
        compClosedMonth: '2026-07',
      })
    })

    it('treats missing balance fields as zero', async () => {
      txGet.mockResolvedValue({ data: () => ({ compClosedMonth: '2026-06' }) })
      const store = useUsersStore()
      await store.ensureMonthClosed('u1', new Date('2026-08-01T04:00:00Z'))
      expect(txSet).toHaveBeenCalledWith(expect.anything(), { weekdayHours: 0, holidayHours: 0, closedAt: 'ts' })
    })
  })
})
