import { describe, it, expect } from 'vitest'
import { computeBirthdayGift, computeFestivalGifts, payMonthToBonusQuarter, buildBonusAutoItems } from '@/utils/payslipAutoItems'

describe('computeBirthdayGift', () => {
    it('沒有 birthDate 時回傳 null', () => {
        expect(computeBirthdayGift({ birthDate: '' }, '2026-07')).toBe(null)
    })

    it('生日月份等於 payMonth+1 時回傳禮金項目', () => {
        const gift = computeBirthdayGift({ birthDate: '2000-08-15' }, '2026-07')
        expect(gift).toMatchObject({ id: 'birthday', amount: 3000, source: 'birthday', label: '生日禮金（8/15）' })
    })

    it('生日月份不符合時回傳 null', () => {
        expect(computeBirthdayGift({ birthDate: '2000-03-10' }, '2026-07')).toBe(null)
    })

    it('跨年邊界：payMonth=12 對應隔年 1 月生日', () => {
        const gift = computeBirthdayGift({ birthDate: '2000-01-05' }, '2026-12')
        expect(gift).toMatchObject({ label: '生日禮金（1/5）' })
    })
})

describe('computeFestivalGifts', () => {
    const settings = { 2026: { dragonBoat: '2026-06-19', midAutumn: '2026-09-25' } }

    it('沒有當年度設定時回傳空陣列', () => {
        expect(computeFestivalGifts('2026-04', {})).toEqual([])
    })

    it('端午月份+1 命中時回傳端午禮金', () => {
        const gifts = computeFestivalGifts('2026-05', settings)
        expect(gifts).toEqual([{ id: 'festival_dragonBoat', label: '端午禮金', amount: 2000, source: 'festival' }])
    })

    it('中秋月份+1 命中時回傳中秋禮金', () => {
        const gifts = computeFestivalGifts('2026-08', settings)
        expect(gifts).toEqual([{ id: 'festival_midAutumn', label: '中秋禮金', amount: 2000, source: 'festival' }])
    })

    it('都不命中時回傳空陣列', () => {
        expect(computeFestivalGifts('2026-01', settings)).toEqual([])
    })

    it('跨年邊界：payMonth=12 查詢隔年的節慶設定', () => {
        const nextYearSettings = { 2027: { dragonBoat: '2027-01-10', midAutumn: '' } }
        const gifts = computeFestivalGifts('2026-12', nextYearSettings)
        expect(gifts).toEqual([{ id: 'festival_dragonBoat', label: '端午禮金', amount: 2000, source: 'festival' }])
    })
})

describe('payMonthToBonusQuarter', () => {
    it('10 月薪水對應 Q3（往前推一個月是 9 月）', () => {
        expect(payMonthToBonusQuarter('2026-10')).toBe('2026-Q3')
    })
    it('4 月薪水對應 Q1（往前推一個月是 3 月）', () => {
        expect(payMonthToBonusQuarter('2026-04')).toBe('2026-Q1')
    })
    it('7 月薪水對應 Q2（往前推一個月是 6 月）', () => {
        expect(payMonthToBonusQuarter('2026-07')).toBe('2026-Q2')
    })
    it('跨年邊界：1 月薪水往前推是去年 12 月，屬於去年 Q4', () => {
        expect(payMonthToBonusQuarter('2026-01')).toBe('2025-Q4')
    })
})

describe('buildBonusAutoItems', () => {
    const entries = [
        { role: 'sales', personId: 'uid1', caseId: 'case1', caseName: '大同區辦公室', suggestedAmount: 4800, finalAmount: 4800, paid: false },
        { role: 'team', personId: 'uid1', caseId: 'case2', caseName: '水塔鐵衣更換', suggestedAmount: 2000, finalAmount: 2000, paid: false },
        { role: 'sales', personId: 'uid1', caseId: 'case3', caseName: '已發放案', suggestedAmount: 1000, finalAmount: 1000, paid: true },
        { role: 'designer', personId: 'uid2', caseId: 'case1', caseName: '大同區辦公室', suggestedAmount: 3000, finalAmount: 3000, paid: false },
    ]

    it('只回傳指定 personId 且尚未發放的項目', () => {
        const items = buildBonusAutoItems(entries, 'uid1')
        expect(items).toHaveLength(2)
        expect(items.every(i => i.source === 'bonus')).toBe(true)
    })

    it('label 包含角色中文與案件名稱', () => {
        const items = buildBonusAutoItems(entries, 'uid1')
        expect(items[0].label).toBe('季度獎金－業務（大同區辦公室）')
        expect(items[1].label).toBe('季度獎金－團隊（水塔鐵衣更換）')
    })

    it('金額優先用 finalAmount，bonusRef 帶齊身分鍵三欄位', () => {
        const items = buildBonusAutoItems(entries, 'uid1')
        expect(items[0].amount).toBe(4800)
        expect(items[0].bonusRef).toEqual({ role: 'sales', personId: 'uid1', caseId: 'case1' })
    })

    it('沒有符合的 personId 時回傳空陣列', () => {
        expect(buildBonusAutoItems(entries, 'uid_none')).toEqual([])
    })
})
