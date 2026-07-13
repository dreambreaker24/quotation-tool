// naiship-system/tests/stores/workLogs.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useUsersStore } from '@/stores/users'
import { getDocs } from 'firebase/firestore'

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

function fakeLog(overtimeItems) {
  return { data: () => ({ userName: 'test', date: { toDate: () => new Date('2026-07-05') }, overtimeItems }) }
}

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

describe('fetchApprovedOvertimeDetail', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('returns only approved weekday items when type is weekday', async () => {
    getDocs.mockResolvedValue({
      docs: [
        fakeLog([
          { type: '平日', hours: 3, reason: '趕工', approved: true },
          { type: '平日', hours: 2, reason: '未審', approved: null },
          { type: '休息日', hours: 4, reason: '假日支援', approved: true },
        ]),
      ],
    })
    const store = useWorkLogsStore()
    const result = await store.fetchApprovedOvertimeDetail('u1', 'weekday')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ hours: 3, reason: '趕工' })
  })

  it('returns only approved holiday items when type is holiday', async () => {
    getDocs.mockResolvedValue({
      docs: [
        fakeLog([
          { type: '平日', hours: 3, reason: '趕工', approved: true },
          { type: '休息日', hours: 4, reason: '假日支援', approved: true },
        ]),
      ],
    })
    const store = useWorkLogsStore()
    const result = await store.fetchApprovedOvertimeDetail('u1', 'holiday')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ hours: 4, reason: '假日支援' })
  })

  it('returns an empty array when nothing is approved', async () => {
    getDocs.mockResolvedValue({
      docs: [fakeLog([{ type: '平日', hours: 3, reason: '趕工', approved: false }])],
    })
    const store = useWorkLogsStore()
    const result = await store.fetchApprovedOvertimeDetail('u1', 'weekday')
    expect(result).toEqual([])
  })

  it('includes legacy-format items with no per-item approved field when overtimeApproved is true', async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            userName: 'test',
            date: { toDate: () => new Date('2026-07-05') },
            overtimeApproved: true,
            overtimeItems: [{ type: '平日', hours: 5, reason: '舊格式加班' }],
          }),
        },
      ],
    })
    const store = useWorkLogsStore()
    const result = await store.fetchApprovedOvertimeDetail('u1', 'weekday')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ hours: 5, reason: '舊格式加班' })
  })
})
