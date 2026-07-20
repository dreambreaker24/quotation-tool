export function calcMonthlyAmortization(amount, amortizeMonths) {
    if (!amount || !amortizeMonths) return 0
    return Math.round(amount / amortizeMonths)
}
