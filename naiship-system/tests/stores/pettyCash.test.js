// naiship-system/tests/stores/pettyCash.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePettyCashStore } from '@/stores/pettyCash'
import { onSnapshot } from 'firebase/firestore'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
    onSnapshot: vi.fn((q, cb) => { cb({ docs: [], metadata: { fromCache: false } }); return () => {} }),
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

    it('本月花費只算 date 落在當月、type 為 expense 的記錄', () => {
        const store = usePettyCashStore()
        const thisMonth = new Date().toISOString().slice(0, 7)
        store.entries = [
            // 之前月份：不該算進本月花費
            { date: '2020-01-15', type: 'expense', payerName: '蚌', amount: 9999 },
            // 本月：蚌花兩筆、賴賴花一筆，發放/歸還不算花費
            { date: `${thisMonth}-05`, type: 'expense', payerName: '蚌', amount: 1000 },
            { date: `${thisMonth}-06`, type: 'expense', payerName: '蚌', amount: 500 },
            { date: `${thisMonth}-07`, type: 'expense', payerName: '賴賴', amount: 300 },
            { date: `${thisMonth}-08`, type: 'distribute', payerName: '蚌', amount: 30000 },
        ]
        expect(store.bunExpenseThisMonth).toBe(1500)
        expect(store.laiExpenseThisMonth).toBe(300)
    })
})

describe('pettyCash store — 本機快取時等伺服器資料到才算載入完成', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('只收到快取資料時 waitForEntriesReady 不會完成，收到伺服器資料才完成', async () => {
        let emit
        onSnapshot.mockImplementationOnce((q, cb) => { emit = cb; return () => {} })
        const store = usePettyCashStore()
        store.subscribe()
        let ready = false
        store.waitForEntriesReady().then(() => { ready = true })

        emit({ docs: [], metadata: { fromCache: true } })
        await new Promise(r => setTimeout(r))
        expect(ready).toBe(false)

        emit({ docs: [], metadata: { fromCache: false } })
        await new Promise(r => setTimeout(r))
        expect(ready).toBe(true)
    })
})
