export const THRESHOLD_AMOUNT = 500000
export const TIER_STEP = 500000
export const DESIGNER_TIER_BONUS = 3000
export const SITE_MANAGER_TIER_BONUS = 5000
export const MANAGEMENT_FEE_RATE = 0.05
export const MIN_PROFIT_MARGIN = 0.25
export const SALES_DESIGN_RATE = 0.04
export const SALES_CONSTRUCTION_RATE = 0.0125

export function isEligibleByAmount(signedAmount) {
    return (signedAmount || 0) > THRESHOLD_AMOUNT
}

export function calcTier(signedAmount) {
    if (!isEligibleByAmount(signedAmount)) return 0
    return Math.ceil((signedAmount - THRESHOLD_AMOUNT) / TIER_STEP)
}

export function calcDesignerBonus(signedAmount) {
    return calcTier(signedAmount) * DESIGNER_TIER_BONUS
}

export function calcSalesBonus(designContractAmount, constructionContractAmount, signedAmount) {
    if (!isEligibleByAmount(signedAmount)) return 0
    return Math.round((designContractAmount || 0) * SALES_DESIGN_RATE + (constructionContractAmount || 0) * SALES_CONSTRUCTION_RATE)
}

export function sumVendorCost(workTypes) {
    return (workTypes || []).reduce((sum, wt) =>
        sum + (wt.vendorCostItems || []).reduce((s, i) => s + (i.amount || 0), 0), 0)
}

export function calcProfitMargin(signedAmount, vendorCostTotal, miscExpenses) {
    if (!signedAmount) return 0
    const profit = signedAmount * (1 - MANAGEMENT_FEE_RATE) - (vendorCostTotal || 0) - (miscExpenses || 0)
    return profit / signedAmount
}

export function calcSiteManagerBonus(signedAmount, vendorCostTotal, miscExpenses) {
    if (!isEligibleByAmount(signedAmount)) return 0
    const margin = calcProfitMargin(signedAmount, vendorCostTotal, miscExpenses)
    if (margin < MIN_PROFIT_MARGIN) return 0
    return calcTier(signedAmount) * SITE_MANAGER_TIER_BONUS
}

export function splitBonus(totalAmount, personIds, splitMap) {
    const ids = personIds || []
    if (ids.length === 0) return {}
    const hasCustomSplit = !!splitMap && ids.every(id => typeof splitMap[id] === 'number')
    if (hasCustomSplit) {
        const result = {}
        ids.forEach(id => {
            result[id] = Math.round(totalAmount * splitMap[id] / 100)
        })
        return result
    } else {
        const result = {}
        const perPerson = Math.floor(totalAmount / ids.length)
        const remainder = totalAmount % ids.length
        ids.forEach((id, i) => {
            result[id] = i === ids.length - 1 ? perPerson + remainder : perPerson
        })
        return result
    }
}
