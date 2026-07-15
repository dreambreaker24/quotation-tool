import { describe, it, expect } from 'vitest'
import { formatCaseAddress } from '@/utils/caseAddress'

describe('formatCaseAddress', () => {
    it('組合城市/區/街道三個欄位', () => {
        expect(formatCaseAddress({ addressCity: '台南市', addressDistrict: '東區', addressStreet: '大同路二段123號' }))
            .toBe('台南市東區大同路二段123號')
    })

    it('只有部分欄位時跳過空的', () => {
        expect(formatCaseAddress({ addressCity: '台南市', addressStreet: '大同路二段123號' }))
            .toBe('台南市大同路二段123號')
        expect(formatCaseAddress({ addressDistrict: '東區' })).toBe('東區')
    })

    it('三個新欄位都沒有時 fallback 回舊的 address', () => {
        expect(formatCaseAddress({ address: '台南市東區舊地址100號' })).toBe('台南市東區舊地址100號')
    })

    it('新舊都沒有時回傳空字串', () => {
        expect(formatCaseAddress({})).toBe('')
        expect(formatCaseAddress({ address: '' })).toBe('')
    })
})
