import { describe, it, expect } from 'vitest'
import { calcBalance, summarizeMonth, buildPettyCashExportRows } from '../../src/utils/pettyCashSummary'

describe('calcBalance', () => {
    it('沒有任何紀錄時餘額是 0', () => {
        expect(calcBalance([])).toBe(0)
    })

    it('撥入加、支出減，持續累積不分月份', () => {
        const entries = [
            { type: 'topup', amount: 10000 },
            { type: 'expense', amount: 3000 },
            { type: 'topup', amount: 5000 },
            { type: 'expense', amount: 1000 },
        ]
        expect(calcBalance(entries)).toBe(11000)
    })

    it('缺少 amount 欄位視為 0', () => {
        expect(calcBalance([{ type: 'topup' }])).toBe(0)
    })
})

describe('summarizeMonth', () => {
    const entries = [
        { date: '2026-07-05', type: 'topup', amount: 10000 },
        { date: '2026-07-10', type: 'expense', amount: 2000 },
        { date: '2026-07-20', type: 'expense', amount: 1500 },
        { date: '2026-06-28', type: 'topup', amount: 8000 },
    ]

    it('只篩出指定月份的紀錄，並依日期排序', () => {
        const result = summarizeMonth(entries, '2026-07')
        expect(result.entries.map(e => e.date)).toEqual(['2026-07-05', '2026-07-10', '2026-07-20'])
    })

    it('正確加總該月撥入與支出', () => {
        const result = summarizeMonth(entries, '2026-07')
        expect(result.totalTopup).toBe(10000)
        expect(result.totalExpense).toBe(3500)
    })

    it('該月沒有任何紀錄時，加總都是 0', () => {
        const result = summarizeMonth(entries, '2026-08')
        expect(result.entries).toEqual([])
        expect(result.totalTopup).toBe(0)
        expect(result.totalExpense).toBe(0)
    })
})

describe('buildPettyCashExportRows', () => {
    it('組出每筆紀錄一行，支出金額記負數，最後加一行合計', () => {
        const entries = [
            { date: '2026-07-05', type: 'topup', amount: 10000, category: '', description: '週轉金', hasReceipt: false },
            { date: '2026-07-10', type: 'expense', amount: 2000, category: '原料採購', description: '買白木耳', hasReceipt: true },
        ]
        const rows = buildPettyCashExportRows(entries, '2026-07')
        expect(rows).toEqual([
            { '日期': '2026-07-05', '類型': '撥入', '分類': '', '金額': 10000, '用途說明': '週轉金', '憑證': '無' },
            { '日期': '2026-07-10', '類型': '支出', '分類': '原料採購', '金額': -2000, '用途說明': '買白木耳', '憑證': '有' },
            { '日期': '──', '類型': '合計', '分類': '', '金額': 8000, '用途說明': '撥入 10000／支出 2000', '憑證': '' },
        ])
    })
})
