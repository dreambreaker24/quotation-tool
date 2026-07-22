export function calcDrinkCost(ingredients, unitCostMap) {
    let cost = 0
    for (const ing of (ingredients || [])) {
        const unitCost = unitCostMap[ing.materialId]
        if (unitCost === undefined) {
            return { cost: null, hasUnknownCost: true }
        }
        cost += unitCost * (Number(ing.qtyPerUnit) || 0)
    }
    return { cost, hasUnknownCost: false }
}

export function calcTierMargins(pricing, unitCost) {
    const tiers = ['single', 'pack3', 'pack6']
    const result = {}
    for (const tier of tiers) {
        const tierInfo = pricing?.[tier]
        if (!tierInfo || !tierInfo.price || unitCost === null || unitCost === undefined) {
            result[tier] = null
            continue
        }
        const avgPricePerBottle = tierInfo.price / tierInfo.bottles
        result[tier] = (avgPricePerBottle - unitCost) / avgPricePerBottle
    }
    return result
}
