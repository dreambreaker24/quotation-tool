import { describe, it, expect } from 'vitest'
import { sumItems, wtVendorCostTotal, totalVendorPaid, vendorInvoiceStatus } from '@/utils/workTypeInvoice'

describe('sumItems', () => {
    it('免費時直接回傳 0', () => {
        expect(sumItems([{ amount: 1000 }], true)).toBe(0)
    })

    it('加總所有項目金額', () => {
        expect(sumItems([{ amount: 1000 }, { amount: 2000 }], false)).toBe(3000)
    })

    it('沒有項目時回傳 0', () => {
        expect(sumItems(null, false)).toBe(0)
    })
})

describe('wtVendorCostTotal', () => {
    it('有 vendorCostItems 時加總項目金額', () => {
        expect(wtVendorCostTotal({ vendorCostItems: [{ amount: 5000 }, { amount: 3000 }] })).toBe(8000)
    })

    it('沒有 vendorCostItems 但有舊格式 vendorCost 時沿用', () => {
        expect(wtVendorCostTotal({ vendorCost: 10000 })).toBe(10000)
    })

    it('vendorCostFree 時回傳 0', () => {
        expect(wtVendorCostTotal({ vendorCostItems: [{ amount: 5000 }], vendorCostFree: true })).toBe(0)
    })
})

describe('totalVendorPaid', () => {
    it('加總所有付款記錄', () => {
        expect(totalVendorPaid({ vendorPayments: [{ amount: 3000 }, { amount: 2000 }] })).toBe(5000)
    })

    it('沒有付款記錄時回傳 0', () => {
        expect(totalVendorPaid({})).toBe(0)
    })
})

describe('vendorInvoiceStatus', () => {
    it('沒有廠商名稱時回傳 null（不用管發票）', () => {
        expect(vendorInvoiceStatus({ vendorName: '', vendorCostItems: [{ amount: 10000 }] })).toBeNull()
    })

    it('沒有金額時回傳 null', () => {
        expect(vendorInvoiceStatus({ vendorName: '甲廠商', vendorCostItems: [] })).toBeNull()
    })

    it('vendorCostFree 時回傳 null', () => {
        expect(vendorInvoiceStatus({ vendorName: '甲廠商', vendorCostItems: [{ amount: 10000 }], vendorCostFree: true })).toBeNull()
    })

    it('costIncludesTax 為 false（不開發票）時回傳 null', () => {
        expect(vendorInvoiceStatus({ vendorName: '甲廠商', vendorCostItems: [{ amount: 10000 }], costIncludesTax: false })).toBeNull()
    })

    it('有廠商有金額但 invoiceReceived 為 false 時顯示未收發票', () => {
        expect(vendorInvoiceStatus({ vendorName: '甲廠商', vendorCostItems: [{ amount: 10000 }], invoiceReceived: false }))
            .toEqual({ label: '未收發票', cls: 'bg-gray-100 text-gray-400' })
    })

    it('invoiceReceived 為 true 時顯示已收發票，不受完工狀態影響', () => {
        expect(vendorInvoiceStatus({ vendorName: '甲廠商', vendorCostItems: [{ amount: 10000 }], invoiceReceived: true, done: false }))
            .toEqual({ label: '已收發票', cls: 'bg-green-100 text-green-700' })
    })
})
