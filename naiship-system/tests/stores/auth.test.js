// naiship-system/tests/stores/auth.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/firebase', () => ({
  auth: { onAuthStateChanged: vi.fn() },
  db: {}
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({ name: '柯其宏', role: 'employee', companyId: 'south' })
  }))
}))

describe('useAuthStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initial state is unauthenticated', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
    expect(store.role).toBeNull()
    expect(store.isAdmin).toBe(false)
  })

  it('isAdmin returns true for admin role', () => {
    const store = useAuthStore()
    store.role = 'admin'
    expect(store.isAdmin).toBe(true)
  })

  it('canViewRegion: admin can view all regions', () => {
    const store = useAuthStore()
    store.role = 'admin'
    expect(store.canViewRegion('north')).toBe(true)
    expect(store.canViewRegion('south')).toBe(true)
  })

  it('canViewRegion: employee can only view own region', () => {
    const store = useAuthStore()
    store.role = 'employee'
    store.companyId = 'south'
    expect(store.canViewRegion('south')).toBe(true)
    expect(store.canViewRegion('north')).toBe(false)
  })
})
