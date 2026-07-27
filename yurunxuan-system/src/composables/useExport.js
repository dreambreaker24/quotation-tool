import * as XLSX from 'xlsx'
import { buildPettyCashExportRows } from '@/utils/pettyCashSummary'
import { buildBonusExportRows } from '@/utils/bonusExport'

export function useExport() {
    function exportPettyCash(entries, yearMonth) {
        const rows = buildPettyCashExportRows(entries, yearMonth)
        const sheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, sheet, '零用金')
        XLSX.writeFile(workbook, `鈺潤軒零用金_${yearMonth}.xlsx`)
    }

    function exportBonus(quarterData, quarterKey) {
        const rows = buildBonusExportRows(quarterData)
        const sheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, sheet, '季度獎金')
        XLSX.writeFile(workbook, `鈺潤軒季度獎金_${quarterKey}_${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date()).replaceAll('-', '')}.xlsx`)
    }

    return { exportPettyCash, exportBonus }
}
