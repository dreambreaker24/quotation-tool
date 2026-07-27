import { describe, it, expect } from 'vitest'
import { calcQuarterRevenue, calcCogs, calcQuarterExpense, calcQuarterProfit, calcTeamBonusPool, splitTeamBonusEqually, calcIndividualCommission, mergeRecalculatedEntries } from '../../src/utils/bonusCalc'

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

describe('calcTeamBonusPool', () => {
  it('超過門檻的部分乘上百分比', () => {
    expect(calcTeamBonusPool(700000, 600000, 10)).toBe(10000)
  })
  it('沒超過門檻回傳 0，不發負數', () => {
    expect(calcTeamBonusPool(500000, 600000, 10)).toBe(0)
  })
  it('門檻或百分比未設定（undefined）視為 0', () => {
    expect(calcTeamBonusPool(700000, undefined, undefined)).toBe(0)
  })
})

describe('splitTeamBonusEqually', () => {
  const participants = [{ uid: 'u1', name: 'A' }, { uid: 'u2', name: 'B' }, { uid: 'u3', name: 'C' }]

  it('均分獎金池，無條件捨去', () => {
    const result = splitTeamBonusEqually(10000, participants)
    expect(result).toEqual([
      { uid: 'u1', name: 'A', amount: 3333, paid: false, paidAt: null, paidBy: null },
      { uid: 'u2', name: 'B', amount: 3333, paid: false, paidAt: null, paidBy: null },
      { uid: 'u3', name: 'C', amount: 3333, paid: false, paidAt: null, paidBy: null },
    ])
  })
  it('沒有參與人回傳空陣列', () => {
    expect(splitTeamBonusEqually(10000, [])).toEqual([])
  })
  it('獎金池為 0 每人也是 0', () => {
    const result = splitTeamBonusEqually(0, participants)
    expect(result.every(r => r.amount === 0)).toBe(true)
  })
})

describe('calcIndividualCommission', () => {
  const participants = [{ uid: 'u1', name: 'A' }, { uid: 'u2', name: 'B' }]

  it('依 recordedByUid 分組加總，乘上抽成率', () => {
    const revenueLogs = [
      { amount: 1000, recordedByUid: 'u1' },
      { amount: 2000, recordedByUid: 'u2' },
      { amount: 500, recordedByUid: 'u1' },
    ]
    const result = calcIndividualCommission(revenueLogs, participants, 5)
    expect(result).toEqual([
      { uid: 'u1', name: 'A', personalRevenue: 1500, rate: 5, suggestedAmount: 75, finalAmount: 75, paid: false, paidAt: null, paidBy: null },
      { uid: 'u2', name: 'B', personalRevenue: 2000, rate: 5, suggestedAmount: 100, finalAmount: 100, paid: false, paidAt: null, paidBy: null },
    ])
  })
  it('該員工完全沒有登記銷售，金額都是 0', () => {
    const result = calcIndividualCommission([], participants, 5)
    expect(result.every(r => r.personalRevenue === 0 && r.suggestedAmount === 0)).toBe(true)
  })
})

describe('mergeRecalculatedEntries', () => {
  it('沒有既有紀錄時，直接回傳新算出的結果', () => {
    const fresh = [{ uid: 'u1', amount: 100, paid: false }]
    expect(mergeRecalculatedEntries(fresh, [])).toEqual(fresh)
  })
  it('已標記已發放的人保留原本數值，不被新試算覆蓋', () => {
    const fresh = [{ uid: 'u1', amount: 999, paid: false }, { uid: 'u2', amount: 100, paid: false }]
    const existing = [{ uid: 'u1', amount: 500, paid: true, paidAt: 'x', paidBy: '柏' }]
    const result = mergeRecalculatedEntries(fresh, existing)
    expect(result).toEqual([
      { uid: 'u1', amount: 500, paid: true, paidAt: 'x', paidBy: '柏' },
      { uid: 'u2', amount: 100, paid: false },
    ])
  })
  it('未標記已發放的人被新算出的數值覆蓋', () => {
    const fresh = [{ uid: 'u1', amount: 999, paid: false }]
    const existing = [{ uid: 'u1', amount: 500, paid: false }]
    expect(mergeRecalculatedEntries(fresh, existing)).toEqual(fresh)
  })
  it('已發放但目前不在名單中的人（例如帳號被移除）仍要保留，不遺失發放紀錄', () => {
    const fresh = [{ uid: 'u2', amount: 100, paid: false }]
    const existing = [{ uid: 'u1', amount: 500, paid: true, paidAt: 'x', paidBy: '柏' }]
    const result = mergeRecalculatedEntries(fresh, existing)
    expect(result).toEqual([
      { uid: 'u2', amount: 100, paid: false },
      { uid: 'u1', amount: 500, paid: true, paidAt: 'x', paidBy: '柏' },
    ])
  })
})
