import { describe, it, expect } from 'vitest'
import { buildBonusExportRows } from '../../src/utils/bonusExport'

describe('buildBonusExportRows', () => {
  it('團隊獎金與個人抽成各自組成一行，類型欄位區分', () => {
    const quarterData = {
      team: {
        participants: [
          { uid: 'u1', name: 'A', amount: 3000, paid: true, paidAt: { toDate: () => new Date('2026-07-01T00:00:00Z') }, paidBy: '柏' },
        ],
      },
      individual: [
        { uid: 'u1', name: 'A', personalRevenue: 20000, suggestedAmount: 1000, finalAmount: 1200, paid: false, paidAt: null, paidBy: null },
      ],
    }
    const rows = buildBonusExportRows(quarterData)
    expect(rows).toEqual([
      { '類型': '團隊獎金', '對象': 'A', '建議金額': 3000, '實發金額': 3000, '已發放': '是', '發放時間': '2026-07-01', '發放人': '柏' },
      { '類型': '個人抽成', '對象': 'A', '建議金額': 1000, '實發金額': 1200, '已發放': '否', '發放時間': '', '發放人': '' },
    ])
  })

  it('沒有任何資料回傳空陣列', () => {
    expect(buildBonusExportRows({ team: { participants: [] }, individual: [] })).toEqual([])
  })
})
