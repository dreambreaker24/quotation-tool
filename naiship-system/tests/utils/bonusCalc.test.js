import { describe, it, expect } from 'vitest'
import { isEligibleByAmount, calcTier, calcDesignerBonus, calcSalesBonus } from '@/utils/bonusCalc'

describe('isEligibleByAmount', () => {
    it('案件金額剛好 50 萬時不合格（要求「超過」）', () => {
        expect(isEligibleByAmount(500000)).toBe(false)
    })
    it('案件金額超過 50 萬 1 元就合格', () => {
        expect(isEligibleByAmount(500001)).toBe(true)
    })
    it('沒有金額（0/null/undefined）不合格', () => {
        expect(isEligibleByAmount(0)).toBe(false)
        expect(isEligibleByAmount(null)).toBe(false)
        expect(isEligibleByAmount(undefined)).toBe(false)
    })
})

describe('calcTier', () => {
    it('未達門檻回傳 0 級', () => {
        expect(calcTier(500000)).toBe(0)
    })
    it('50~100 萬（含 100 萬整）算第 1 級', () => {
        expect(calcTier(500001)).toBe(1)
        expect(calcTier(1000000)).toBe(1)
    })
    it('超過 100 萬 1 元跳到第 2 級', () => {
        expect(calcTier(1000001)).toBe(2)
    })
    it('剛好 250~300 萬區間算第 5 級', () => {
        expect(calcTier(3000000)).toBe(5)
    })
    it('超過 300 萬依同樣級距繼續遞增（第 6 級）', () => {
        expect(calcTier(3000001)).toBe(6)
    })
    it('大型案件（3012 萬 2570 元）算到第 60 級', () => {
        expect(calcTier(30122570)).toBe(60)
    })
})

describe('calcDesignerBonus', () => {
    it('未達門檻回傳 0', () => {
        expect(calcDesignerBonus(500000)).toBe(0)
    })
    it('第 1 級是 3000 元', () => {
        expect(calcDesignerBonus(1000000)).toBe(3000)
    })
    it('第 4 級（200~250 萬）是 12000 元', () => {
        expect(calcDesignerBonus(2500000)).toBe(12000)
    })
})

describe('calcSalesBonus', () => {
    it('未達 50 萬門檻回傳 0，不管設計/工程約金額多少', () => {
        expect(calcSalesBonus(1000000, 0, 500000)).toBe(0)
    })
    it('設計約金額 x 4% + 工程約金額 x 1.25%，不扣 5% 管銷', () => {
        expect(calcSalesBonus(1000000, 800000, 1800000)).toBe(1000000 * 0.04 + 800000 * 0.0125)
    })
    it('金額不是整除時四捨五入到整數元', () => {
        expect(calcSalesBonus(0, 7654321, 8000000)).toBe(Math.round(7654321 * 0.0125))
    })
    it('只有設計約金額也能算', () => {
        expect(calcSalesBonus(1000000, 0, 1000000)).toBe(1000000 * 0.04)
    })
})

import { sumVendorCost, calcProfitMargin, calcSiteManagerBonus, splitBonus } from '@/utils/bonusCalc'

describe('sumVendorCost', () => {
    it('加總所有工種的 vendorCostItems', () => {
        const workTypes = [
            { vendorCostItems: [{ amount: 10000 }, { amount: 5000 }] },
            { vendorCostItems: [{ amount: 20000 }] },
        ]
        expect(sumVendorCost(workTypes)).toBe(35000)
    })
    it('沒有工種或空陣列回傳 0', () => {
        expect(sumVendorCost([])).toBe(0)
        expect(sumVendorCost(undefined)).toBe(0)
    })
})

describe('calcProfitMargin', () => {
    it('利潤 = 簽約金額 x 0.95 - 廠商成本 - 雜支，利潤率 = 利潤 / 簽約金額', () => {
        const margin = calcProfitMargin(1000000, 400000, 50000)
        expect(margin).toBeCloseTo((1000000 * 0.95 - 400000 - 50000) / 1000000, 6)
    })
    it('沒有簽約金額回傳 0，避免除以 0', () => {
        expect(calcProfitMargin(0, 100, 100)).toBe(0)
    })
})

describe('calcSiteManagerBonus', () => {
    it('利潤率剛好 25% 仍然發獎金', () => {
        const signedAmount = 1000000
        const profit = signedAmount * 0.25
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(5000)
    })
    it('利潤率低於 25%（24.99%）強制歸零', () => {
        const signedAmount = 1000000
        const profit = signedAmount * 0.2499
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(0)
    })
    it('未達 50 萬門檻直接 0，不看利潤率', () => {
        expect(calcSiteManagerBonus(400000, 0, 0)).toBe(0)
    })
    it('範例案例：簽約 30,122,570、利潤率 47% -> 300,000 元', () => {
        const signedAmount = 30122570
        const profit = signedAmount * 0.47
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(300000)
    })
})

describe('splitBonus', () => {
    it('沒有人負責回傳空物件', () => {
        expect(splitBonus(10000, [], {})).toEqual({})
    })
    it('單人負責拿全額', () => {
        expect(splitBonus(9000, ['u1'], {})).toEqual({ u1: 9000 })
    })
    it('兩人沒填分比時均分', () => {
        expect(splitBonus(10000, ['u1', 'u2'], {})).toEqual({ u1: 5000, u2: 5000 })
    })
    it('三人沒填分比時均分，餘數算給最後一人', () => {
        const result = splitBonus(10000, ['u1', 'u2', 'u3'], {})
        expect(result.u1 + result.u2 + result.u3).toBe(10000)
        expect(result.u1).toBe(3333)
        expect(result.u2).toBe(3333)
        expect(result.u3).toBe(3334)
    })
    it('有填自訂分比時依比例分配', () => {
        expect(splitBonus(10000, ['u1', 'u2'], { u1: 70, u2: 30 })).toEqual({ u1: 7000, u2: 3000 })
    })
})
