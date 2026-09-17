// naiship-system/tests/components/PettyCashForm.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import PettyCashForm from '@/components/pettyCash/PettyCashForm.vue'
import { useAuthStore } from '@/stores/auth'
import { useCasesStore } from '@/stores/cases'

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
vi.mock('@/composables/useStorage', () => ({
  uploadPhoto: vi.fn((file) => Promise.resolve(`https://example.com/${file.name}`)),
  validateUploadFile: vi.fn(() => null),
  isVideoFile: vi.fn(() => false),
}))

describe('PettyCashForm — 憑證上傳不限張數', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    async function mountForm() {
        const authStore = useAuthStore()
        authStore.role = 'admin'
        authStore.name = '柏'
        const casesStore = useCasesStore()
        casesStore.cases = []
        const wrapper = mount(PettyCashForm)
        await flushPromises()
        return wrapper
    }

    it('一次選多個檔案上傳，全部累加進 receiptImages', async () => {
        const wrapper = await mountForm()

        await wrapper.vm.uploadImage({
            target: { files: [{ name: 'a.jpg' }, { name: 'b.jpg' }], value: '' },
        })

        expect(wrapper.vm.form.receiptImages).toEqual([
            'https://example.com/a.jpg',
            'https://example.com/b.jpg',
        ])
    })

    it('已經有超過 6 張圖片時，上傳按鈕依然存在（不再有數量上限）', async () => {
        const wrapper = await mountForm()
        wrapper.vm.form.receiptImages = Array.from({ length: 8 }, (_, i) => `https://example.com/img${i}.jpg`)
        await wrapper.vm.$nextTick()

        expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    })

    it('沒有選任何檔案時不會累加任何圖片', async () => {
        const wrapper = await mountForm()

        await wrapper.vm.uploadImage({ target: { files: [], value: '' } })

        expect(wrapper.vm.form.receiptImages).toEqual([])
    })
})
