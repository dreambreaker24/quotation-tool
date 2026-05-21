// naiship-system/tests/components/EmployeeTable.test.js
import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import EmployeeTable from '@/components/dashboard/EmployeeTable.vue'
import { useCasesStore } from '@/stores/cases'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => 'ts')
}))

describe('EmployeeTable', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows employee row for each unique assignee', () => {
    const store = useCasesStore()
    store.cases = [
      { id: '1', assignedTo: 'u1', assigneeName: '柯其宏', companyId: 'south', status: 'construction', signedAmount: 1200000, signedDate: { toDate: () => new Date('2026-01-15') } },
      { id: '2', assignedTo: 'u1', assigneeName: '柯其宏', companyId: 'south', status: 'lost', signedAmount: 0, signedDate: null },
      { id: '3', assignedTo: 'u2', assigneeName: '黃怡君', companyId: 'south', status: 'negotiating', signedAmount: 0, signedDate: null }
    ]
    const wrapper = mount(EmployeeTable)
    expect(wrapper.text()).toContain('柯其宏')
    expect(wrapper.text()).toContain('黃怡君')
  })
})
