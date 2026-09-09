import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import PayslipView from '@/views/PayslipView.vue'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useCalendarEventsStore } from '@/stores/calendarEvents'

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(), signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(), signOut: vi.fn()
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => undefined })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'x' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn((...args) => args.join('/')),
  serverTimestamp: vi.fn(() => 'ts'),
  // fetchPayrollData() 內部並行呼叫的 workLogsStore.fetchMonthlyKm() 會用到 Timestamp.fromDate()，
  // 沒 mock 會同步拋錯，讓 Promise.all 整包 reject，被外層空 catch 吞掉、pendingLeaveEntries 永遠設不到值。
  Timestamp: { fromDate: vi.fn(d => ({ toDate: () => d, toMillis: () => d.getTime() })) },
}))
vi.mock('html2canvas', () => ({ default: vi.fn() }))
// @vitejs/plugin-vue 在非 dev-server 環境（vitest 走的就是這條路徑）預設 includeAbsolute:true，
// 會把樣板裡 <img src="/logo-crop.png"> 編譯成 `import _imports_0 from '/logo-crop.png'`。
// Vitest 的 SSR module runner 沒有 Vite dev server 那層 public 目錄特殊處理，會直接把這個
// root-relative路徑拿去 createRequire 而爆炸。這裡直接 mock 掉這個 import specifier，
// 不影響正式建置（vite build 走真正的 dev-server/build pipeline，這裡的 mock 只在測試環境生效）。
vi.mock('/logo-crop.png', () => ({ default: '' }))

describe('PayslipView — 補休折抵事假', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function mountWithData() {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue([
      { id: 'led-1', type: '平日', remainingHours: 10.5, value: 3507, hours: 10.5, createdAt: { toMillis: () => 1 } },
      { id: 'led-2', type: '休息日', remainingHours: 3, value: 903, hours: 3, createdAt: { toMillis: () => 2 } },
    ])
    vi.spyOn(eventsStore, 'fetchMonthlyLeaveDetail').mockResolvedValue([
      { id: 'leave-1', date: new Date('2026-08-07'), leaveType: '事假', hours: 8, leaveTypeLocked: false, convertedFromLeaveType: '', compConsumption: [] },
    ])
    const wrapper = mount(PayslipView)
    await flushPromises()
    // PayslipView 的 onMounted 會呼叫 usersStore.subscribe()，而 mock 的 onSnapshot 會同步觸發
    // callback（回傳空 docs），把 users.value 蓋成 []。所以要在 mount + flushPromises 之後才
    // 塞測試資料，不然會被 subscribe() 的同步 wipe 蓋掉（跟 CalendarTab.vue 不同，那邊沒呼叫 subscribe()）。
    usersStore.users = [{ id: 'u-bang', name: '蚌', salary: 50000, annualLeaveHours: 0 }]
    wrapper.vm.form.empName = '蚌'
    wrapper.vm.form.payMonth = '2026-08'
    // 設定 payMonth 會觸發既有的 watch(payMonth) -> switchMonthContext()，
    // 它內部也會呼叫 fetchPayrollData() 且會先 resetMonthlyFields() 清空 pendingLeaveEntries。
    // 這裡先讓那個既有的 watcher 流程跑完，避免跟我們下面手動呼叫的 fetchPayrollData() 互相搶跑，
    // 導致 resetMonthlyFields() 在我們手動呼叫之後才執行、把資料清空。
    await flushPromises()
    await wrapper.vm.fetchPayrollData()
    await flushPromises()
    return { wrapper, usersStore, eventsStore }
  }

  it('自動帶入後，可折抵清單會列出當月事假事件', async () => {
    const { wrapper } = await mountWithData()
    expect(wrapper.vm.offsetCandidates.map(e => e.id)).toEqual(['leave-1'])
    expect(wrapper.vm.compBalance).toBe(13.5)
  })

  it('勾選並確認折抵後，扣掉對應補休、把該事件leaveType改成補休並鎖定', async () => {
    const { wrapper, usersStore, eventsStore } = await mountWithData()
    const applySpy = vi.spyOn(usersStore, 'applyLedgerConsumption').mockResolvedValue()
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()

    wrapper.vm.offsetSelectedIds = ['leave-1']
    await wrapper.vm.confirmOffset()
    await flushPromises()

    // 8h 事假只需要消耗平日補休（10.5h 夠用），休息日 3h 完全不動
    expect(applySpy).toHaveBeenCalledWith('u-bang', [expect.objectContaining({ id: 'led-1', remainingHours: 2.5 })])
    expect(updateSpy).toHaveBeenCalledWith('leave-1', expect.objectContaining({
      leaveType: '補休',
      leaveTypeLocked: true,
      convertedFromLeaveType: '事假',
    }))
  })

  it('勾選時數超過補休餘額時，不能確認折抵', async () => {
    const { wrapper, usersStore } = await mountWithData()
    usersStore.fetchCompLedger.mockResolvedValue([
      { id: 'led-1', type: '平日', remainingHours: 2, value: 700, hours: 2, createdAt: { toMillis: () => 1 } },
    ])
    await wrapper.vm.refreshCompBalance()
    wrapper.vm.offsetSelectedIds = ['leave-1']
    expect(wrapper.vm.canConfirmOffset).toBe(false)
  })
})
