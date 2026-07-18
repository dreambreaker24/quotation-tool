import { describe, it, expect } from 'vitest'
import { isEligibleByAmount, calcTier, calcDesignerBonus, calcSalesBonus } from '@/utils/bonusCalc'

describe('isEligibleByAmount', () => {
    it('案件金額剛好 50 萬時不合格（要求「超過」）', () => {
        expect(isEligibleByAmount(500000)).toBe(false)
    })
    it('案件金額超過 50 萬 1 元就合格', () => {
        expect(isEligibleByAmount(500001)).toBe(true)
    })
    it('沒有金額（0/null/undefined）不合格', () => {
        expect(isEligibleByAmount(0)).toBe(false)
        expect(isEligibleByAmount(null)).toBe(false)
        expect(isEligibleByAmount(undefined)).toBe(false)
    })
})

describe('calcTier', () => {
    it('未達門檻回傳 0 級', () => {
        expect(calcTier(500000)).toBe(0)
    })
    it('50~100 萬（含 100 萬整）算第 1 級', () => {
        expect(calcTier(500001)).toBe(1)
        expect(calcTier(1000000)).toBe(1)
    })
    it('超過 100 萬 1 元跳到第 2 級', () => {
        expect(calcTier(1000001)).toBe(2)
    })
    it('剛好 250~300 萬區間算第 5 級', () => {
        expect(calcTier(3000000)).toBe(5)
    })
    it('超過 300 萬依同樣級距繼續遞增（第 6 級）', () => {
        expect(calcTier(3000001)).toBe(6)
    })
    it('大型案件（3012 萬 2570 元）算到第 60 級', () => {
        expect(calcTier(30122570)).toBe(60)
    })
})

describe('calcDesignerBonus', () => {
    it('未達門檻回傳 0', () => {
        expect(calcDesignerBonus(500000)).toBe(0)
    })
    it('第 1 級是 3000 元', () => {
        expect(calcDesignerBonus(1000000)).toBe(3000)
    })
    it('第 4 級（200~250 萬）是 12000 元', () => {
        expect(calcDesignerBonus(2500000)).toBe(12000)
    })
})

describe('calcSalesBonus', () => {
    it('未達 50 萬門檻回傳 0，不管設計/工程約金額多少', () => {
        expect(calcSalesBonus(1000000, 0, 500000)).toBe(0)
    })
    it('設計約金額 x 4% + 工程約金額 x 1.25%，不扣 5% 管銷', () => {
        expect(calcSalesBonus(1000000, 800000, 1800000)).toBe(1000000 * 0.04 + 800000 * 0.0125)
    })
    it('金額不是整除時四捨五入到整數元', () => {
        expect(calcSalesBonus(0, 7654321, 8000000)).toBe(Math.round(7654321 * 0.0125))
    })
    it('只有設計約金額也能算', () => {
        expect(calcSalesBonus(1000000, 0, 1000000)).toBe(1000000 * 0.04)
    })
})

import { sumVendorCost, calcProfitMargin, calcSiteManagerBonus, splitBonus } from '@/utils/bonusCalc'

describe('sumVendorCost', () => {
    it('加總所有工種的 vendorCostItems', () => {
        const workTypes = [
            { vendorCostItems: [{ amount: 10000 }, { amount: 5000 }] },
            { vendorCostItems: [{ amount: 20000 }] },
        ]
        expect(sumVendorCost(workTypes)).toBe(35000)
    })
    it('沒有工種或空陣列回傳 0', () => {
        expect(sumVendorCost([])).toBe(0)
        expect(sumVendorCost(undefined)).toBe(0)
    })
})

describe('calcProfitMargin', () => {
    it('利潤 = 簽約金額 x 0.95 - 廠商成本 - 雜支，利潤率 = 利潤 / 簽約金額', () => {
        const margin = calcProfitMargin(1000000, 400000, 50000)
        expect(margin).toBeCloseTo((1000000 * 0.95 - 400000 - 50000) / 1000000, 6)
    })
    it('沒有簽約金額回傳 0，避免除以 0', () => {
        expect(calcProfitMargin(0, 100, 100)).toBe(0)
    })
})

describe('calcSiteManagerBonus', () => {
    it('利潤率剛好 25% 仍然發獎金', () => {
        const signedAmount = 1000000
        const profit = signedAmount * 0.25
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(5000)
    })
    it('利潤率低於 25%（24.99%）強制歸零', () => {
        const signedAmount = 1000000
        const profit = signedAmount * 0.2499
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(0)
    })
    it('未達 50 萬門檻直接 0，不看利潤率', () => {
        expect(calcSiteManagerBonus(400000, 0, 0)).toBe(0)
    })
    it('範例案例：簽約 30,122,570、利潤率 47% -> 300,000 元', () => {
        const signedAmount = 30122570
        const profit = signedAmount * 0.47
        const vendorCostTotal = signedAmount * 0.95 - profit
        expect(calcSiteManagerBonus(signedAmount, vendorCostTotal, 0)).toBe(300000)
    })
})

