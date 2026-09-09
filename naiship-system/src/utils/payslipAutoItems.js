// 薪資單自動加項：生日禮金、端午/中秋禮金、季度獎金整合。
// 三者共用同一個判斷慣例：payMonth 是「這個月份的薪水」，實際發薪日是次月 10 號，
// 所以「生日/節慶月份 = payMonth 的月份 + 1」——例如 payMonth='2026-07' 對應 8 月生日/節慶。
const ROLE_LABEL = { sales: '業務', designer: '設計師', siteManager: '工務', admin: '行政', team: '團隊' }

function nextMonthOf(payMonth) {
    const [y, m] = payMonth.split('-').map(Number)
    return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 }
}

export function computeBirthdayGift(user, payMonth) {
    if (!user?.birthDate) return null
    const [, bm, bd] = user.birthDate.split('-').map(Number)
    const { month: giftMonth } = nextMonthOf(payMonth)
    if (bm !== giftMonth) return null
    return {
        id: 'birthday',
        label: `生日禮金（${bm}/${bd}）`,
        amount: 3000,
        source: 'birthday',
    }
}

export function computeFestivalGifts(payMonth, festivalSettings) {
    const { year: giftYear, month: giftMonth } = nextMonthOf(payMonth)
    const yearData = festivalSettings?.[giftYear]
    if (!yearData) return []
    const results = []
    if (yearData.dragonBoat) {
        const [, dm] = yearData.dragonBoat.split('-').map(Number)
        if (dm === giftMonth) results.push({ id: 'festival_dragonBoat', label: '端午禮金', amount: 2000, source: 'festival' })
    }
    if (yearData.midAutumn) {
        const [, mm] = yearData.midAutumn.split('-').map(Number)
        if (mm === giftMonth) results.push({ id: 'festival_midAutumn', label: '中秋禮金', amount: 2000, source: 'festival' })
    }
    return results
}

export function payMonthToBonusQuarter(payMonth) {
    const [y, m] = payMonth.split('-').map(Number)
    const prevM = m === 1 ? 12 : m - 1
    const prevY = m === 1 ? y - 1 : y
    const q = Math.ceil(prevM / 3)
    return `${prevY}-Q${q}`
}

export function buildBonusAutoItems(entries, personId) {
    return (entries || [])
        .filter(e => e.personId === personId && !e.paid)
        .map(e => ({
            id: `bonus_${e.role}_${e.caseId || 'none'}`,
            label: `季度獎金－${ROLE_LABEL[e.role] || e.role}${e.caseName ? `（${e.caseName}）` : ''}`,
            amount: e.finalAmount ?? e.suggestedAmount,
            source: 'bonus',
            bonusRef: { role: e.role, personId: e.personId, caseId: e.caseId || '' },
        }))
}

export function buildCompCashoutAutoItems(cashouts) {
    return (cashouts || []).map(c => ({
        id: `compCashout_${c.id}`,
        label: `補休換現金（${c.type}）`,
        amount: c.amount,
        source: 'compCashout',
    }))
}
