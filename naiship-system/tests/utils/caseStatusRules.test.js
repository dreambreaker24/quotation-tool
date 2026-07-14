import { describe, it, expect } from 'vitest'
import { isMissingSignedAmountForConstruction } from '@/utils/caseStatusRules'

describe('isMissingSignedAmountForConstruction', () => {
    it('blocks when switching into construction with no signed amount', () => {
        expect(isMissingSignedAmountForConstruction('construction', 'negotiating', 0)).toBe(true)
    })
    it('blocks when switching into construction with empty signed amount', () => {
        expect(isMissingSignedAmountForConstruction('construction', 'drafting', null)).toBe(true)
    })
    it('allows when switching into construction with a signed amount filled', () => {
        expect(isMissingSignedAmountForConstruction('construction', 'negotiating', 500000)).toBe(false)
    })
    it('allows editing an already-construction case with no signed amount (not a new transition)', () => {
        expect(isMissingSignedAmountForConstruction('construction', 'construction', 0)).toBe(false)
    })
    it('allows switching to any other status regardless of signed amount', () => {
        expect(isMissingSignedAmountForConstruction('drafting', 'negotiating', 0)).toBe(false)
        expect(isMissingSignedAmountForConstruction('lost', 'negotiating', 0)).toBe(false)
    })
})
