import * as XLSX from 'xlsx'

export function useExport() {
    function exportCases(cases) {
        const rows = cases.map(c => ({
            '案件名稱': c.name,
            '分區': { south: '南區', north: '北區', central: '中區' }[c.companyId] ?? c.companyId,
            '狀態': c.status,
            '負責人': c.assigneeName,
            '施工地址': c.address || '',
            '預估金額': c.estimatedAmount || 0,
            '簽約金額': c.signedAmount || 0,
            '開始日期': c.startDate?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
            '結束日期': c.endDate?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
            '完工期限': c.deadline?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '案件清單')
        XLSX.writeFile(wb, `奈拾案件清單_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.xlsx`)
    }

    function exportClients(clients) {
        const rows = clients.map(c => ({
            '姓名': c.name,
            '電話': c.phone || '',
            'Email': c.email || '',
            'Line ID': c.lineId || '',
            '地址': c.address || '',
            '來源': c.source || '',
            '狀態': c.status || '',
            '預算': c.budget || 0,
            '坪數': c.area || 0,
            '下次跟進': c.followUpDate || '',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '客戶清單')
        XLSX.writeFile(wb, `奈拾客戶清單_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.xlsx`)
    }

    return { exportCases, exportClients }
}
