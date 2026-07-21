export function calcProductionDeductions(ingredients, qty) {
    const validQty = Number(qty)
    if (!Number.isFinite(validQty) || validQty <= 0) return []
    return (ingredients || []).map(ing => ({
        materialId: ing.materialId,
        delta: -(Number(ing.qtyPerUnit) || 0) * validQty
    }))
}
