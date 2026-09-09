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
  Timestamp: { fromDate: vi.fn(d => d), now: vi.fn(() => ({ toDate: () => new Date() })) },
  arrayUnion: vi.fn(v => v),
  increment: vi.fn(n => ({ __increment: n })),
}))

describe('useWorkLogsStore.approveOvertimeItem', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('查底薪寫入compLedger分錄', async () => {
    const usersStore = useUsersStore()
    vi.spyOn(usersStore, 'getUser').mockResolvedValue({ id: 'u1', salary: 36000, hireDate: '2020-01-01' })
    const addLedgerSpy = vi.spyOn(usersStore, 'addLedgerEntry').mockResolvedValue('entry-1')
    const workLogsStore = useWorkLogsStore()
    const log = { id: 'log1', userId: 'u1', overtimeItems: [{ hours: 2, type: '平日', approved: null }] }
    await workLogsStore.approveOvertimeItem(log, 0, true, '柏')
    expect(addLedgerSpy).toHaveBeenCalledTimes(1)
    expect(addLedgerSpy).toHaveBeenCalledWith('u1', expect.objectContaining({ type: '平日', hours: 2 }))
  })
})

describe('fetchMonthlyKm', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('加總浮點數誤差組合後回傳乾淨的數字，不帶誤差尾巴', async () => {
        getDocs.mockResolvedValue({
            docs: [
                { data: () => ({ userName: '昆霖', fuelExpenses: [{ distance: 21.7 }] }) },
                { data: () => ({ userName: '昆霖', fuelExpenses: [{ distance: 134.1 }] }) },
            ],
        })
        const store = useWorkLogsStore()
        const result = await store.fetchMonthlyKm(2026, 7)
        expect(result['昆霖']).toBe(155.8)
    })

    it('未核准的油資紀錄不列入加總', async () => {
        getDocs.mockResolvedValue({
            docs: [
                { data: () => ({ userName: '蚌', fuelApproved: false, fuelExpenses: [{ distance: 50 }] }) },
            ],
        })
        const store = useWorkLogsStore()
        const result = await store.fetchMonthlyKm(2026, 7)
        expect(result['蚌']).toBeUndefined()
    })

    it('正常整數輸入不受四捨五入影響', async () => {
        getDocs.mockResolvedValue({
            docs: [
                { data: () => ({ userName: 'Ramy', fuelExpenses: [{ distance: 12 }, { distance: 8 }] }) },
            ],
        })
        const store = useWorkLogsStore()
        const result = await store.fetchMonthlyKm(2026, 7)
        expect(result['Ramy']).toBe(20)
    })
})

describe('findLogForUserDate / createProxyLog', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('findLogForUserDate returns null when no log exists for that user/date', async () => {
        getDocs.mockResolvedValue({ empty: true, docs: [] })
        const store = useWorkLogsStore()
        const result = await store.findLogForUserDate('u1', new Date('2026-07-10'))
        expect(result).toBeNull()
    })

    it('findLogForUserDate returns the existing log when found', async () => {
        getDocs.mockResolvedValue({
            empty: false,
            docs: [{ id: 'log1', data: () => ({ userId: 'u1', date: { toDate: () => new Date('2026-07-10') } }) }],
        })
        const store = useWorkLogsStore()
        const result = await store.findLogForUserDate('u1', new Date('2026-07-10'))
        expect(result).toMatchObject({ id: 'log1', userId: 'u1' })
    })

    it('createProxyLog creates a minimal log document for the target user', async () => {
        const { addDoc } = await import('firebase/firestore')
        const store = useWorkLogsStore()
        await store.createProxyLog('u2', '昆霖', 'south', new Date('2026-07-10'))
        expect(addDoc).toHaveBeenCalledTimes(1)
        const [, data] = addDoc.mock.calls[0]
        expect(data).toMatchObject({ userId: 'u2', userName: '昆霖', companyId: 'south' })
    })
})

