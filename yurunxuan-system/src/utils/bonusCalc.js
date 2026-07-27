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
