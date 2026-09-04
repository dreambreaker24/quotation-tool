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

// 回傳 null 代表這個工種不用管發票（未完工/沒有廠商成本/免費/明確標記不開發票）
export function vendorInvoiceStatus(wt) {
    if (!wt.done || wtVendorCostTotal(wt) <= 0 || wt.vendorCostFree || wt.costIncludesTax === false) return null
    const payments = wt.vendorPayments || []
    if (payments.length === 0) return { label: '無發票', cls: 'bg-gray-100 text-gray-400' }
    const count = payments.filter(vp => vp.hasInvoice).length
    if (count === payments.length) return { label: '發票全到', cls: 'bg-green-100 text-green-700' }
    if (count > 0) return { label: `發票 ${count}/${payments.length}`, cls: 'bg-amber-100 text-amber-700' }
    return { label: '無發票', cls: 'bg-gray-100 text-gray-400' }
}
