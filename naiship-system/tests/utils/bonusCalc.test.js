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
