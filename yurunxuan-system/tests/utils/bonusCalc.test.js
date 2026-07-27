import { describe, it, expect } from 'vitest'
import { calcQuarterRevenue, calcCogs, calcQuarterExpense, calcQuarterProfit } from '../../src/utils/bonusCalc'

describe('calcQuarterRevenue', () => {
  it('加總所有營收紀錄的 amount', () => {
    expect(calcQuarterRevenue([{ amount: 10000 }, { amount: 25000 }])).toBe(35000)
  })
  it('沒有紀錄回傳 0', () => {
    expect(calcQuarterRevenue([])).toBe(0)
  })
})

describe('calcCogs', () => {
  const recipes = [
    { id: 'd1', name: '潤雪飲', ingredients: [{ materialId: 'm1', qtyPerUnit: 2 }] },
    { id: 'd2', name: '潤澤飲', ingredients: [{ materialId: 'm2', qtyPerUnit: 1 }] },
  ]

  it('依每季賣出瓶數乘上單瓶成本加總', () => {
    const revenueLogs = [
      { items: [{ drinkId: 'd1', bottles: 10 }, { drinkId: 'd2', bottles: 5 }] },
      { items: [{ drinkId: 'd1', bottles: 3 }] },
    ]
    const unitCostMap = { m1: 5, m2: 10 }
    const result = calcCogs(revenueLogs, recipes, unitCostMap)
    // d1: 單瓶成本 2*5=10，共 13 瓶 → 130；d2: 單瓶成本 1*10=10，共 5 瓶 → 50
    expect(result.cogs).toBe(180)
    expect(result.unknownDrinkNames).toEqual([])
  })

  it('缺少進貨資料的飲品成本記 0，並列入 unknownDrinkNames 警示', () => {
    const revenueLogs = [{ items: [{ drinkId: 'd1', bottles: 10 }, { drinkId: 'd2', bottles: 5 }] }]
    const unitCostMap = { m1: 5 } // 缺 m2
    const result = calcCogs(revenueLogs, recipes, unitCostMap)
    expect(result.cogs).toBe(100) // 只有 d1 的 100，d2 不計入
    expect(result.unknownDrinkNames).toEqual(['潤澤飲'])
  })

  it('沒有任何營收紀錄回傳 0', () => {
    const result = calcCogs([], recipes, {})
    expect(result.cogs).toBe(0)
    expect(result.unknownDrinkNames).toEqual([])
  })

  it('品項對應不到任何配方時直接跳過，不報錯', () => {
    const revenueLogs = [{ items: [{ drinkId: 'deleted-drink', bottles: 5 }] }]
    const result = calcCogs(revenueLogs, recipes, { m1: 5, m2: 10 })
    expect(result.cogs).toBe(0)
    expect(result.unknownDrinkNames).toEqual([])
  })
})

describe('calcQuarterExpense', () => {
  it('固定支出加總 + 攤提月額 × 3 個月', () => {
    const monthlyExpenses = [{ amount: 5000 }, { amount: 3000 }]
    const expenseItems = [{ amount: 12000, amortizeMonths: 12 }] // 每月攤提 1000
    expect(calcQuarterExpense(monthlyExpenses, expenseItems)).toBe(8000 + 1000 * 3)
  })
  it('沒有固定支出跟開店項目回傳 0', () => {
    expect(calcQuarterExpense([], [])).toBe(0)
  })
})

describe('calcQuarterProfit', () => {
  it('營收減 COGS 減支出', () => {
    expect(calcQuarterProfit(100000, 30000, 20000)).toBe(50000)
  })
  it('可以是負數（虧損）', () => {
    expect(calcQuarterProfit(10000, 30000, 20000)).toBe(-40000)
  })
})
