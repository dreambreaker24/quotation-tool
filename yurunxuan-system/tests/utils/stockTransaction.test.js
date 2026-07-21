import { describe, it, expect } from 'vitest'
import { calcProductionDeductions } from '@/utils/stockTransaction'

describe('calcProductionDeductions', () => {
  it('依配方用量乘以生產杯數，算出每項原料要扣多少（負數）', () => {
    const ingredients = [
      { materialId: 'm1', qtyPerUnit: 30 },
      { materialId: 'm2', qtyPerUnit: 7 }
    ]
    expect(calcProductionDeductions(ingredients, 20)).toEqual([
      { materialId: 'm1', delta: -600 },
      { materialId: 'm2', delta: -140 }
    ])
  })
  it('生產杯數是小數也要正確計算（例如半批）', () => {
    const ingredients = [{ materialId: 'm1', qtyPerUnit: 10 }]
    expect(calcProductionDeductions(ingredients, 2.5)).toEqual([
      { materialId: 'm1', delta: -25 }
    ])
  })
  it('配方是空陣列時回傳空陣列', () => {
    expect(calcProductionDeductions([], 10)).toEqual([])
  })
  it('配方是 null/undefined 時回傳空陣列，不報錯', () => {
    expect(calcProductionDeductions(null, 10)).toEqual([])
    expect(calcProductionDeductions(undefined, 10)).toEqual([])
  })
  it('qtyPerUnit 是字串型別時也要正確轉數字計算', () => {
    const ingredients = [{ materialId: 'm1', qtyPerUnit: '30' }]
    expect(calcProductionDeductions(ingredients, 2)).toEqual([
      { materialId: 'm1', delta: -60 }
    ])
  })
})
