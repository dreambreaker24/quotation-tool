// 階梯式加班費公式，跟 PayslipView.vue 的 calcOTFromHours() 完全一致（時薪=底薪/240）
export function computeOvertimeValue(hours, type, baseSalary) {
    if (!hours || !baseSalary) return 0
    const hourly = baseSalary / 240
    let pay = 0
    if (type === '平日') {
        pay = Math.min(hours, 2) * hourly * (4 / 3) + Math.max(hours - 2, 0) * hourly * (5 / 3)
    } else {
        pay = Math.min(hours, 2) * hourly * (4 / 3)
            + Math.min(Math.max(hours - 2, 0), 6) * hourly * (5 / 3)
            + Math.max(hours - 8, 0) * hourly * (8 / 3)
    }
    return Math.round(pay)
}

export function buildLedgerEntry({ type, hours, baseSalary, expireDate, sourceLogId = null, source = 'overtime' }) {
    return {
        type,
        hours,
        remainingHours: hours,
        value: computeOvertimeValue(hours, type, baseSalary),
        baseRateAtAccrual: baseSalary / 240,
        expireDate,
        sourceLogId,
        source,
    }
}

// entries 依 createdAt 由舊到新排序（呼叫端負責排序），依序消耗指定 type 的 remainingHours，
// 回傳這次動用到哪些分錄各扣了多少（consumptions）、更新後的完整 entries、還差多少沒扣到（shortfall）
export function consumeFIFO(entries, type, hoursNeeded) {
    let remaining = hoursNeeded
    const consumptions = []
    const updatedEntries = entries.map(e => ({ ...e }))
    for (const entry of updatedEntries) {
        if (remaining <= 0) break
        if (entry.type !== type || entry.remainingHours <= 0) continue
        const take = Math.min(entry.remainingHours, remaining)
        entry.remainingHours = Math.round((entry.remainingHours - take) * 100) / 100
        consumptions.push({ id: entry.id, hours: take })
        remaining = Math.round((remaining - take) * 100) / 100
    }
    return { consumptions, updatedEntries, shortfall: Math.max(remaining, 0) }
}

// 依比例算出某次消耗紀錄對應的金額（用於換現金金額計算）
// 重要：呼叫端必須把同一批 consumptions 一次傳完（不能分批呼叫多次再加總），
// 否則每次呼叫各自 round 會導致累加金額跟分錄實際總值有落差
// 金額計算採線性比例分攤（消耗時數佔比 × 分錄總金額），不是重新套階梯公式。
// 這是刻意設計：分錄已在建立當下用完整時數鎖定正確的階梯金額，之後只做比例分攤
// 才能保證「全部消耗完＝分錄總值」的守恆；若每次消耗都重新套階梯公式會因分段費率而算錯。
export function valueForConsumption(entries, consumptions) {
    const byId = new Map(entries.map(e => [e.id, e]))
    return Math.round(consumptions.reduce((sum, c) => {
        const entry = byId.get(c.id)
        if (!entry || !entry.hours) return sum
        return sum + (c.hours / entry.hours) * entry.value
    }, 0))
}

// 反向操作：把之前 consumeFIFO 回傳的 consumptions 加回對應分錄（編輯/刪除請假時的歸還），
// 歸還量上限是分錄原始 hours，不會超額
export function refundConsumption(entries, consumptions) {
    const byId = new Map(entries.map(e => [e.id, { ...e }]))
    for (const c of consumptions) {
        const entry = byId.get(c.id)
        if (!entry) continue
        entry.remainingHours = Math.min(entry.hours, Math.round((entry.remainingHours + c.hours) * 100) / 100)
    }
    return [...byId.values()]
}

export function sumRemainingHours(entries, type) {
    return entries
        .filter(e => e.type === type)
        .reduce((s, e) => s + (e.remainingHours || 0), 0)
}

// expireDate 與 todayStr 必須都是 'YYYY-MM-DD' 格式字串（字典序比較才會正確），不能是 Date 物件
export function isExpired(entry, todayStr) {
    return !!entry.expireDate && entry.expireDate < todayStr && entry.remainingHours > 0
}

export function expiredEntries(entries, todayStr) {
    return entries.filter(e => isExpired(e, todayStr))
}
