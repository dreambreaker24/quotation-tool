export const THRESHOLD_AMOUNT = 500000
export const TIER_STEP = 500000
export const DESIGNER_TIER_BONUS = 3000
export const SITE_MANAGER_TIER_BONUS = 5000
export const MANAGEMENT_FEE_RATE = 0.05
export const MIN_PROFIT_MARGIN = 0.25
export const SALES_DESIGN_RATE = 0.04
export const SALES_CONSTRUCTION_RATE = 0.0125

export function isEligibleByAmount(signedAmount) {
    return (signedAmount || 0) > THRESHOLD_AMOUNT
}

export function calcTier(signedAmount) {
    if (!isEligibleByAmount(signedAmount)) return 0
    return Math.ceil((signedAmount - THRESHOLD_AMOUNT) / TIER_STEP)
}

export function calcDesignerBonus(signedAmount) {
    return calcTier(signedAmount) * DESIGNER_TIER_BONUS
}

export function calcSalesBonus(designContractAmount, constructionContractAmount, signedAmount) {
    if (!isEligibleByAmount(signedAmount)) return 0
    return Math.round((designContractAmount || 0) * SALES_DESIGN_RATE + (constructionContractAmount || 0) * SALES_CONSTRUCTION_RATE)
}

export function sumVendorCost(workTypes) {
    return (workTypes || []).reduce((sum, wt) =>
        sum + (wt.vendorCostItems || []).reduce((s, i) => s + (i.amount || 0), 0), 0)
}

export function calcProfitMargin(signedAmount, vendorCostTotal, miscExpenses) {
    if (!signedAmount) return 0
    const profit = signedAmount * (1 - MANAGEMENT_FEE_RATE) - (vendorCostTotal || 0) - (miscExpenses || 0)
    return profit / signedAmount
}

export function calcSiteManagerBonus(signedAmount, vendorCostTotal, miscExpenses) {
    if (!isEligibleByAmount(signedAmount)) return 0
    const margin = calcProfitMargin(signedAmount, vendorCostTotal, miscExpenses)
    if (margin < MIN_PROFIT_MARGIN) return 0
    return calcTier(signedAmount) * SITE_MANAGER_TIER_BONUS
}

export function splitBonus(totalAmount, personIds, splitMap) {
    const ids = personIds || []
    if (ids.length === 0) return {}
    const hasCustomSplit = !!splitMap && ids.every(id => typeof splitMap[id] === 'number')
    const percents = hasCustomSplit
        ? ids.map(id => splitMap[id])
        : ids.map(() => Math.floor(100 / ids.length))
    if (!hasCustomSplit) {
        const distributed = percents.reduce((s, p) => s + p, 0)
        percents[percents.length - 1] += 100 - distributed
    }
    const result = {}
    ids.forEach((id, i) => {
        result[id] = Math.round(totalAmount * percents[i] / 100)
    })
    return result
}

export function dateToQuarterKey(date) {
    if (!date) return null
    const [y, m] = date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).split('-').map(Number)
    const q = Math.floor((m - 1) / 3) + 1
    return `${y}-Q${q}`
}

export function isCompletedInQuarter(completedAt, quarterKey) {
    if (!completedAt) return false
    const date = completedAt.toDate ? completedAt.toDate() : new Date(completedAt)
    return dateToQuarterKey(date) === quarterKey
}

function pushRoleEntries(entries, role, amount, personIds, splitMap, usersById, caseInfo) {
    if (amount <= 0 || !personIds?.length) return
    const split = splitBonus(amount, personIds, splitMap)
    personIds.forEach(uid => entries.push({
        role,
        personId: uid,
        personName: usersById[uid]?.name || '',
        caseId: caseInfo.id,
        caseName: caseInfo.name,
        suggestedAmount: split[uid],
        finalAmount: split[uid],
        paid: false,
    }))
}

export function buildCaseBonusEntries(caseInfo, bonusData, usersById = {}) {
    const entries = []
    const vendorCostTotal = sumVendorCost(caseInfo.workTypes)

    const salesAmount = calcSalesBonus(bonusData.designContractAmount, bonusData.constructionContractAmount, caseInfo.signedAmount)
    pushRoleEntries(entries, 'sales', salesAmount, bonusData.salesPersonIds, bonusData.salesSplit, usersById, caseInfo)

    const designerAmount = calcDesignerBonus(caseInfo.signedAmount)
    pushRoleEntries(entries, 'designer', designerAmount, bonusData.designerIds, bonusData.designerSplit, usersById, caseInfo)

    const siteManagerAmount = calcSiteManagerBonus(caseInfo.signedAmount, vendorCostTotal, bonusData.miscExpenses)
    pushRoleEntries(entries, 'siteManager', siteManagerAmount, bonusData.siteManagerIds, bonusData.siteManagerSplit, usersById, caseInfo)

    return entries
}

export function buildAdminEntry(adminTarget) {
    const { leadCount, signedCount, leadThresholds, signedBonusPerCase, assignedToUid, assignedToName } = adminTarget
    if (!assignedToUid) return null
    const leadBonus = (leadThresholds || [])
        .filter(t => (leadCount || 0) >= t.count)
        .reduce((max, t) => Math.max(max, t.amount), 0)
    const signedBonus = (signedCount || 0) * (signedBonusPerCase || 0)
    const suggestedAmount = leadBonus + signedBonus
    return {
        role: 'admin',
        personId: assignedToUid,
        personName: assignedToName || '',
        suggestedAmount,
        finalAmount: suggestedAmount,
        paid: false,
    }
}
