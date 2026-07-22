import { describe, it, expect } from 'vitest'
import { buildSaleItem, aggregateBottlesByDrink, calcSaleTotal, TIER_LABELS } from '@/utils/saleItems'

describe('buildSaleItem', () => {
  const recipe = {
    id: 'r1',
    name: '潤雪飲',
    pricing: {
      single: { price: 190, bottles: 1 },
      pack3: { price: 520, bottles: 3 },
      pack6: { price: 999, bottles: 6 }
    }
  }

  it('單瓶方案：組數 2 組，換算成 2 瓶、金額 380', () => {
    expect(buildSaleItem(recipe, 'single', 2)).toEqual({
      drinkId: 'r1', drinkName: '潤雪飲', tier: 'single', tierLabel: '單瓶',
      qty: 2, bottles: 2, subtotal: 380
    })
  })

  it('3入組方案：組數 1 組，換算成 3 瓶、金額 520', () => {
    expect(buildSaleItem(recipe, 'pack3', 1)).toEqual({
      drinkId: 'r1', drinkName: '潤雪飲', tier: 'pack3', tierLabel: '3入組',
      qty: 1, bottles: 3, subtotal: 520
    })
  })

  it('組數不是正數時拋出錯誤', () => {
    expect(() => buildSaleItem(recipe, 'single', 0)).toThrow('組數必須是正數')
    expect(() => buildSaleItem(recipe, 'single', -1)).toThrow('組數必須是正數')
    expect(() => buildSaleItem(recipe, 'single', null)).toThrow('組數必須是正數')
  })

  it('該方案沒有設定售價（price 為 0 或缺欄位）時拋出錯誤', () => {
    const noPricing = { id: 'r2', name: '潤澤飲', pricing: { single: { price: 0, bottles: 1 } } }
    expect(() => buildSaleItem(noPricing, 'single', 1)).toThrow('這款飲品尚未設定售價，請先到主檔資料的配方表設定')
    expect(() => buildSaleItem(noPricing, 'pack3', 1)).toThrow('這款飲品尚未設定售價，請先到主檔資料的配方表設定')
  })

  it('recipe 完全沒有 pricing 欄位時也拋出同樣錯誤', () => {
    const legacyRecipe = { id: 'r3', name: '潤潤飲' }
    expect(() => buildSaleItem(legacyRecipe, 'single', 1)).toThrow('這款飲品尚未設定售價，請先到主檔資料的配方表設定')
  })
})

describe('aggregateBottlesByDrink', () => {
  it('同一款飲品出現在多個品項（不同方案）時，瓶數要加總', () => {
    const items = [
      { drinkId: 'r1', bottles: 2 },
      { drinkId: 'r1', bottles: 3 }
    ]
    expect(aggregateBottlesByDrink(items)).toEqual([{ drinkId: 'r1', bottles: 5 }])
  })

  it('不同飲品各自獨立列出', () => {
    const items = [
      { drinkId: 'r1', bottles: 2 },
      { drinkId: 'r2', bottles: 6 }
    ]
    expect(aggregateBottlesByDrink(items)).toEqual([
      { drinkId: 'r1', bottles: 2 },
      { drinkId: 'r2', bottles: 6 }
    ])
  })

  it('空陣列回傳空陣列', () => {
    expect(aggregateBottlesByDrink([])).toEqual([])
  })
})

describe('calcSaleTotal', () => {
  it('加總所有品項的 subtotal', () => {
    const items = [{ subtotal: 380 }, { subtotal: 520 }]
    expect(calcSaleTotal(items)).toBe(900)
  })

  it('空陣列回傳 0', () => {
    expect(calcSaleTotal([])).toBe(0)
  })
})

describe('TIER_LABELS', () => {
  it('三個方案代號都要有對應中文標籤', () => {
    expect(TIER_LABELS).toEqual({ single: '單瓶', pack3: '3入組', pack6: '6入組' })
  })
})
