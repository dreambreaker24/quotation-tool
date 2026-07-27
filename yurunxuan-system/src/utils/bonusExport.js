function formatPaidAt(paidAt) {
    if (!paidAt) return ''
    const date = paidAt.toDate ? paidAt.toDate() : new Date(paidAt)
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(date)
}

export function buildBonusExportRows(quarterData) {
    const rows = []
    for (const p of (quarterData.team?.participants || [])) {
        rows.push({
            '類型': '團隊獎金',
            '對象': p.name,
            '建議金額': p.amount,
            '實發金額': p.amount,
            '已發放': p.paid ? '是' : '否',
            '發放時間': formatPaidAt(p.paidAt),
            '發放人': p.paidBy || '',
        })
    }
    for (const i of (quarterData.individual || [])) {
        rows.push({
            '類型': '個人抽成',
            '對象': i.name,
            '建議金額': i.suggestedAmount,
            '實發金額': i.finalAmount,
            '已發放': i.paid ? '是' : '否',
            '發放時間': formatPaidAt(i.paidAt),
            '發放人': i.paidBy || '',
        })
    }
    return rows
}
