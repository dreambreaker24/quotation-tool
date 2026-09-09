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

  async function mountWithData({
    leaveEntries = [
      { id: 'leave-1', date: new Date('2026-08-07'), leaveType: '事假', hours: 8, leaveTypeLocked: false, convertedFromLeaveType: '', compConsumption: [] },
    ],
    ledgerEntries = [
      { id: 'led-1', type: '平日', remainingHours: 10.5, value: 3507, hours: 10.5, createdAt: { toMillis: () => 1 } },
      { id: 'led-2', type: '休息日', remainingHours: 3, value: 903, hours: 3, createdAt: { toMillis: () => 2 } },
    ],
  } = {}) {
    const usersStore = useUsersStore()
    const authStore = useAuthStore()
    const eventsStore = useCalendarEventsStore()
    authStore.role = 'admin'
    authStore.name = '柏'
    vi.spyOn(usersStore, 'fetchCompLedger').mockResolvedValue(ledgerEntries)
    vi.spyOn(eventsStore, 'fetchMonthlyLeaveDetail').mockResolvedValue(leaveEntries)
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

  it('迴圈中途 updateEvent 失敗時，catch 會清空選取、重新同步餘額與候選清單，避免重試重複扣款', async () => {
    const leaveEntries = [
      { id: 'leave-1', date: new Date('2026-08-05'), leaveType: '事假', hours: 4, leaveTypeLocked: false, convertedFromLeaveType: '', compConsumption: [] },
      { id: 'leave-2', date: new Date('2026-08-12'), leaveType: '事假', hours: 4, leaveTypeLocked: false, convertedFromLeaveType: '', compConsumption: [] },
    ]
    const { wrapper, usersStore, eventsStore } = await mountWithData({ leaveEntries })
    const applySpy = vi.spyOn(usersStore, 'applyLedgerConsumption').mockResolvedValue()
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent')
      .mockResolvedValueOnce()               // leave-1（依日期排序後先處理）成功
      .mockRejectedValueOnce(new Error('net')) // leave-2 失敗

    // confirmOffset 失敗後會呼叫 fetchPayrollData() 重新從伺服器拉最新狀態：
    // 模擬伺服器端 leave-1 已經被前面成功的那筆 updateEvent 真的改成補休鎖定，leave-2 還維持事假
    eventsStore.fetchMonthlyLeaveDetail.mockResolvedValue([
      { id: 'leave-1', date: new Date('2026-08-05'), leaveType: '補休', hours: 4, leaveTypeLocked: true, convertedFromLeaveType: '事假', compConsumption: [{ id: 'led-1', hours: 4 }] },
      { id: 'leave-2', date: new Date('2026-08-12'), leaveType: '事假', hours: 4, leaveTypeLocked: false, convertedFromLeaveType: '', compConsumption: [] },
    ])

    wrapper.vm.offsetSelectedIds = ['leave-1', 'leave-2']
    await wrapper.vm.confirmOffset()
    await flushPromises()

    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).toHaveBeenCalledTimes(2)
    // catch 裡清空選取，不會讓使用者對著舊 id 重試
    expect(wrapper.vm.offsetSelectedIds).toEqual([])
    // fetchPayrollData 重新拉過資料後，候選清單只剩下沒成功折抵的 leave-2，
    // 已成功的 leave-1（leaveTypeLocked=true）被自動排除，避免重複點擊確認折抵時被再扣一次補休
    expect(wrapper.vm.offsetCandidates.map(e => e.id)).toEqual(['leave-2'])
  })

  it('多筆事假事件同時折抵、消耗量橫跨多筆 compLedger 分錄時，每筆事件的 compConsumption 明細正確', async () => {
    const leaveEntries = [
      { id: 'leave-1', date: new Date('2026-08-20'), leaveType: '事假', hours: 6, leaveTypeLocked: false, convertedFromLeaveType: '', compConsumption: [] },
      { id: 'leave-2', date: new Date('2026-08-03'), leaveType: '事假', hours: 3, leaveTypeLocked: false, convertedFromLeaveType: '', compConsumption: [] },
    ]
    // 兩筆 平日 分錄：led-1 只有 5h，led-2 有 10h，事件總時數 9h 剛好跨過 led-1/led-2 的邊界
    const ledgerEntries = [
      { id: 'led-1', type: '平日', remainingHours: 5, value: 1670, hours: 5, createdAt: { toMillis: () => 1 } },
      { id: 'led-2', type: '平日', remainingHours: 10, value: 3340, hours: 10, createdAt: { toMillis: () => 2 } },
    ]
    const { wrapper, usersStore, eventsStore } = await mountWithData({ leaveEntries, ledgerEntries })
    const applySpy = vi.spyOn(usersStore, 'applyLedgerConsumption').mockResolvedValue()
    const updateSpy = vi.spyOn(eventsStore, 'updateEvent').mockResolvedValue()

    wrapper.vm.offsetSelectedIds = ['leave-1', 'leave-2']
    await wrapper.vm.confirmOffset()
    await flushPromises()

    // 整體消耗：led-1 全部 5h + led-2 4h = 9h，餘額正確扣完
    expect(applySpy).toHaveBeenCalledWith('u-bang', expect.arrayContaining([
      expect.objectContaining({ id: 'led-1', remainingHours: 0 }),
      expect.objectContaining({ id: 'led-2', remainingHours: 6 }),
    ]))
    // 依日期排序後先處理 leave-2（8/3，3h）：全部從 led-1 拿
    expect(updateSpy).toHaveBeenCalledWith('leave-2', expect.objectContaining({
      compConsumption: [{ id: 'led-1', hours: 3 }],
    }))
    // 再處理 leave-1（8/20，6h）：先用完 led-1 剩下的 2h，再從 led-2 拿 4h，沒有超額也沒有短少
    expect(updateSpy).toHaveBeenCalledWith('leave-1', expect.objectContaining({
      compConsumption: [{ id: 'led-1', hours: 2 }, { id: 'led-2', hours: 4 }],
    }))
  })
})
