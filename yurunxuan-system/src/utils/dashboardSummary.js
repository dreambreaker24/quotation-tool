export function calcMonthlyProfit(revenueTotal, monthlyExpenseTotal, amortizationTotal) {
    const revenue = Number(revenueTotal) || 0
    const expense = (Number(monthlyExpenseTotal) || 0) + (Number(amortizationTotal) || 0)
    return revenue - expense
}
