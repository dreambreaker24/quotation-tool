// naiship-system/tests/components/VendorManager.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import VendorManager from '@/components/settings/VendorManager.vue'
import { useWorkCategoriesStore } from '@/stores/workCategories'

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(), signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(), signOut: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
  updateDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'r1' })),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => undefined })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  setDoc: vi.fn(), deleteDoc: vi.fn(),
  doc: vi.fn((...args) => args.join('/')),
  serverTimestamp: vi.fn(() => 'ts'),
  Timestamp: { fromDate: vi.fn(d => d), now: vi.fn(() => 'ts') },
}))

describe('VendorManager — 新增分類', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('輸入新分類名稱送出後，呼叫 workCategoriesStore.addCategory', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        const addCategorySpy = vi.spyOn(workCategoriesStore, 'addCategory').mockResolvedValue()
        const wrapper = mount(VendorManager)
        await flushPromises()

        wrapper.vm.newCategoryName = '磁磚'
        await wrapper.vm.submitNewCategory()

        expect(addCategorySpy).toHaveBeenCalledWith('磁磚')
    })

    it('分類名稱空白時不會呼叫 addCategory', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        const addCategorySpy = vi.spyOn(workCategoriesStore, 'addCategory').mockResolvedValue()
        const wrapper = mount(VendorManager)
        await flushPromises()

        wrapper.vm.newCategoryName = '   '
        await wrapper.vm.submitNewCategory()

        expect(addCategorySpy).not.toHaveBeenCalled()
    })

    it('分類名稱跟現有分類重複時不會呼叫 addCategory，並跳錯誤提示', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        workCategoriesStore.categories = [{ id: 'c1', name: '油漆', createdAt: 'ts' }]
        const addCategorySpy = vi.spyOn(workCategoriesStore, 'addCategory').mockResolvedValue()
        const wrapper = mount(VendorManager)
        await flushPromises()

        wrapper.vm.newCategoryName = '油漆'
        await wrapper.vm.submitNewCategory()

        expect(addCategorySpy).not.toHaveBeenCalled()
    })
})
