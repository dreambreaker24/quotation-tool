export function aggregateDailyStats({ recipes, productionDocs, revenueDocs, wasteDocs, currentStockByDrink }) {
    const statsByDrink = new Map()
    for (const recipe of recipes) {
        statsByDrink.set(recipe.id, {
            drinkId: recipe.id,
            drinkName: recipe.name,
            produced: 0,
            sold: 0,
            wasted: 0,
            currentStock: currentStockByDrink[recipe.id] || 0
        })
    }

    for (const doc of productionDocs) {
        const stat = statsByDrink.get(doc.drinkId)
        if (stat) stat.produced += doc.qty
    }

    for (const doc of revenueDocs) {
        for (const item of doc.items) {
            const stat = statsByDrink.get(item.drinkId)
            if (stat) stat.sold += item.bottles
        }
    }

    for (const doc of wasteDocs) {
        if (doc.type !== 'drink') continue
        const stat = statsByDrink.get(doc.drinkId)
        if (stat) stat.wasted += doc.qty
    }

    return Array.from(statsByDrink.values())
}

export function buildDailySummaryText(drinkStats) {
    if (drinkStats.length === 0) return '目前尚未設定任何配方'
    return drinkStats
        .map(d => `${d.drinkName}：生產 ${d.produced}／銷售 ${d.sold}／報廢 ${d.wasted}，目前庫存 ${d.currentStock} 杯`)
        .join('\n')
}
