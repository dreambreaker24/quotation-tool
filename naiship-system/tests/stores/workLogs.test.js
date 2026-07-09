// naiship-system/tests/stores/workLogs.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useUsersStore } from '@/stores/users'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  getDoc: vi.fn(),
  doc: vi.fn((...args) => args.join('/')),
  serverTimestamp: vi.fn(() => 'ts'),
  Timestamp: { fromDate: vi.fn(d => d) },
  arrayUnion: vi.fn(v => v),
  increment: vi.fn(n => ({ __increment: n })),
  runTransaction: vi.fn(async (db, cb) => cb({ get: vi.fn(() => Promise.resolve({ data: () => ({ compClosedMonth: '2099-01' }) })), set: vi.fn(), update: vi.fn() })),
}))

describe('useWorkLogsStore.approveOvertimeItem', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('calls ensureMonthClosed for the log owner before applying the increment', async () => {
    const usersStore = useUsersStore()
    const spy = vi.spyOn(usersStore, 'ensureMonthClosed').mockResolvedValue()
    const workLogsStore = useWorkLogsStore()
    const log = { id: 'log1', userId: 'u1', overtimeItems: [{ hours: 2, type: '平日', approved: null }] }
    await workLogsStore.approveOvertimeItem(log, 0, true, '柏')
    expect(spy).toHaveBeenCalledWith('u1')
  })

  it('does not call ensureMonthClosed when rejecting (isApproved=false)', async () => {
    const usersStore = useUsersStore()
    const spy = vi.spyOn(usersStore, 'ensureMonthClosed').mockResolvedValue()
    const workLogsStore = useWorkLogsStore()
    const log = { id: 'log1', userId: 'u1', overtimeItems: [{ hours: 2, type: '平日', approved: null }] }
    await workLogsStore.approveOvertimeItem(log, 0, false, '柏')
    expect(spy).not.toHaveBeenCalled()
  })
})