describe('approveOvertimeItem — 改寫入compLedger', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('首次核准平日加班項目時，查底薪算value並呼叫addLedgerEntry寫入分錄', async () => {
        const store = useWorkLogsStore()
        const usersStore = useUsersStore()
        vi.spyOn(usersStore, 'getUser').mockResolvedValue({ id: 'u1', salary: 36000, hireDate: '2020-01-01' })
        const addLedgerSpy = vi.spyOn(usersStore, 'addLedgerEntry').mockResolvedValue('entry-1')

        const log = {
            id: 'log1', userId: 'u1',
            overtimeItems: [{ type: '平日', hours: 3, approved: null }],
        }
        await store.approveOvertimeItem(log, 0, true, '柏')

        expect(addLedgerSpy).toHaveBeenCalledTimes(1)
        const [uid, entry] = addLedgerSpy.mock.calls[0]
        expect(uid).toBe('u1')
        expect(entry.type).toBe('平日')
        expect(entry.hours).toBe(3)
        expect(entry.value).toBe(650) // 底薪36000：2h*150*4/3=400 + 1h*150*5/3=250 = 650
        expect(entry.sourceLogId).toBe('log1')
        expect(entry.source).toBe('overtime')
    })

    it('休息日加班項目type正確寫入', async () => {
        const store = useWorkLogsStore()
        const usersStore = useUsersStore()
        vi.spyOn(usersStore, 'getUser').mockResolvedValue({ id: 'u1', salary: 36000, hireDate: '2020-01-01' })
        const addLedgerSpy = vi.spyOn(usersStore, 'addLedgerEntry').mockResolvedValue('entry-1')

        const log = { id: 'log1', userId: 'u1', overtimeItems: [{ type: '休息日', hours: 2, approved: null }] }
        await store.approveOvertimeItem(log, 0, true, '柏')

        expect(addLedgerSpy.mock.calls[0][1].type).toBe('休息日')
    })

    it('駁回（isApproved=false）不寫入分錄', async () => {
        const store = useWorkLogsStore()
        const usersStore = useUsersStore()
        const addLedgerSpy = vi.spyOn(usersStore, 'addLedgerEntry')

        const log = { id: 'log1', userId: 'u1', overtimeItems: [{ type: '平日', hours: 3, approved: null }] }
        await store.approveOvertimeItem(log, 0, false, '柏')

        expect(addLedgerSpy).not.toHaveBeenCalled()
    })

    it('已經核准過的項目（approved已經是true/false）再次呼叫不會重複寫入分錄', async () => {
        const store = useWorkLogsStore()
        const usersStore = useUsersStore()
        const addLedgerSpy = vi.spyOn(usersStore, 'addLedgerEntry')

        const log = { id: 'log1', userId: 'u1', overtimeItems: [{ type: '平日', hours: 3, approved: true }] }
        await store.approveOvertimeItem(log, 0, true, '柏')

        expect(addLedgerSpy).not.toHaveBeenCalled()
    })

    it('getUser查不到使用者時不寫入分錄，並印出警告', async () => {
        const store = useWorkLogsStore()
        const usersStore = useUsersStore()
        vi.spyOn(usersStore, 'getUser').mockResolvedValue(null)
        const addLedgerSpy = vi.spyOn(usersStore, 'addLedgerEntry')
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const log = { id: 'log1', userId: 'u1', overtimeItems: [{ type: '平日', hours: 3, approved: null }] }
        await store.approveOvertimeItem(log, 0, true, '柏')

        expect(addLedgerSpy).not.toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
    })

    it('使用者沒有到職日時，分錄expireDate為null，並印出警告', async () => {
        const store = useWorkLogsStore()
        const usersStore = useUsersStore()
        vi.spyOn(usersStore, 'getUser').mockResolvedValue({ id: 'u1', salary: 36000, hireDate: null })
        const addLedgerSpy = vi.spyOn(usersStore, 'addLedgerEntry').mockResolvedValue('entry-1')
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const log = { id: 'log1', userId: 'u1', overtimeItems: [{ type: '平日', hours: 3, approved: null }] }
        await store.approveOvertimeItem(log, 0, true, '柏')

        expect(addLedgerSpy.mock.calls[0][1].expireDate).toBeNull()
        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
    })
})
