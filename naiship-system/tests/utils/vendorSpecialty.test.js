import { describe, it, expect } from 'vitest'
import { getVendorSpecialties, filterVendorsByCategory } from '@/utils/vendorSpecialty'

describe('getVendorSpecialties', () => {
    it('returns the specialties array when present', () => {
        expect(getVendorSpecialties({ specialties: ['木工', '清運拆除'] })).toEqual(['木工', '清運拆除'])
    })

    it('falls back to a single-item array from the legacy specialty field', () => {
        expect(getVendorSpecialties({ specialty: '水電' })).toEqual(['水電'])
    })

    it('prefers specialties over the legacy specialty field when both present', () => {
        expect(getVendorSpecialties({ specialties: ['木工'], specialty: '水電' })).toEqual(['木工'])
    })

    it('returns an empty array when neither field is set', () => {
        expect(getVendorSpecialties({})).toEqual([])
    })

    it('falls back to the legacy field when specialties is an empty array', () => {
        expect(getVendorSpecialties({ specialties: [], specialty: '水電' })).toEqual(['水電'])
    })
})

describe('filterVendorsByCategory', () => {
    const WORK_CATEGORIES = ['木工', '水電', '清運拆除', '其他']
    const vendors = [
        { id: 'v1', name: 'A', specialties: ['木工', '清運拆除'] },
        { id: 'v2', name: 'B', specialties: ['水電'] },
        { id: 'v3', name: 'C', specialty: '木工' },
        { id: 'v4', name: 'D', specialties: ['冷氣'] },
    ]

    it('returns all vendors when category is empty (no filter selected)', () => {
        expect(filterVendorsByCategory(vendors, '', WORK_CATEGORIES)).toEqual(vendors)
    })

    it('returns all vendors when category is a custom value not in the work categories list', () => {
        expect(filterVendorsByCategory(vendors, '沙發', WORK_CATEGORIES)).toEqual(vendors)
    })

    it('filters vendors whose specialties include the given standard category', () => {
        const result = filterVendorsByCategory(vendors, '木工', WORK_CATEGORIES)
        expect(result.map(v => v.id)).toEqual(['v1', 'v3'])
    })

    it('matches vendors with multiple specialties on any matching one', () => {
        const result = filterVendorsByCategory(vendors, '清運拆除', WORK_CATEGORIES)
        expect(result.map(v => v.id)).toEqual(['v1'])
    })

    it('"其他" returns vendors whose specialties are all outside the standard categories', () => {
        const result = filterVendorsByCategory(vendors, '其他', WORK_CATEGORIES)
        expect(result.map(v => v.id)).toEqual(['v4'])
    })
})
