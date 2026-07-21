export function calcProductionDeductions(ingredients, qty) {
    return (ingredients || []).map(ing => ({
        materialId: ing.materialId,
        delta: -(Number(ing.qtyPerUnit) || 0) * qty
    }))
}
