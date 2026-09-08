// 工種廠商成本／付款／發票相關的共用計算，WorkTypePanel.vue 跟首頁總覽都會用到，
// 抽成共用函式避免兩處各自維護一份邏輯不一致（D3 那次修復就是在修這種不同步的問題）

export function sumItems(items, free) {
    if (free) return 0
    return (items || []).reduce((s, i) => s + (i.amount || 0), 0)
}

export function wtVendorCostTotal(wt) {
    const items = wt.vendorCostItems ?? (wt.vendorCost > 0 ? [{ amount: wt.vendorCost }] : [])
    return sumItems(items, wt.vendorCostFree)
}

export function totalVendorPaid(wt) {
    return (wt.vendorPayments || []).reduce((sum, vp) => sum + (vp.amount || 0), 0)
}

// 廠商發票是針對整個工種的合約總金額開立一次（不是每筆付款各自開票），
// 所以發票狀態是工種層級的單一欄位（wt.invoiceReceived），不是統計每筆付款
// 回傳 null 代表這個工種不用管發票（沒有廠商/沒有金額/免費/明確標記不開發票）
export function vendorInvoiceStatus(wt) {
    if (!wt.vendorName || wtVendorCostTotal(wt) <= 0 || wt.vendorCostFree || wt.costIncludesTax === false) return null
    return wt.invoiceReceived
        ? { label: '已收發票', cls: 'bg-green-100 text-green-700' }
        : { label: '未收發票', cls: 'bg-gray-100 text-gray-400' }
}

export function computePendingInvoiceGroups(cases) {
    const flat = []
    for (const c of cases) {
        for (const wt of (c.workTypes || [])) {
            const status = vendorInvoiceStatus(wt)
            if (status?.label !== '未收發票') continue
            if (totalVendorPaid(wt) < wtVendorCostTotal(wt)) continue
            const paidDates = (wt.vendorPayments || []).map(vp => vp.paidDate).filter(Boolean)
            if (!paidDates.length) continue
            const lastPaidDate = paidDates.sort().at(-1)
            flat.push({ caseId: c.id, caseName: c.name, companyId: c.companyId, wt, lastPaidDate })
        }
    }
    flat.sort((a, b) => a.lastPaidDate.localeCompare(b.lastPaidDate))
    const caseOrder = []
    const caseMap = {}
    for (const item of flat) {
        if (!caseMap[item.caseId]) {
            caseMap[item.caseId] = { caseId: item.caseId, caseName: item.caseName, items: [] }
            caseOrder.push(item.caseId)
        }
        caseMap[item.caseId].items.push(item)
    }
    return caseOrder.map(id => caseMap[id])
}
