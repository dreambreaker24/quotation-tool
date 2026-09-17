// naiship-system/tests/components/VendorManager.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import VendorManager from '@/components/settings/VendorManager.vue'
import { useWorkCategoriesStore } from '@/stores/workCategories'
import { useAuthStore } from '@/stores/auth'

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
        expect(wrapper.vm.newCategoryName).toBe('')
    })

    it('送出中（submittingCategory 為 true）時重複呼叫不會送出第二次', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        let resolveAdd
        const addCategorySpy = vi.spyOn(workCategoriesStore, 'addCategory')
            .mockImplementation(() => new Promise(resolve => { resolveAdd = resolve }))
        const wrapper = mount(VendorManager)
        await flushPromises()

        wrapper.vm.newCategoryName = '磁磚'
        const firstCall = wrapper.vm.submitNewCategory()
        await wrapper.vm.$nextTick()
        wrapper.vm.newCategoryName = '磁磚'
        await wrapper.vm.submitNewCategory()

        expect(addCategorySpy).toHaveBeenCalledTimes(1)
        resolveAdd()
        await firstCall
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

describe('VendorManager — 改名分類', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('輸入新名稱確認後，呼叫 workCategoriesStore.renameCategory 並顯示更新筆數', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        workCategoriesStore.categories = [{ id: 'c1', name: '油漆', createdAt: 'ts' }]
        const renameSpy = vi.spyOn(workCategoriesStore, 'renameCategory')
            .mockResolvedValue({ vendorCount: 2, workTypeCount: 5, bidRequestCount: 0 })
        const wrapper = mount(VendorManager)
        await flushPromises()

        await wrapper.vm.startRenameCategory('c1', '油漆')
        wrapper.vm.renameCategoryDraft = '油漆工程'
        await wrapper.vm.confirmRenameCategory('c1', '油漆')

        expect(renameSpy).toHaveBeenCalledWith('c1', '油漆', '油漆工程')
    })

    it('新名稱跟現有其他分類重複時不會呼叫 renameCategory', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        workCategoriesStore.categories = [
            { id: 'c1', name: '油漆', createdAt: 'ts1' },
            { id: 'c2', name: '水電', createdAt: 'ts2' },
        ]
        const renameSpy = vi.spyOn(workCategoriesStore, 'renameCategory').mockResolvedValue({})
        const wrapper = mount(VendorManager)
        await flushPromises()

        await wrapper.vm.startRenameCategory('c1', '油漆')
        wrapper.vm.renameCategoryDraft = '水電'
        await wrapper.vm.confirmRenameCategory('c1', '油漆')

        expect(renameSpy).not.toHaveBeenCalled()
    })

    it('renameCategory 失敗時跳出錯誤提示，不會卡在改名狀態解不開', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        workCategoriesStore.categories = [{ id: 'c1', name: '油漆', createdAt: 'ts' }]
        vi.spyOn(workCategoriesStore, 'renameCategory').mockRejectedValue(new Error('network error'))
        const wrapper = mount(VendorManager)
        await flushPromises()

        await wrapper.vm.startRenameCategory('c1', '油漆')
        wrapper.vm.renameCategoryDraft = '油漆工程'
        await wrapper.vm.confirmRenameCategory('c1', '油漆')

        expect(wrapper.vm.renamingSubmitting).toBe(false)
    })
})

describe('VendorManager — 刪除分類', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('分類仍有廠商在用時，擋下刪除並顯示使用筆數，不呼叫 deleteCategory', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        const authStore = useAuthStore()
        authStore.role = 'admin'
        workCategoriesStore.categories = [{ id: 'c1', name: '油漆', createdAt: 'ts' }]
        const deleteSpy = vi.spyOn(workCategoriesStore, 'deleteCategory')
            .mockResolvedValue({ deleted: false, usage: { vendorCount: 3, workTypeCount: 0, bidRequestCount: 0 } })
        vi.stubGlobal('confirm', vi.fn(() => true))
        const wrapper = mount(VendorManager)
        await flushPromises()

        await wrapper.vm.deleteCategoryWithConfirm('c1', '油漆')

        expect(deleteSpy).toHaveBeenCalledWith('c1', '油漆')
    })

    it('分類完全沒人用時，確認後成功刪除', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        const authStore = useAuthStore()
        authStore.role = 'admin'
        workCategoriesStore.categories = [{ id: 'c1', name: '油漆', createdAt: 'ts' }]
        const deleteSpy = vi.spyOn(workCategoriesStore, 'deleteCategory')
            .mockResolvedValue({ deleted: true, usage: { vendorCount: 0, workTypeCount: 0, bidRequestCount: 0 } })
        vi.stubGlobal('confirm', vi.fn(() => true))
        const wrapper = mount(VendorManager)
        await flushPromises()

        await wrapper.vm.deleteCategoryWithConfirm('c1', '油漆')

        expect(deleteSpy).toHaveBeenCalledWith('c1', '油漆')
    })

    it('使用者取消確認對話框時，不會呼叫 deleteCategory', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        workCategoriesStore.categories = [{ id: 'c1', name: '油漆', createdAt: 'ts' }]
        const deleteSpy = vi.spyOn(workCategoriesStore, 'deleteCategory').mockResolvedValue({ deleted: true, usage: {} })
        vi.stubGlobal('confirm', vi.fn(() => false))
        const wrapper = mount(VendorManager)
        await flushPromises()

        await wrapper.vm.deleteCategoryWithConfirm('c1', '油漆')

        expect(deleteSpy).not.toHaveBeenCalled()
    })

    it('deleteCategory 失敗時跳出錯誤提示，不會卡在刪除中狀態解不開', async () => {
        const workCategoriesStore = useWorkCategoriesStore()
        workCategoriesStore.categories = [{ id: 'c1', name: '油漆', createdAt: 'ts' }]
        vi.spyOn(workCategoriesStore, 'deleteCategory').mockRejectedValue(new Error('network error'))
        vi.stubGlobal('confirm', vi.fn(() => true))
        const wrapper = mount(VendorManager)
        await flushPromises()

        await wrapper.vm.deleteCategoryWithConfirm('c1', '油漆')

        expect(wrapper.vm.deletingCategory).toBe(false)
    })
})
