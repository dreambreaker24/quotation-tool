import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkCategoriesStore } from '@/stores/workCategories'

let vendorDocs = []
let caseDocs = []
let bidRequestDocs = []
let updateSpy
let commitSpy

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn((db, name) => ({ __col: name })),
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
    getDocs: vi.fn((ref) => {
        if (ref && ref.__col === 'vendors') return Promise.resolve({ docs: vendorDocs })
        if (ref && ref.__col === 'cases') return Promise.resolve({ docs: caseDocs })
        if (ref && ref.__col === 'bidRequests') return Promise.resolve({ docs: bidRequestDocs })
        return Promise.resolve({ docs: [] })
    }),
    doc: vi.fn((db, ...rest) => rest.join('/')),
    serverTimestamp: vi.fn(() => 'ts'),
    writeBatch: vi.fn(() => ({ update: updateSpy, commit: commitSpy })),
    collectionGroup: vi.fn((db, name) => ({ __col: name })),
}))

function makeDoc(id, data) {
    return { id, ref: `ref-${id}`, data: () => data }
}

describe('workCategories store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vendorDocs = []
        caseDocs = []
        bidRequestDocs = []
        updateSpy = vi.fn()
        commitSpy = vi.fn(() => Promise.resolve())
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

    it('renameCategory 正常情況下會更新 vendors/cases/bidRequests 三處與 workCategories 本身的 name', async () => {
        vendorDocs = [makeDoc('v1', { specialties: ['油漆', '水電'] })]
        caseDocs = [makeDoc('case1', { workTypes: [{ name: '油漆' }, { name: '木工' }] })]
        bidRequestDocs = [makeDoc('bid1', { workCategory: '油漆' })]

        const store = useWorkCategoriesStore()
        const result = await store.renameCategory('c1', '油漆', '油漆工程')

        expect(result).toEqual({ vendorCount: 1, workTypeCount: 1, bidRequestCount: 1 })
        expect(updateSpy).toHaveBeenCalledWith('workCategories/c1', { name: '油漆工程' })
        expect(updateSpy).toHaveBeenCalledWith('ref-v1', { specialties: ['油漆工程', '水電'] })
        expect(updateSpy).toHaveBeenCalledWith('ref-case1', { workTypes: [{ name: '油漆工程' }, { name: '木工' }] })
        expect(updateSpy).toHaveBeenCalledWith('ref-bid1', { workCategory: '油漆工程' })
        expect(commitSpy).toHaveBeenCalled()
    })

    it('renameCategory 對舊制 specialty 殘留欄位的判斷跟 countUsage 用同一套 getVendorSpecialties 邏輯', async () => {
        // v1: specialties 非空但不含 oldName，specialty 殘留 oldName（死欄位）
        //     getVendorSpecialties 只看 specialties，判定「沒在用」oldName，不該被更新、不該計入 vendorCount
        // v2: specialties 為空陣列，specialty 仍是舊制單選 oldName，真正生效中是 specialty，應該被更新
        // v3: specialties 含 oldName，正常情況應該被更新
        vendorDocs = [
            makeDoc('v1', { specialties: ['水電'], specialty: '油漆' }),
            makeDoc('v2', { specialties: [], specialty: '油漆' }),
            makeDoc('v3', { specialties: ['油漆'] }),
        ]

        const store = useWorkCategoriesStore()

        const usage = await store.countUsage('油漆')
        expect(usage.vendorCount).toBe(2) // v2, v3

        const result = await store.renameCategory('c1', '油漆', '油漆工程')

        expect(result.vendorCount).toBe(2)
        // v1 的死欄位 specialty 不應該被動到
        expect(updateSpy).not.toHaveBeenCalledWith('ref-v1', expect.anything())
        // v2 的生效欄位是 specialty，應該被更新
        expect(updateSpy).toHaveBeenCalledWith('ref-v2', { specialty: '油漆工程' })
        // v3 的生效欄位是 specialties，應該被更新
        expect(updateSpy).toHaveBeenCalledWith('ref-v3', { specialties: ['油漆工程'] })
    })
})
