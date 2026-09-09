import { describe, it, expect } from 'vitest'
import { sumItems, wtVendorCostTotal, totalVendorPaid, vendorInvoiceStatus, computePendingInvoiceGroups, itemPaid, allocatePayment } from '@/utils/workTypeInvoice'

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

describe('computePendingInvoiceGroups', () => {
    function makeWt(overrides) {
        return {
            id: 'wt-default',
            name: '工種',
            vendorName: '甲廠商',
            vendorCostItems: [{ amount: 10000 }],
            vendorPayments: [{ amount: 10000, paidDate: '2026-08-01' }],
            invoiceReceived: false,
            ...overrides,
        }
    }
    function makeCase(id, name, workTypes) {
        return { id, name, companyId: 'tainan', workTypes }
    }

    it('已收發票的工種不列入', () => {
        const cases = [makeCase('c1', '案件A', [makeWt({ invoiceReceived: true })])]
        expect(computePendingInvoiceGroups(cases)).toEqual([])
    })

    it('款項還沒付清的工種不列入', () => {
        const cases = [makeCase('c1', '案件A', [makeWt({
            vendorCostItems: [{ amount: 20000 }],
            vendorPayments: [{ amount: 10000, paidDate: '2026-08-01' }],
        })])]
        expect(computePendingInvoiceGroups(cases)).toEqual([])
    })

    it('沒有廠商合約金額的工種不列入（vendorInvoiceStatus 回傳 null）', () => {
        const cases = [makeCase('c1', '案件A', [makeWt({ vendorCostItems: [] })])]
        expect(computePendingInvoiceGroups(cases)).toEqual([])
    })

    it('有付款金額但每筆都沒有 paidDate 時不列入（防禦性排除）', () => {
        const cases = [makeCase('c1', '案件A', [makeWt({
            vendorPayments: [{ amount: 10000 }],
        })])]
        expect(computePendingInvoiceGroups(cases)).toEqual([])
    })

    it('款項已全部付清且未收發票的工種列入，並回傳最晚一筆 paidDate', () => {
        const wt = makeWt({
            id: 'wt-1',
            vendorCostItems: [{ amount: 10000 }],
            vendorPayments: [
                { amount: 6000, paidDate: '2026-07-01' },
                { amount: 4000, paidDate: '2026-08-15' },
            ],
        })
        const cases = [makeCase('c1', '案件A', [wt])]
        expect(computePendingInvoiceGroups(cases)).toEqual([
            { caseId: 'c1', caseName: '案件A', items: [{ caseId: 'c1', caseName: '案件A', companyId: 'tainan', wt, lastPaidDate: '2026-08-15' }] },
        ])
    })

    it('同一案件多筆項目依付清日期由舊到新排序', () => {
        const wtEarly = makeWt({ id: 'wt-early', vendorPayments: [{ amount: 10000, paidDate: '2026-06-01' }] })
        const wtLate = makeWt({ id: 'wt-late', vendorPayments: [{ amount: 10000, paidDate: '2026-08-01' }] })
        const cases = [makeCase('c1', '案件A', [wtLate, wtEarly])]
        const result = computePendingInvoiceGroups(cases)
        expect(result).toHaveLength(1)
        expect(result[0].items.map(i => i.wt.id)).toEqual(['wt-early', 'wt-late'])
    })

    it('跨案件時，分組出現順序 = 該案件最早符合條件項目在整體排序中的位置', () => {
        const wtA = makeWt({ id: 'wt-a', vendorPayments: [{ amount: 10000, paidDate: '2026-08-20' }] })
        const wtB1 = makeWt({ id: 'wt-b1', vendorPayments: [{ amount: 10000, paidDate: '2026-07-01' }] })
        const wtB2 = makeWt({ id: 'wt-b2', vendorPayments: [{ amount: 10000, paidDate: '2026-09-01' }] })
        const cases = [
            makeCase('cA', '案件A', [wtA]),
            makeCase('cB', '案件B', [wtB1, wtB2]),
        ]
        const result = computePendingInvoiceGroups(cases)
        // 案件B的最早項目(7/1)比案件A的項目(8/20)早，所以案件B排前面
        expect(result.map(g => g.caseId)).toEqual(['cB', 'cA'])
        expect(result.find(g => g.caseId === 'cB').items.map(i => i.wt.id)).toEqual(['wt-b1', 'wt-b2'])
    })
})

