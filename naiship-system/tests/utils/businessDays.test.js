import { describe, it, expect } from 'vitest'
import { getBusinessDays } from '@/utils/businessDays'

describe('getBusinessDays', () => {
    it('沒給日期回傳空陣列', () => {
        expect(getBusinessDays('', '')).toEqual([])
    })

    it('單一平日回傳該天', () => {
        expect(getBusinessDays('2026-10-12', '')).toEqual(['2026-10-12'])
    })

    it('單一週六回傳空陣列', () => {
        expect(getBusinessDays('2026-10-17', '')).toEqual([])
    })

    it('單一國定假日（2026-09-28 教師節）回傳空陣列', () => {
        expect(getBusinessDays('2026-09-28', '')).toEqual([])
    })

    it('區間會排除週末與國定假日', () => {
        expect(getBusinessDays('2026-10-15', '2026-10-19')).toEqual([
            '2026-10-15', '2026-10-16', '2026-10-19',
        ])
    })

    it('endDate 早於或等於 date 時視為單日', () => {
        expect(getBusinessDays('2026-10-12', '2026-10-12')).toEqual(['2026-10-12'])
        expect(getBusinessDays('2026-10-12', '2026-10-05')).toEqual(['2026-10-12'])
    })
})
