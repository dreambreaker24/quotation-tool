import { describe, it, expect } from 'vitest'
import { calcProductionDeductions, isLowStock } from '@/utils/stockTransaction'

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
  it('qty 是負數時回傳空陣列，不會變成錯誤地加庫存', () => {
    const ingredients = [{ materialId: 'm1', qtyPerUnit: 30 }]
    expect(calcProductionDeductions(ingredients, -5)).toEqual([])
  })
  it('qty 是 0 時回傳空陣列', () => {
    const ingredients = [{ materialId: 'm1', qtyPerUnit: 30 }]
    expect(calcProductionDeductions(ingredients, 0)).toEqual([])
  })
  it('qty 是 NaN 或 undefined 時回傳空陣列，不會產生 NaN 扣庫存量', () => {
    const ingredients = [{ materialId: 'm1', qtyPerUnit: 30 }]
    expect(calcProductionDeductions(ingredients, NaN)).toEqual([])
    expect(calcProductionDeductions(ingredients, undefined)).toEqual([])
  })
  it('配方裡同一個原料重複出現時，扣除量要合併加總而不是各自獨立（避免 Firestore Transaction 覆蓋問題）', () => {
    const ingredients = [
      { materialId: 'm1', qtyPerUnit: 10 },
      { materialId: 'm1', qtyPerUnit: 5 }
    ]
    expect(calcProductionDeductions(ingredients, 2)).toEqual([
      { materialId: 'm1', delta: -30 }
    ])
  })
})

describe('isLowStock', () => {
  it('安全庫存大於 0 且目前庫存低於安全庫存時回傳 true', () => {
    expect(isLowStock({ currentStock: 2, safetyStock: 5 })).toBe(true)
  })
  it('目前庫存大於等於安全庫存時回傳 false', () => {
    expect(isLowStock({ currentStock: 5, safetyStock: 5 })).toBe(false)
    expect(isLowStock({ currentStock: 8, safetyStock: 5 })).toBe(false)
  })
  it('安全庫存是 0 或未設定時一律回傳 false（代表還沒設定，不當成低庫存）', () => {
    expect(isLowStock({ currentStock: 0, safetyStock: 0 })).toBe(false)
    expect(isLowStock({ currentStock: 0 })).toBe(false)
  })
})
