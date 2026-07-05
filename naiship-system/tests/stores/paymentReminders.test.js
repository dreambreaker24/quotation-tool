import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
    deleteDoc: vi.fn(() => Promise.resolve()),
    setDoc: vi.fn(() => Promise.resolve()),
    serverTimestamp: vi.fn(() => 'ts'),
}))
vi.mock('@/stores/auth', () => ({
    useAuthStore: () => ({ user: { uid: 'user1' } })
}))

// 2026-06-30 08:00 Taipei = 2026-06-29 16:00 UTC
const MOCK_NOW = new Date('2026-06-29T16:00:00Z')

describe('usePaymentRemindersStore — vendorDisplayItems', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.setSystemTime(MOCK_NOW)
    })
    afterEach(() => vi.useRealTimers())

    it('is empty when no reminders', () => {
        const store = usePaymentRemindersStore()
        expect(store.vendorDisplayItems).toEqual([])
    })

    it('includes manual vendor items regardless of date', () => {
        const store = usePaymentRemindersStore()
        store.reminders = [
            { id: 'r1', type: 'vendor', source: 'manual', status: 'pending', dueDate: '2026-07-10', caseId: 'c1' }
        ]
        expect(store.vendorDisplayItems).toHaveLength(1)
        expect(store.vendorDisplayItems[0].id).toBe('r1')
    })

    it('includes auto vendor items that are overdue', () => {
        const store = usePaymentRemindersStore()
        store.reminders = [
            { id: 'r1', type: 'vendor', source: 'auto', status: 'pending', dueDate: '2026-05-01', caseId: 'c1' }
        ]
        expect(store.vendorDisplayItems).toHaveLength(1)
    })

    it('includes auto vendor items in current month', () => {
        const store = usePaymentRemindersStore()
        store.reminders = [
            { id: 'r1', type: 'vendor', source: 'auto', status: 'pending', dueDate: '2026-06-30', caseId: 'c1' }
        ]
        expect(store.vendorDisplayItems).toHaveLength(1)
    })

    it('includes auto vendor items in next month', () => {
        const store = usePaymentRemindersStore()
        store.reminders = [
            { id: 'r1', type: 'vendor', source: 'auto', status: 'pending', dueDate: '2026-07-31', caseId: 'c1' }
        ]
        expect(store.vendorDisplayItems).toHaveLength(1)
    })

    it('excludes auto vendor items beyond next month', () => {
        const store = usePaymentRemindersStore()
        store.reminders = [
            { id: 'r1', type: 'vendor', source: 'auto', status: 'pending', dueDate: '2026-08-01', caseId: 'c1' }
        ]
        expect(store.vendorDisplayItems).toHaveLength(0)
    })

    it('excludes owner type items', () => {
        const store = usePaymentRemindersStore()
        store.reminders = [
            { id: 'r1', type: 'owner', source: 'auto', status: 'pending', dueDate: '2026-07-10', caseId: 'c1' }
        ]
        expect(store.vendorDisplayItems).toHaveLength(0)
    })

    it('combines manual and auto vendor items', () => {
        const store = usePaymentRemindersStore()
        store.reminders = [
            { id: 'manual1', type: 'vendor', source: 'manual', status: 'pending', dueDate: '2026-07-05', caseId: 'c1' },
            { id: 'auto1',   type: 'vendor', source: 'auto',   status: 'pending', dueDate: '2026-06-28', caseId: 'c2' },
            { id: 'auto2',   type: 'vendor', source: 'auto',   status: 'pending', dueDate: '2026-08-15', caseId: 'c3' },
        ]
        const ids = store.vendorDisplayItems.map(r => r.id)
        expect(ids).toContain('manual1')
        expect(ids).toContain('auto1')
        expect(ids).not.toContain('auto2')
    })
})
