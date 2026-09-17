import { describe, it, expect } from 'vitest'
import { mapCashoutEntries, mapLeaveEntries, mergeCompHistory } from '@/utils/compHistory'

describe('mapCashoutEntries', () => {
  it('把換現金紀錄轉成負數時數的明細格式', () => {
    const cashouts = [{ hours: 5, createdAt: { toDate: () => new Date('2026-08-01') } }]
    const result = mapCashoutEntries(cashouts)
    expect(result).toEqual([{ date: new Date('2026-08-01'), hours: -5, reason: '換現金', kind: 'cashout' }])
  })

  it('沒有 createdAt 時 date 是 null', () => {
    const result = mapCashoutEntries([{ hours: 3 }])
    expect(result[0].date).toBeNull()
  })

  it('多筆會各自轉換，保留原本順序', () => {
    const cashouts = [
      { hours: 2, createdAt: { toDate: () => new Date('2026-07-01') } },
      { hours: 4, createdAt: { toDate: () => new Date('2026-08-01') } },
    ]
    const result = mapCashoutEntries(cashouts)
    expect(result.map(r => r.hours)).toEqual([-2, -4])
  })
})

describe('mapLeaveEntries', () => {
  it('只保留符合 leaveType 的事件，時數轉負數', () => {
    const events = [
      { leaveType: '補休', hours: 4, date: { toDate: () => new Date('2026-09-10') } },
      { leaveType: '事假', hours: 8, date: { toDate: () => new Date('2026-09-11') } },
    ]
    const result = mapLeaveEntries(events, '補休')
    expect(result).toEqual([{ date: new Date('2026-09-10'), hours: -4, reason: '請假扣款', kind: 'leave' }])
  })

  it('unitConverter 會套用在時數上（特休換算天數）', () => {
    const events = [{ leaveType: '特休', hours: 8, date: { toDate: () => new Date('2026-09-10') } }]
    const result = mapLeaveEntries(events, '特休', h => h / 8)
    expect(result[0].hours).toBe(-1)
  })

  it('不傳 unitConverter 時預設原樣使用小時數', () => {
    const events = [{ leaveType: '補休', hours: 2.5, date: { toDate: () => new Date('2026-09-10') } }]
    const result = mapLeaveEntries(events, '補休')
    expect(result[0].hours).toBe(-2.5)
  })

  it('沒有符合 leaveType 的事件時回傳空陣列', () => {
    const events = [{ leaveType: '事假', hours: 8, date: { toDate: () => new Date('2026-09-11') } }]
    expect(mapLeaveEntries(events, '補休')).toEqual([])
  })
})

describe('mergeCompHistory', () => {
  it('攤平多份清單並依日期新到舊排序', () => {
    const a = [{ date: new Date('2026-09-01'), hours: 1, reason: 'a', kind: 'accrual' }]
    const b = [{ date: new Date('2026-09-15'), hours: -1, reason: 'b', kind: 'leave' }]
    const result = mergeCompHistory(a, b)
    expect(result.map(r => r.reason)).toEqual(['b', 'a'])
  })

  it('日期是 null 的排最後', () => {
    const withDate = [{ date: new Date('2026-09-01'), hours: 1, reason: 'has-date', kind: 'accrual' }]
    const noDate = [{ date: null, hours: 1, reason: 'no-date', kind: 'adjustment' }]
    const result = mergeCompHistory(noDate, withDate)
    expect(result.map(r => r.reason)).toEqual(['has-date', 'no-date'])
  })

  it('可以接受兩份以上的清單、也可以接受空清單', () => {
    const a = [{ date: new Date('2026-09-01'), hours: 1, reason: 'a', kind: 'accrual' }]
    const result = mergeCompHistory(a, [], [])
    expect(result).toEqual(a)
  })
})
