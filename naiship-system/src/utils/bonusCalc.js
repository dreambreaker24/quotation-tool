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
    return (designContractAmount || 0) * SALES_DESIGN_RATE + (constructionContractAmount || 0) * SALES_CONSTRUCTION_RATE
}
