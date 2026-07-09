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
})
