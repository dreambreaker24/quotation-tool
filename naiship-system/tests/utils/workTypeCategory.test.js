// naiship-system/tests/utils/workTypeCategory.test.js
import { describe, it, expect } from 'vitest'
import { isLegacyCategoryName } from '@/utils/workTypeCategory'

describe('isLegacyCategoryName', () => {
    const categories = ['水電', '泥作']

    it('is true when no category selected and the name is outside the list', () => {
        expect(isLegacyCategoryName('', '窗簾', categories)).toBe(true)
    })
    it('is false when a standard category is selected', () => {
        expect(isLegacyCategoryName('水電', '水電', categories)).toBe(false)
    })
    it('is false when the name is empty', () => {
        expect(isLegacyCategoryName('', '', categories)).toBe(false)
    })
    it('is false when the name matches a standard category even without an active selection', () => {
        expect(isLegacyCategoryName('', '水電', categories)).toBe(false)
    })
})
