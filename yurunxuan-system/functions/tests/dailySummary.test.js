import { describe, it, expect } from 'vitest'
import { aggregateDailyStats, buildDailySummaryText } from '../dailySummary.js'

describe('aggregateDailyStats', () => {
    const recipes = [
        { id: 'r1', name: '潤雪飲' },
        { id: 'r2', name: '潤澤飲' }
    ]

    it('沒有任何紀錄時，每款飲品都回傳 0，庫存照樣顯示', () => {
        const result = aggregateDailyStats({
            recipes,
            productionDocs: [],
            revenueDocs: [],
            wasteDocs: [],
            currentStockByDrink: { r1: 40, r2: 10 }
        })
        expect(result).toEqual([
            { drinkId: 'r1', drinkName: '潤雪飲', produced: 0, sold: 0, wasted: 0, currentStock: 40 },
            { drinkId: 'r2', drinkName: '潤澤飲', produced: 0, sold: 0, wasted: 0, currentStock: 10 }
        ])
    })

    it('正確加總生產、銷售（來自 items 陣列）、報廢（僅 type 為 drink 的才算）', () => {
        const result = aggregateDailyStats({
            recipes,
            productionDocs: [
                { drinkId: 'r1', qty: 30 },
                { drinkId: 'r1', qty: 10 }
            ],
            revenueDocs: [
                { items: [{ drinkId: 'r1', bottles: 5 }, { drinkId: 'r2', bottles: 2 }] },
                { items: [{ drinkId: 'r1', bottles: 3 }] }
            ],
            wasteDocs: [
                { type: 'drink', drinkId: 'r1', qty: 2 },
                { type: 'material', materialId: 'm1', qty: 100 }
            ],
            currentStockByDrink: { r1: 38, r2: 8 }
        })
        expect(result).toEqual([
            { drinkId: 'r1', drinkName: '潤雪飲', produced: 40, sold: 8, wasted: 2, currentStock: 38 },
            { drinkId: 'r2', drinkName: '潤澤飲', produced: 0, sold: 2, wasted: 0, currentStock: 8 }
        ])
    })

    it('沒有設定 currentStockByDrink 的飲品，庫存視為 0', () => {
        const result = aggregateDailyStats({
            recipes,
            productionDocs: [],
            revenueDocs: [],
            wasteDocs: [],
            currentStockByDrink: {}
        })
        expect(result[0].currentStock).toBe(0)
        expect(result[1].currentStock).toBe(0)
    })
})

describe('buildDailySummaryText', () => {
    it('沒有任何配方時回傳提示文字', () => {
        expect(buildDailySummaryText([])).toBe('目前尚未設定任何配方')
    })

    it('組成每款飲品一行的摘要文字', () => {
        const text = buildDailySummaryText([
            { drinkId: 'r1', drinkName: '潤雪飲', produced: 40, sold: 8, wasted: 2, currentStock: 38 },
            { drinkId: 'r2', drinkName: '潤澤飲', produced: 0, sold: 2, wasted: 0, currentStock: 8 }
        ])
        expect(text).toBe(
            '潤雪飲：生產 40／銷售 8／報廢 2，目前庫存 38 杯\n' +
            '潤澤飲：生產 0／銷售 2／報廢 0，目前庫存 8 杯'
        )
    })
})