describe('splitBonus', () => {
    it('沒有人負責回傳空物件', () => {
        expect(splitBonus(10000, [], {})).toEqual({})
    })
    it('單人負責拿全額', () => {
        expect(splitBonus(9000, ['u1'], {})).toEqual({ u1: 9000 })
    })
    it('單人負責時忽略殘留的舊分比資料，仍然拿全額', () => {
        expect(splitBonus(9000, ['u1'], { u1: 50, u2: 50 })).toEqual({ u1: 9000 })
    })
    it('兩人沒填分比時均分', () => {
        expect(splitBonus(10000, ['u1', 'u2'], {})).toEqual({ u1: 5000, u2: 5000 })
    })
    it('三人沒填分比時均分（100/人數取整數百分比），餘數算給最後一人', () => {
        const result = splitBonus(10000, ['u1', 'u2', 'u3'], {})
        expect(result.u1 + result.u2 + result.u3).toBe(10000)
        expect(result.u1).toBe(3300)
        expect(result.u2).toBe(3300)
        expect(result.u3).toBe(3400)
    })
    it('有填自訂分比時依比例分配', () => {
        expect(splitBonus(10000, ['u1', 'u2'], { u1: 70, u2: 30 })).toEqual({ u1: 7000, u2: 3000 })
    })
})

import { dateToQuarterKey, isCompletedInQuarter, buildCaseBonusEntries, buildAdminEntry } from '@/utils/bonusCalc'

describe('dateToQuarterKey', () => {
    it('4/5/6 月都算 Q2', () => {
        expect(dateToQuarterKey(new Date(2026, 3, 1))).toBe('2026-Q2')
        expect(dateToQuarterKey(new Date(2026, 4, 15))).toBe('2026-Q2')
        expect(dateToQuarterKey(new Date(2026, 5, 30))).toBe('2026-Q2')
    })
    it('1 月算當年 Q1', () => {
        expect(dateToQuarterKey(new Date(2026, 0, 1))).toBe('2026-Q1')
    })
    it('12 月算 Q4', () => {
        expect(dateToQuarterKey(new Date(2026, 11, 31))).toBe('2026-Q4')
    })
})

describe('isCompletedInQuarter', () => {
    it('completedAt 是 Firestore Timestamp 型別（有 toDate 方法）也能判斷', () => {
        const fakeTimestamp = { toDate: () => new Date(2026, 4, 10) }
        expect(isCompletedInQuarter(fakeTimestamp, '2026-Q2')).toBe(true)
        expect(isCompletedInQuarter(fakeTimestamp, '2026-Q1')).toBe(false)
    })
    it('沒有 completedAt 一律回傳 false', () => {
        expect(isCompletedInQuarter(null, '2026-Q2')).toBe(false)
        expect(isCompletedInQuarter(undefined, '2026-Q2')).toBe(false)
    })
})

describe('buildCaseBonusEntries', () => {
    const usersById = { u1: { name: '柯其宏' }, u2: { name: '陳柏兆' } }

    it('業務/設計師/工務都沒指定負責人時，entries 是空陣列', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = { designContractAmount: 0, constructionContractAmount: 0, salesPersonIds: [], designerIds: [], siteManagerIds: [], miscExpenses: 0 }
        expect(buildCaseBonusEntries(caseInfo, bonusData, usersById)).toEqual([])
    })

    it('三個角色都有指定負責人時各自產生 entry', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = {
            designContractAmount: 1000000, constructionContractAmount: 0,
            salesPersonIds: ['u1'], designerIds: ['u1'], siteManagerIds: ['u1'],
            miscExpenses: 0,
        }
        const entries = buildCaseBonusEntries(caseInfo, bonusData, usersById)
        expect(entries.map(e => e.role)).toEqual(['sales', 'designer', 'siteManager'])
        expect(entries[0]).toMatchObject({ personId: 'u1', personName: '柯其宏', caseId: 'c1', suggestedAmount: 40000, finalAmount: 40000, paid: false })
        expect(entries[1]).toMatchObject({ suggestedAmount: 3000 })
        expect(entries[2]).toMatchObject({ suggestedAmount: 5000 })
    })

    it('多人負責同一角色時各自成一筆 entry，金額依分帳', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = {
            designContractAmount: 1000000, constructionContractAmount: 0,
            salesPersonIds: ['u1', 'u2'], designerIds: [], siteManagerIds: [],
            salesSplit: {}, miscExpenses: 0,
        }
        const entries = buildCaseBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(2)
        expect(entries[0].suggestedAmount + entries[1].suggestedAmount).toBe(40000)
    })

    it('未達 50 萬門檻時即使有指定負責人也不產生 entry', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 400000, workTypes: [] }
        const bonusData = { designContractAmount: 400000, constructionContractAmount: 0, salesPersonIds: ['u1'], designerIds: ['u1'], siteManagerIds: ['u1'], miscExpenses: 0 }
        expect(buildCaseBonusEntries(caseInfo, bonusData, usersById)).toEqual([])
    })
})

