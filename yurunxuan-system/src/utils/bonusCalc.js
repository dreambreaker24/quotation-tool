import { calcDrinkCost } from './marginAnalysis'
import { calcMonthlyAmortization } from './amortization'

export function calcQuarterRevenue(revenueLogs) {
    return (revenueLogs || []).reduce((sum, log) => sum + (log.amount || 0), 0)
}

export function calcCogs(revenueLogs, recipes, unitCostMap) {
    const bottlesByDrink = {}
    for (const log of (revenueLogs || [])) {
        for (const item of (log.items || [])) {
            bottlesByDrink[item.drinkId] = (bottlesByDrink[item.drinkId] || 0) + item.bottles
        }
    }

    let cogs = 0
    const unknownDrinkNames = []
    for (const [drinkId, bottles] of Object.entries(bottlesByDrink)) {
        const recipe = (recipes || []).find(r => r.id === drinkId)
        if (!recipe) continue
        const { cost, hasUnknownCost } = calcDrinkCost(recipe.ingredients, unitCostMap || {})
        if (hasUnknownCost) {
            unknownDrinkNames.push(recipe.name)
            continue
        }
        cogs += cost * bottles
    }
    return { cogs, unknownDrinkNames }
}

export function calcQuarterExpense(monthlyExpenses, expenseItems) {
    const fixedTotal = (monthlyExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)
    const amortizationTotal = (expenseItems || [])
        .reduce((sum, item) => sum + calcMonthlyAmortization(item.amount, item.amortizeMonths), 0) * 3
    return fixedTotal + amortizationTotal
}

export function calcQuarterProfit(revenue, cogs, expense) {
    return (Number(revenue) || 0) - (Number(cogs) || 0) - (Number(expense) || 0)
}

export function calcTeamBonusPool(profit, threshold, percent) {
    const excess = Math.max(0, (Number(profit) || 0) - (Number(threshold) || 0))
    return Math.floor(excess * (Number(percent) || 0) / 100)
}

export function splitTeamBonusEqually(poolAmount, participants) {
    const list = participants || []
    if (list.length === 0) return []
    const perPerson = Math.floor((Number(poolAmount) || 0) / list.length)
    return list.map(p => ({ uid: p.uid, name: p.name, amount: perPerson, paid: false, paidAt: null, paidBy: null }))
}

export function calcIndividualCommission(revenueLogs, participants, rate) {
    const logs = revenueLogs || []
    return (participants || []).map(p => {
        const personalRevenue = logs
            .filter(l => l.recordedByUid === p.uid)
            .reduce((sum, l) => sum + (l.amount || 0), 0)
        const suggestedAmount = Math.round(personalRevenue * (Number(rate) || 0) / 100)
        return {
            uid: p.uid, name: p.name, personalRevenue,
            rate: Number(rate) || 0,
            suggestedAmount, finalAmount: suggestedAmount,
            paid: false, paidAt: null, paidBy: null,
        }
    })
}

export function mergeRecalculatedEntries(newEntries, existingEntries) {
    const existing = existingEntries || []
    const existingByUid = new Map(existing.map(e => [e.uid, e]))
    const newUids = new Set(newEntries.map(e => e.uid))

    const result = newEntries.map(entry => {
        const match = existingByUid.get(entry.uid)
        return match?.paid ? match : entry
    })

    for (const entry of existing) {
        if (entry.paid && !newUids.has(entry.uid)) {
            result.push(entry)
        }
    }
    return result
}
