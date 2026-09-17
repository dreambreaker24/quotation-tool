import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkCategoriesStore } from '@/stores/workCategories'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn((q, cb) => {
        cb({ docs: [
            { id: 'c1', data: () => ({ name: '油漆', createdAt: 'ts1' }) },
            { id: 'c2', data: () => ({ name: '水電', createdAt: 'ts2' }) },
        ] })
        return () => {}
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new1' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    doc: vi.fn((...args) => args.join('/')),
    serverTimestamp: vi.fn(() => 'ts'),
    writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn(() => Promise.resolve()) })),
    collectionGroup: vi.fn(),
}))

describe('workCategories store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('subscribe 後 categories 依 onSnapshot 回傳的內容填入', () => {
        const store = useWorkCategoriesStore()
        store.subscribe()
        expect(store.categories).toEqual([
            { id: 'c1', name: '油漆', createdAt: 'ts1' },
            { id: 'c2', name: '水電', createdAt: 'ts2' },
        ])
    })

    it('categoryNames 是純名稱字串陣列', () => {
        const store = useWorkCategoriesStore()
        store.subscribe()
        expect(store.categoryNames).toEqual(['油漆', '水電'])
    })
})
