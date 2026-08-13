// naiship-system/tests/components/ClientList.test.js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import ClientList from '@/components/clients/ClientList.vue'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  addDoc: vi.fn(),
  updateDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn((...args) => args.join('/')),
  serverTimestamp: vi.fn(() => 'ts'),
  deleteField: vi.fn(() => '__deleteField__'),
}))

function baseClient(overrides = {}) {
  return { id: 'c1', name: '黃千惠小姐', phone: '0936-957972', status: 'contacted', companyId: 'south', ...overrides }
}

describe('ClientList — 客戶分級標籤', () => {
  let activeWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
  })

  function mountAs(role, clients) {
    const clientsStore = useClientsStore()
    const authStore = useAuthStore()
    authStore.role = role
    clientsStore.clients = clients
    const wrapper = mount(ClientList, { props: { selected: null }, attachTo: document.body })
    activeWrapper = wrapper
    return { wrapper, clientsStore }
  }

  it('主管看到未分級客戶時顯示可點擊的「+」佔位徽章', () => {
    const { wrapper } = mountAs('manager', [baseClient()])
    expect(wrapper.find('[data-test="grade-badge-c1"]').text()).toBe('+')
  })

  it('一般員工看到未分級客戶時不顯示任何徽章', () => {
    const { wrapper } = mountAs('employee', [baseClient()])
    expect(wrapper.find('[data-test="grade-badge-c1"]').exists()).toBe(false)
  })

  it('一般員工看到已分級客戶時顯示徽章但不能點擊改變', async () => {
    const { wrapper, clientsStore } = mountAs('employee', [baseClient({ grade: 'S' })])
    const updateSpy = vi.spyOn(clientsStore, 'updateClient')
    const badge = wrapper.find('[data-test="grade-badge-c1"]')
    expect(badge.text()).toBe('S')
    await badge.trigger('click')
    expect(wrapper.find('[data-test="grade-menu-c1"]').exists()).toBe(false)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('主管點徽章開選單、選 S，呼叫 updateClient 寫入 grade', async () => {
    const { wrapper, clientsStore } = mountAs('manager', [baseClient()])
    const updateSpy = vi.spyOn(clientsStore, 'updateClient')

    await wrapper.find('[data-test="grade-badge-c1"]').trigger('click')
    expect(wrapper.find('[data-test="grade-menu-c1"]').exists()).toBe(true)

    await wrapper.find('[data-test="grade-option-c1-S"]').trigger('click')
    await flushPromises()

    expect(updateSpy).toHaveBeenCalledWith('c1', { grade: 'S' })
    expect(wrapper.find('[data-test="grade-menu-c1"]').exists()).toBe(false)
  })

  it('主管點已分級客戶的「清除」，用 deleteField() 清掉 grade 欄位（不是寫 null）', async () => {
    const { wrapper, clientsStore } = mountAs('manager', [baseClient({ grade: 'A' })])
    const updateSpy = vi.spyOn(clientsStore, 'updateClient')

    await wrapper.find('[data-test="grade-badge-c1"]').trigger('click')
    await wrapper.find('[data-test="grade-clear-c1"]').trigger('click')
    await flushPromises()

    expect(updateSpy).toHaveBeenCalledWith('c1', { grade: '__deleteField__' })
  })

  it('點卡片上的分級徽章不會觸發卡片本身的 select 事件', async () => {
    const { wrapper } = mountAs('manager', [baseClient()])
    await wrapper.find('[data-test="grade-badge-c1"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('篩選器選 S 時，只顯示已分級為 S 的客戶', async () => {
    const { wrapper } = mountAs('manager', [
      baseClient({ id: 'c1', name: '客戶一', grade: 'S' }),
      baseClient({ id: 'c2', name: '客戶二', grade: 'A' }),
      baseClient({ id: 'c3', name: '客戶三' }),
    ])
    await wrapper.find('[data-test="grade-filter"]').setValue('S')
    expect(wrapper.text()).toContain('客戶一')
    expect(wrapper.text()).not.toContain('客戶二')
    expect(wrapper.text()).not.toContain('客戶三')
  })

  it('篩選器選「未分級」時，只顯示沒有 grade 欄位的客戶', async () => {
    const { wrapper } = mountAs('manager', [
      baseClient({ id: 'c1', name: '客戶一', grade: 'S' }),
      baseClient({ id: 'c3', name: '客戶三' }),
    ])
    await wrapper.find('[data-test="grade-filter"]').setValue('none')
    expect(wrapper.text()).not.toContain('客戶一')
    expect(wrapper.text()).toContain('客戶三')
  })

  it('選單開著時點畫面上其他地方（例如搜尋框），選單會自動關閉', async () => {
    const { wrapper } = mountAs('manager', [baseClient()])
    await wrapper.find('[data-test="grade-badge-c1"]').trigger('click')
    expect(wrapper.find('[data-test="grade-menu-c1"]').exists()).toBe(true)

    await wrapper.find('input[type="text"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="grade-menu-c1"]').exists()).toBe(false)
  })

  it('點徽章開啟選單，不會連帶觸發卡片本身的 select（現在改用 selectClient 內的 containment check，不是 stopPropagation）', async () => {
    const { wrapper } = mountAs('manager', [baseClient()])
    await wrapper.find('[data-test="grade-badge-c1"]').trigger('click')
    expect(wrapper.find('[data-test="grade-menu-c1"]').exists()).toBe(true)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('選單開著時，點選單裡的選項（例如 S）不會被 document 的 outside-click 監聽器誤判成「點外面」而先關掉選單', async () => {
    const { wrapper, clientsStore } = mountAs('manager', [baseClient()])
    const updateSpy = vi.spyOn(clientsStore, 'updateClient')
    await wrapper.find('[data-test="grade-badge-c1"]').trigger('click')
    await wrapper.find('[data-test="grade-option-c1-S"]').trigger('click')
    await flushPromises()
    expect(updateSpy).toHaveBeenCalledWith('c1', { grade: 'S' })
  })
})
