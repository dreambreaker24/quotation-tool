import { describe, it, expect, vi } from 'vitest'

vi.mock('@/firebase', () => ({
    db: { type: 'firestore' },
    auth: { currentUser: null }
}))

import { db, auth } from '@/firebase'

describe('firebase', () => {
    it('exports db instance', () => {
        expect(db).toBeDefined()
    })
    it('exports auth instance', () => {
        expect(auth).toBeDefined()
    })
})
