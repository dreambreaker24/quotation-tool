import { describe, it, expect } from 'vitest'
import { workTypeLabel, findDuplicateWorkTypes, describeDuplicate, bidDuplicateMessage } from '@/utils/workTypeDuplicates'

describe('workTypeLabel', () => {
    it('沒有細項時只顯示工種名稱', () => {
        expect(workTypeLabel({ name: '系統櫃' })).toBe('系統櫃')
        expect(workTypeLabel({ name: '系統櫃', subName: '  ' })).toBe('系統櫃')
    })

    it('有細項時顯示「工種・細項」', () => {
        expect(workTypeLabel({ name: '系統櫃', subName: '組裝' })).toBe('系統櫃・組裝')
    })
})

describe('findDuplicateWorkTypes', () => {
    const existing = [
        { id: 'wt1', name: '系統櫃', vendorId: 'v1', vendorName: '綠巧築' },
        { id: 'wt2', name: '水電', vendorId: 'v2', vendorName: '泉展' },
    ]

    it('沒有同名工種時回傳 null', () => {
        expect(findDuplicateWorkTypes(existing, { name: '木工', vendorId: 'v1' })).toBeNull()
    })

    it('同工種同廠商 → same-vendor', () => {
        const result = findDuplicateWorkTypes(existing, { name: '水電', vendorId: 'v2' })
        expect(result.kind).toBe('same-vendor')
        expect(result.matches.map(wt => wt.id)).toEqual(['wt2'])
    })

    it('同工種不同廠商 → other-vendor', () => {
        const result = findDuplicateWorkTypes(existing, { name: '系統櫃', vendorId: 'v9' })
        expect(result.kind).toBe('other-vendor')
        expect(result.matches.map(wt => wt.id)).toEqual(['wt1'])
    })

    it('同工種但尚未填廠商 → other-vendor', () => {
        expect(findDuplicateWorkTypes(existing, { name: '系統櫃', vendorId: '' }).kind).toBe('other-vendor')
    })

    it('編輯時排除自己', () => {
        expect(findDuplicateWorkTypes(existing, { id: 'wt1', name: '系統櫃', vendorId: 'v1' })).toBeNull()
    })

    it('細項不同就不算重複', () => {
        const list = [{ id: 'wt1', name: '系統櫃', subName: '櫃體', vendorId: 'v1' }]
        expect(findDuplicateWorkTypes(list, { name: '系統櫃', subName: '組裝', vendorId: 'v3' })).toBeNull()
    })

    it('細項相同仍算重複', () => {
        const list = [{ id: 'wt1', name: '系統櫃', subName: '組裝', vendorId: 'v1' }]
        expect(findDuplicateWorkTypes(list, { name: '系統櫃', subName: ' 組裝 ', vendorId: 'v3' }).kind).toBe('other-vendor')
    })

    it('多筆同名中只要有一筆同廠商就算 same-vendor', () => {
        const list = [
            { id: 'wt1', name: '廣告招牌', vendorId: 'v1' },
            { id: 'wt2', name: '廣告招牌', vendorId: 'v2' },
        ]
        expect(findDuplicateWorkTypes(list, { name: '廣告招牌', vendorId: 'v2' }).kind).toBe('same-vendor')
    })
})

describe('describeDuplicate / bidDuplicateMessage', () => {
    const matches = [
        { id: 'wt1', name: '系統櫃', vendorName: '綠巧築' },
        { id: 'wt2', name: '系統櫃', vendorName: '陳盈志' },
    ]

    it('列出既有工種與所有廠商', () => {
        expect(describeDuplicate({ kind: 'other-vendor', matches })).toBe('「系統櫃」（綠巧築、陳盈志）')
    })

    it('既有工種沒填廠商時只顯示工種', () => {
        expect(describeDuplicate({ kind: 'other-vendor', matches: [{ id: 'wt1', name: '系統櫃' }] })).toBe('「系統櫃」')
    })

    it('不同廠商時提示之後可填細項', () => {
        expect(bidDuplicateMessage({ kind: 'other-vendor', matches })).toBe('此案件已有「系統櫃」（綠巧築、陳盈志），確定還要新增一筆嗎？\n之後可到工種安排填「細項」區分。')
    })

    it('同廠商時不提細項', () => {
        expect(bidDuplicateMessage({ kind: 'same-vendor', matches })).toBe('此案件已有「系統櫃」（綠巧築、陳盈志），確定還要新增一筆嗎？')
    })
})
