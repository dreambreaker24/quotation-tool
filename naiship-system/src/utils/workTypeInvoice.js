// 工種廠商成本／付款／發票相關的共用計算，WorkTypePanel.vue 跟首頁總覽都會用到，
// 抽成共用函式避免兩處各自維護一份邏輯不一致（D3 那次修復就是在修這種不同步的問題）

import { isWithinDays } from './dateRetention'

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

// 這個項目累計已經分攤到多少付款金額（跨所有付款紀錄加總）
export function itemPaid(wt, itemId) {
    return (wt.vendorPayments || [])
        .flatMap(vp => vp.itemAllocations || [])
        .filter(a => a.itemId === itemId)
        .reduce((sum, a) => sum + (a.amount || 0), 0)
}

// 把一筆付款金額依序分攤到 selectedItems（依傳入陣列順序，呼叫端負責保證這個順序是
// vendorCostItems 原本的順序），每個項目最多分到「還欠的金額」，分完還有剩餘就繼續分給下一個項目，
// 金額超過所有選定項目欠款加總時，多餘部分不分攤（不算錯誤，付款總額本身仍完整記錄在vp.amount）
export function allocatePayment(amount, selectedItems, wt) {
    let remaining = amount
    const allocations = []
    for (const item of selectedItems) {
        if (remaining <= 0) break
        const owed = item.amount - itemPaid(wt, item.id)
        const take = Math.min(owed, remaining)
        if (take > 0) {
            allocations.push({ itemId: item.id, amount: take })
            remaining -= take
        }
    }
    return allocations
}

// 分期付款每一期實際金額：非最後一期直接照比例算，最後一期吃總金額扣掉前面所有期數的和，
// 避免四捨五入造成全部期數加起來對不上合約總額
export function stageAmountOf(wt, stage) {
    const total = wtVendorCostTotal(wt)
    const stages = wt.paymentPlan?.stages || []
    const i = stages.findIndex(s => s.id === stage.id)
    if (i === stages.length - 1) {
        const othersSum = stages.slice(0, -1).reduce((sum, s) => sum + Math.round(total * (s.pct || 0) / 100), 0)
        return total - othersSum
    }
    return Math.round(total * (stage.pct || 0) / 100)
}

// 記一筆針對「單一廠商成本項目」的付款（首頁儀表板快速完成用；案件詳情原本的多項目
// 一次分攤付款維持在 WorkTypePanel.vue 自己的邏輯，不套用這個函式，因為那邊本來就支援
// 一筆付款分攤給多個項目，跟這裡「只針對一個項目」的簡化流程不是同一件事）。
// 回傳 null 代表找不到對應的工種或項目，呼叫端要自行處理（通常代表資料已經被刪除/改過）。
export function applyVendorItemPayment(workTypes, workTypeId, { itemId, amount, paidDate, note }) {
    const idx = workTypes.findIndex(wt => wt.id === workTypeId)
    if (idx === -1) return null
    const wt = workTypes[idx]
    const item = (wt.vendorCostItems || []).find(i => i.id === itemId)
    if (!item) return null
    if (amount <= 0) return null
    const allocations = allocatePayment(amount, [item], wt)
    const newVendorPayments = [...(wt.vendorPayments || []), {
        id: `vp_${Date.now()}`,
        amount,
        paidDate,
        note: note || '',
        itemAllocations: allocations,
    }]
    const newWt = { ...wt, vendorPayments: newVendorPayments }
    const newWorkTypes = [...workTypes]
    newWorkTypes[idx] = newWt
    return { workTypes: newWorkTypes, itemFullyPaid: itemPaid(newWt, itemId) >= item.amount }
}

// 標記付款計畫裡的某一期完成：金額固定用 stageAmountOf 算出來的比例金額，不能手動改
// （分期付款本來就是照合約比例走，跟「單一項目」那種可以自由輸入金額的情況不一樣）。
export function applyVendorStagePayment(workTypes, workTypeId, stageId, paidDate) {
    const idx = workTypes.findIndex(wt => wt.id === workTypeId)
    if (idx === -1) return null
    const wt = workTypes[idx]
    const stage = (wt.paymentPlan?.stages || []).find(s => s.id === stageId)
    if (!stage) return null
    if (stage.status === 'done') return null
    const amount = stageAmountOf(wt, stage)
    const newStages = wt.paymentPlan.stages.map(s => s.id === stageId ? { ...s, status: 'done' } : s)
    const newVendorPayments = [...(wt.vendorPayments || []), {
        id: `vp_${Date.now()}`,
        amount,
        paidDate,
        note: stage.name,
    }]
    const newWt = { ...wt, paymentPlan: { ...wt.paymentPlan, stages: newStages }, vendorPayments: newVendorPayments }
    const newWorkTypes = [...workTypes]
    newWorkTypes[idx] = newWt
    return { workTypes: newWorkTypes, amount, stageName: stage.name }
}

// 跟 computePendingInvoiceGroups 是同一份資料的另一個視角：這裡列出「已經收到發票，
// 而且是最近 3 天內收到的」，讓首頁還能繼續看到剛完成的項目一小段時間，不是一標記
// 完成就馬上從畫面消失。回傳格式跟 computePendingInvoiceGroups 一樣（caseId/caseName/items），
// 每個 item 多一個 completed:true 讓畫面知道要用「已完成」樣式呈現。
export function computeRecentlyReceivedInvoiceGroups(cases, days = 3) {
    const flat = []
    for (const c of cases) {
        for (const wt of (c.workTypes || [])) {
            if (!wt.invoiceReceived) continue
            if (!isWithinDays(wt.invoiceReceivedAt, days)) continue
            flat.push({ caseId: c.id, caseName: c.name, companyId: c.companyId, wt, completed: true })
        }
    }
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
