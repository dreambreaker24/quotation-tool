// naiship-system/tests/stores/pettyCash.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePettyCashStore } from '@/stores/pettyCash'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
    onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'e1' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn((...args) => args.join('/')),
    serverTimestamp: vi.fn(() => 'ts'),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => undefined })),
    setDoc: vi.fn(() => Promise.resolve()),
}))

describe('pettyCash store — benBalance（柏零用金）', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('柏零用金 = 補款 - 發放給蚌 - 發放給賴賴 - 柏自己的支出 + 蚌賴賴歸還', () => {
        const store = usePettyCashStore()
        store.entries = [
            { type: 'topup', amount: 100000 },
            { type: 'distribute', payerName: '蚌', amount: 30000 },
            { type: 'distribute', payerName: '賴賴', amount: 10000 },
            { type: 'expense', payerName: '柏', amount: 5000 },
            { type: 'expense', payerName: '蚌', amount: 8000 },
            { type: 'return', payerName: '蚌', amount: 2000 },
        ]
        // 100000 - 30000 - 10000 - 5000 + 2000 = 57000
        expect(store.benBalance).toBe(57000)
    })

    it('柏零用金（＝總零用金）用實際生產資料驗算', () => {
        const store = usePettyCashStore()
        store.entries = [
            { type: 'topup', amount: 310165 },
            { type: 'distribute', payerName: '蚌', amount: 90000 },
            { type: 'distribute', payerName: '賴賴', amount: 30000 },
            { type: 'expense', payerName: '蚌', amount: 77710 },
            { type: 'expense', payerName: '賴賴', amount: 9526 },
            { type: 'expense', payerName: '柏', amount: 171898 },
            { type: 'return', payerName: '蚌', amount: 3535 },
            { type: 'return', payerName: '賴賴', amount: 10977 },
        ]
        expect(store.bunBalance).toBe(8755)
        expect(store.laiBalance).toBe(9497)
        expect(store.benBalance).toBe(32779)
    })

    it('沒有任何發放/歸還/柏支出時，柏零用金就等於補款總額', () => {
        const store = usePettyCashStore()
        store.entries = [
            { type: 'topup', amount: 50000 },
            { type: 'expense', payerName: '蚌', amount: 3000 },
        ]
        // topup 不分人，蚌自己花的錢不影響柏零用金（因為蚌花的錢是從「發放給蚌」那筆裡扣，
        // 不是直接從柏這邊扣）；蚌的支出只會反映在蚌自己的餘額變成負數
        expect(store.benBalance).toBe(50000)
        expect(store.bunBalance).toBe(-3000)
    })
})
