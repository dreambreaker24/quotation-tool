import * as XLSX from 'xlsx'
import { formatCaseAddress } from '@/utils/caseAddress'

export function useExport() {
    function exportCases(cases) {
        const rows = cases.map(c => ({
            '案件名稱': c.name,
            '分區': { south: '南區', north: '北區', central: '中區' }[c.companyId] ?? c.companyId,
            '狀態': c.status,
            '負責人': c.assigneeName,
            '施工地址': formatCaseAddress(c),
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

    function exportPettyCash(entries, yearMonth) {
        const TYPE_LABELS = { expense: '支出', topup: '補款', distribute: '發放', return: '歸還' }
        const RECEIPT_LABELS = { invoice: '發票', workorder: '點工單', none: '無憑證' }

        const monthEntries = entries
            .filter(e => e.date?.startsWith(yearMonth))
            .sort((a, b) => a.date.localeCompare(b.date))

        const rows = monthEntries.map(e => ({
            '日期': e.date,
            '付款人': e.payerName || '',
            '類型': TYPE_LABELS[e.type] || e.type,
            '分類': e.category || '',
            '金額': e.type === 'expense' ? -(e.amount || 0) : (e.amount || 0),
            '用途說明': e.description || '',
            '關聯案件': e.linkedCaseName || '',
            '憑證類型': RECEIPT_LABELS[e.receiptType] || '',
        }))

        const totalExpense = monthEntries
            .filter(e => e.type === 'expense')
            .reduce((s, e) => s + (e.amount || 0), 0)
        const totalTopup = monthEntries
            .filter(e => e.type === 'topup')
            .reduce((s, e) => s + (e.amount || 0), 0)

        rows.push({
            '日期': '──',
            '付款人': '合計',
            '類型': '',
            '分類': '',
            '金額': totalTopup - totalExpense,
            '用途說明': `補款 $${totalTopup.toLocaleString()}  支出 $${totalExpense.toLocaleString()}`,
            '關聯案件': '',
            '憑證類型': '',
        })

        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, `零用金${yearMonth}`)
        XLSX.writeFile(wb, `奈拾零用金_${yearMonth}.xlsx`)
    }

    function exportBonusSummary(entries, quarterKey) {
        const ROLE_LABELS = { sales: '業務', designer: '設計師', siteManager: '工務', admin: '行政', team: '團隊' }
        const rows = entries.map(e => ({
            '角色': ROLE_LABELS[e.role] || e.role,
            '對象': e.personName || '',
            '案件': e.caseName || '—',
            '建議金額': e.suggestedAmount || 0,
            '實發金額': e.finalAmount || 0,
            '已發放': e.paid ? '已發放' : '未發放',
            '發放時間': e.paidAt?.toDate?.()?.toLocaleDateString('zh-TW') ?? '',
            '發放人': e.paidBy || '',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '發放彙總')
        XLSX.writeFile(wb, `奈拾季度獎金_${quarterKey}_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.xlsx`)
    }

    return { exportCases, exportClients, exportPettyCash, exportBonusSummary }
}
