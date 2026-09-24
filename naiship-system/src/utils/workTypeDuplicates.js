// 同一案件的工種：名稱＋細項相同就視為重複，存檔前跳提醒（可確認後繼續存）

export function workTypeLabel(wt) {
    const sub = (wt?.subName || '').trim()
    return sub ? `${wt.name}・${sub}` : (wt?.name || '')
}

export function findDuplicateWorkTypes(workTypes, candidate) {
    const label = workTypeLabel(candidate)
    const matches = (workTypes || []).filter(wt => wt.id !== candidate.id && workTypeLabel(wt) === label)
    if (matches.length === 0) return null
    const sameVendor = !!candidate.vendorId && matches.some(wt => wt.vendorId === candidate.vendorId)
    return { kind: sameVendor ? 'same-vendor' : 'other-vendor', matches }
}

// 「系統櫃」（綠巧築、陳盈志）
export function describeDuplicate(dup) {
    const vendors = [...new Set(dup.matches.map(wt => wt.vendorName).filter(Boolean))].join('、')
    const label = workTypeLabel(dup.matches[0])
    return vendors ? `「${label}」（${vendors}）` : `「${label}」`
}

// 發包轉工種沒有細項欄位，只能確認或取消
export function bidDuplicateMessage(dup) {
    const hint = dup.kind === 'other-vendor' ? '\n之後可到工種安排填「細項」區分。' : ''
    return `此案件已有${describeDuplicate(dup)}，確定還要新增一筆嗎？${hint}`
}
