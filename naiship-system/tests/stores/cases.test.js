// naiship-system/tests/stores/cases.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
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

describe('useCasesStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initial cases is empty array', () => {
    const store = useCasesStore()
    expect(store.cases).toEqual([])
  })

  it('casesByStatus filters correctly', () => {
    const store = useCasesStore()
    store.cases = [
      { id: '1', status: 'construction', companyId: 'south' },
      { id: '2', status: 'negotiating', companyId: 'south' },
      { id: '3', status: 'construction', companyId: 'north' }
    ]
    expect(store.casesByStatus('construction', 'south')).toHaveLength(1)
    expect(store.casesByStatus('construction', null)).toHaveLength(2)
  })

  it('statusCount returns correct count', () => {
    const store = useCasesStore()
    store.cases = [
      { status: 'construction', companyId: 'south' },
      { status: 'construction', companyId: 'south' },
      { status: 'negotiating', companyId: 'south' }
    ]
    expect(store.statusCount('construction', 'south')).toBe(2)
    expect(store.statusCount('negotiating', 'south')).toBe(1)
  })
})