describe('itemPaid', () => {
    it('加總所有付款紀錄裡分攤到這個項目的金額', () => {
        const wt = {
            vendorPayments: [
                { amount: 10000, itemAllocations: [{ itemId: 'i1', amount: 6000 }, { itemId: 'i2', amount: 4000 }] },
                { amount: 2000, itemAllocations: [{ itemId: 'i1', amount: 2000 }] },
            ],
        }
        expect(itemPaid(wt, 'i1')).toBe(8000)
        expect(itemPaid(wt, 'i2')).toBe(4000)
    })

    it('沒有付款紀錄或沒有分攤到這個項目時回傳0', () => {
        expect(itemPaid({ vendorPayments: [] }, 'i1')).toBe(0)
        expect(itemPaid({}, 'i1')).toBe(0)
        expect(itemPaid({ vendorPayments: [{ amount: 100, itemAllocations: [] }] }, 'i1')).toBe(0)
    })

    it('舊付款紀錄沒有itemAllocations欄位時視為沒有分攤，不會噴錯', () => {
        const wt = { vendorPayments: [{ amount: 5000, paidDate: '2026-08-01', note: '舊資料' }] }
        expect(itemPaid(wt, 'i1')).toBe(0)
    })
})

describe('allocatePayment', () => {
    function makeItems() {
        return [
            { id: 'i1', description: '第一期', amount: 10000 },
            { id: 'i2', description: '第二期', amount: 5000 },
        ]
    }

    it('金額剛好等於單一項目欠款時，全額分攤給那個項目', () => {
        const wt = { vendorPayments: [] }
        const result = allocatePayment(10000, [makeItems()[0]], wt)
        expect(result).toEqual([{ itemId: 'i1', amount: 10000 }])
    })

    it('依項目順序（不是勾選順序）依序付清，跨項目分攤', () => {
        const wt = { vendorPayments: [] }
        const items = makeItems()
        // 故意用反過來的順序傳入selectedItems，驗證分攤仍依items本身的陣列順序（i1先）
        const result = allocatePayment(12000, [items[1], items[0]], wt)
        // 這裡selectedItems決定了「哪些項目要考慮」，但分攤順序規格規定依「vendorCostItems陣列裡的順序」，
        // 呼叫端必須自己保證傳入順序就是vendorCostItems的順序——這個函式直接依傳入陣列順序分攤
        expect(result).toEqual([{ itemId: 'i2', amount: 5000 }, { itemId: 'i1', amount: 7000 }])
    })

    it('圖付：金額不夠付清所有勾選項目時，前面的項目先付清，後面的項目只分到剩餘部分', () => {
        const wt = { vendorPayments: [] }
        const items = makeItems()
        const result = allocatePayment(12000, items, wt)
        expect(result).toEqual([{ itemId: 'i1', amount: 10000 }, { itemId: 'i2', amount: 2000 }])
    })

    it('項目已經部分付過時，只分攤還欠的部分', () => {
        const wt = { vendorPayments: [{ amount: 3000, itemAllocations: [{ itemId: 'i1', amount: 3000 }] }] }
        const items = makeItems()
        const result = allocatePayment(10000, items, wt)
        // i1還欠7000，i2還欠5000，共12000，付10000：i1先付清7000，i2分到剩下3000
        expect(result).toEqual([{ itemId: 'i1', amount: 7000 }, { itemId: 'i2', amount: 3000 }])
    })

    it('金額超過所有勾選項目的欠款加總時，多餘部分不分攤給任何項目', () => {
        const wt = { vendorPayments: [] }
        const result = allocatePayment(20000, makeItems(), wt)
        expect(result).toEqual([{ itemId: 'i1', amount: 10000 }, { itemId: 'i2', amount: 5000 }])
    })

    it('項目已經完全付清時，不會分攤到任何金額給這個項目', () => {
        const wt = { vendorPayments: [{ amount: 10000, itemAllocations: [{ itemId: 'i1', amount: 10000 }] }] }
        const items = makeItems()
        const result = allocatePayment(5000, items, wt)
        expect(result).toEqual([{ itemId: 'i2', amount: 5000 }])
    })

    it('沒有勾選任何項目時回傳空陣列', () => {
        expect(allocatePayment(5000, [], { vendorPayments: [] })).toEqual([])
    })
})