describe('buildAdminEntry', () => {
    it('沒有指定發放對象回傳 null', () => {
        expect(buildAdminEntry({ leadCount: 30, signedCount: 5, leadThresholds: [], signedBonusPerCase: 1000, assignedToUid: '', assignedToName: '' })).toBeNull()
    })
    it('進件量門檻取符合資格中最高一級，加上簽約量獎金', () => {
        const target = {
            leadCount: 45, signedCount: 3,
            leadThresholds: [{ count: 30, amount: 2000 }, { count: 60, amount: 5000 }],
            signedBonusPerCase: 1000, assignedToUid: 'u2', assignedToName: '陳柏兆',
        }
        const entry = buildAdminEntry(target)
        expect(entry).toMatchObject({ role: 'admin', personId: 'u2', personName: '陳柏兆', suggestedAmount: 5000, finalAmount: 5000, paid: false })
    })
})

import { dedupeParticipants, buildTeamBonusEntries } from '@/utils/bonusCalc'

describe('dedupeParticipants', () => {
    it('三個角色的人合併去重', () => {
        const bonusData = { salesPersonIds: ['u1', 'u2'], designerIds: ['u2', 'u3'], siteManagerIds: ['u3'] }
        expect(dedupeParticipants(bonusData)).toEqual(['u1', 'u2', 'u3'])
    })
    it('三個角色都沒人時回傳空陣列', () => {
        expect(dedupeParticipants({})).toEqual([])
    })
    it('只有一個角色有人時只回傳那個角色的人', () => {
        expect(dedupeParticipants({ designerIds: ['u5'] })).toEqual(['u5'])
    })
})

describe('buildTeamBonusEntries', () => {
    const usersById = { u1: { name: '柯其宏' }, u2: { name: '陳柏兆' } }

    it('金額為 0 時回傳空陣列（即使有參與人）', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { salesPersonIds: ['u1'], teamBonusAmount: 0 }
        expect(buildTeamBonusEntries(caseInfo, bonusData, usersById)).toEqual([])
    })
    it('沒有參與人時回傳空陣列（即使有金額）', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { teamBonusAmount: 10000 }
        expect(buildTeamBonusEntries(caseInfo, bonusData, usersById)).toEqual([])
    })
    it('單人參與時全拿', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { salesPersonIds: ['u1'], teamBonusAmount: 9000 }
        const entries = buildTeamBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toEqual([{
            role: 'team', personId: 'u1', personName: '柯其宏',
            caseId: 'c1', caseName: '測試案',
            suggestedAmount: 9000, finalAmount: 9000, paid: false,
        }])
    })
    it('同一人身兼業務+設計師只算一份，不會拿兩份', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { salesPersonIds: ['u1'], designerIds: ['u1'], teamBonusAmount: 10000 }
        const entries = buildTeamBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(1)
        expect(entries[0].suggestedAmount).toBe(10000)
    })
    it('兩人分屬不同角色時均分', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = { salesPersonIds: ['u1'], designerIds: ['u2'], teamBonusAmount: 10000 }
        const entries = buildTeamBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(2)
        expect(entries[0].suggestedAmount + entries[1].suggestedAmount).toBe(10000)
        expect(entries.find(e => e.personId === 'u1').suggestedAmount).toBe(5000)
        expect(entries.find(e => e.personId === 'u2').suggestedAmount).toBe(5000)
    })
    it('有填自訂分比時依比例分配', () => {
        const caseInfo = { id: 'c1', name: '測試案' }
        const bonusData = {
            salesPersonIds: ['u1'], designerIds: ['u2'],
            teamBonusAmount: 10000, teamBonusSplit: { u1: 70, u2: 30 },
        }
        const entries = buildTeamBonusEntries(caseInfo, bonusData, usersById)
        expect(entries.find(e => e.personId === 'u1').suggestedAmount).toBe(7000)
        expect(entries.find(e => e.personId === 'u2').suggestedAmount).toBe(3000)
    })
})

describe('buildCaseBonusEntries 併入團隊獎金', () => {
    const usersById = { u1: { name: '柯其宏' } }

    it('團隊獎金 entries 會併入回傳陣列', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = {
            designContractAmount: 0, constructionContractAmount: 0,
            salesPersonIds: ['u1'], designerIds: [], siteManagerIds: [],
            miscExpenses: 0, teamBonusAmount: 5000,
        }
        const entries = buildCaseBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(1)
        expect(entries[0]).toMatchObject({ role: 'team', personId: 'u1', suggestedAmount: 5000 })
    })
    it('沒有 teamBonusAmount 欄位時（既有舊資料相容）不影響原本三個角色的 entries', () => {
        const caseInfo = { id: 'c1', name: '測試案', signedAmount: 1000000, workTypes: [] }
        const bonusData = {
            designContractAmount: 1000000, constructionContractAmount: 0,
            salesPersonIds: ['u1'], designerIds: [], siteManagerIds: [],
            miscExpenses: 0,
        }
        const entries = buildCaseBonusEntries(caseInfo, bonusData, usersById)
        expect(entries).toHaveLength(1)
        expect(entries[0].role).toBe('sales')
    })
})
