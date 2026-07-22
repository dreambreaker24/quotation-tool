import { describe, it, expect } from 'vitest'
import { calcDrinkCost, calcTierMargins } from '@/utils/marginAnalysis'

describe('calcDrinkCost', () => {
  it('所有原料都有進貨單價時，正確加總成本', () => {
    const ingredients = [
      { materialId: 'm1', qtyPerUnit: 2 },
      { materialId: 'm2', qtyPerUnit: 3 }
    ]
    const unitCostMap = { m1: 10, m2: 5 }
    expect(calcDrinkCost(ingredients, unitCostMap)).toEqual({ cost: 35, hasUnknownCost: false })
  })

  it('任一原料從未進貨過（unitCostMap 裡沒有這個 materialId）時，整款飲品成本標記為未知', () => {
    const ingredients = [
      { materialId: 'm1', qtyPerUnit: 2 },
      { materialId: 'm3', qtyPerUnit: 1 }
    ]
    const unitCostMap = { m1: 10 }
    expect(calcDrinkCost(ingredients, unitCostMap)).toEqual({ cost: null, hasUnknownCost: true })
  })

  it('沒有任何用料時成本是 0', () => {
    expect(calcDrinkCost([], {})).toEqual({ cost: 0, hasUnknownCost: false })
  })

  it('ingredients 是 undefined 時當成空陣列處理', () => {
    expect(calcDrinkCost(undefined, {})).toEqual({ cost: 0, hasUnknownCost: false })
  })
})

describe('calcTierMargins', () => {
  const pricing = {
    single: { price: 190, bottles: 1 },
    pack3: { price: 520, bottles: 3 },
    pack6: { price: 999, bottles: 6 }
  }

  it('三層各自用「每瓶均價」算出對應的毛利率', () => {
    const result = calcTierMargins(pricing, 50)
    expect(result.single).toBeCloseTo((190 - 50) / 190)
    expect(result.pack3).toBeCloseTo((520 / 3 - 50) / (520 / 3))
    expect(result.pack6).toBeCloseTo((999 / 6 - 50) / (999 / 6))
  })

  it('成本是 null（未知）時，三層毛利率都回傳 null', () => {
    const result = calcTierMargins(pricing, null)
    expect(result).toEqual({ single: null, pack3: null, pack6: null })
  })

  it('該層沒有設定售價（price 為 0 或缺欄位）時，那一層回傳 null', () => {
    const noPricing = { single: { price: 0, bottles: 1 } }
    const result = calcTierMargins(noPricing, 50)
    expect(result.single).toBeNull()
    expect(result.pack3).toBeNull()
    expect(result.pack6).toBeNull()
  })
})
