export const TIER_LABELS = { single: '單瓶', pack3: '3入組', pack6: '6入組' }

export function buildSaleItem(recipe, tier, qty) {
    const validQty = Number(qty)
    if (!Number.isFinite(validQty) || validQty <= 0) {
        throw new Error('組數必須是正數')
    }
    const tierInfo = recipe?.pricing?.[tier]
    if (!tierInfo || !tierInfo.price) {
        throw new Error('這款飲品尚未設定售價，請先到主檔資料的配方表設定')
    }
    return {
        drinkId: recipe.id,
        drinkName: recipe.name,
        tier,
        tierLabel: TIER_LABELS[tier],
        qty: validQty,
        bottles: tierInfo.bottles * validQty,
        subtotal: tierInfo.price * validQty
    }
}

export function aggregateBottlesByDrink(items) {
    const map = new Map()
    for (const item of items) {
        map.set(item.drinkId, (map.get(item.drinkId) || 0) + item.bottles)
    }
    return Array.from(map, ([drinkId, bottles]) => ({ drinkId, bottles }))
}

export function calcSaleTotal(items) {
    return items.reduce((sum, item) => sum + item.subtotal, 0)
}
