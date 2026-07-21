export function calcProductionDeductions(ingredients, qty) {
    const validQty = Number(qty)
    if (!Number.isFinite(validQty) || validQty <= 0) return []
    const deltaMap = new Map()
    for (const ing of (ingredients || [])) {
        const delta = -(Number(ing.qtyPerUnit) || 0) * validQty
        deltaMap.set(ing.materialId, (deltaMap.get(ing.materialId) || 0) + delta)
    }
    return Array.from(deltaMap, ([materialId, delta]) => ({ materialId, delta }))
}
