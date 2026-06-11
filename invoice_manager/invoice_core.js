const ExcelJS = require('exceljs');
const fs       = require('fs');
const path     = require('path');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const PDF_EXT    = '.pdf';
const ALL_EXTS   = [...IMAGE_EXTS, PDF_EXT];
const MEDIA_TYPES = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png',  '.webp': 'image/webp',
    '.pdf': 'application/pdf'
};
const MAX_PDF_MB = 20;

const PRICE_INPUT_PER_M  = 3.00;
const PRICE_OUTPUT_PER_M = 15.00;
const TWD_RATE           = 32.5;

let sessionUsage = { input_tokens: 0, output_tokens: 0 };

function resetSessionUsage() {
    sessionUsage = { input_tokens: 0, output_tokens: 0 };
}

function getSessionUsage() {
    return { ...sessionUsage };
}

function calcCost(inputTokens, outputTokens) {
    return (inputTokens / 1e6 * PRICE_INPUT_PER_M) + (outputTokens / 1e6 * PRICE_OUTPUT_PER_M);
}

function fmtCost(usd) {
    return `US$${usd.toFixed(4)}（約 NT$${(usd * TWD_RATE).toFixed(1)}）`;
}

const CFG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
    try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); }
    catch { return { anthropic_api_key: '', companies: {} }; }
}

function saveConfig(config) {
    fs.writeFileSync(CFG_PATH, JSON.stringify(config, null, 4), 'utf8');
}

function parseDate(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    const roc = s.match(/^(\d{2,3})年(\d{1,2})月(\d{1,2})日?$/);
    if (roc) {
        const y = parseInt(roc[1]) + 1911;
        return `${y}-${String(roc[2]).padStart(2,'0')}-${String(roc[3]).padStart(2,'0')}`;
    }
    const ce = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
    if (ce) return `${ce[1]}-${String(ce[2]).padStart(2,'0')}-${String(ce[3]).padStart(2,'0')}`;
    s = s.replace(/\//g, '-');
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return '';
}

function cleanStr(s) {
    return String(s || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

function cleanInvoiceNum(s) {
    return cleanStr(s).replace(/[\s\-]/g, '').toUpperCase();
}

function getFlags(item, ownNames = []) {
    const currentYear = new Date().getFullYear();
    const flags = [];
    if (!item.store_name || String(item.store_name).trim() === '') flags.push('⚠店家空白');
    else if (ownNames.some(name => item.store_name.includes(name))) flags.push('⚠自家公司');
    if (Number(item.total) === 0 && Number(item.amount) === 0) flags.push('⚠金額為0');
    if (item.date) {
        const y = new Date(item.date).getFullYear();
        if (!isNaN(y) && Math.abs(y - currentYear) > 1) flags.push(`⚠年份${y}`);
    }
    return flags;
}

function isSuspiciousBatch(items) {
    if (items.length < 3) return false;
    const first = items[0];
    return items.every(item => item.store_name === first.store_name && item.date === first.date);
}

const PROMPT = `請從這份發票提取所有發票的資訊。若有多張發票，回傳 JSON 陣列；單張則回傳單一物件。只回傳 JSON 不含任何說明：
{
  "date": "YYYY-MM-DD",
  "invoice_number": "發票號碼",
  "tax_id": "賣方統一編號（8碼數字，無則空字串）",
  "store_name": "賣方名稱",
  "items": "品項（多品項用逗號分隔）",
  "amount": 金額數字（不含稅）,
  "tax": 稅額數字,
  "total": 總金額數字
}
重要規則：
1. store_name 填「賣方／開立人」的公司名稱，絕對不是「買受人」。台灣發票的買受人是採購方，不是賣方。
2. tax_id 填「賣方」的統一編號，不是買受人的統編。94201846 是買受人請忽略。
3. 紙本三聯式發票：賣方名稱在發票右下角印章區，買受人在中間欄位，請勿混淆。
4. 電子發票：賣方名稱通常在最上方最顯眼的位置。
5. 發票號碼格式：兩英文字母加8數字（如 AB12345678）。
6. 民國年自動換算西元，日期格式 YYYY-MM-DD。
7. 金額欄位只填數字。`;

async function extractInvoice(client, filePath, retries = 2) {
    const ext      = path.extname(filePath).toLowerCase();
    const mimeType = MEDIA_TYPES[ext] || 'image/jpeg';

    if (ext === '.pdf') {
        const sizeMB = fs.statSync(filePath).size / (1024 * 1024);
        if (sizeMB > MAX_PDF_MB) throw new Error(`PDF 過大（${sizeMB.toFixed(1)} MB，上限 ${MAX_PDF_MB} MB），請分割後重試`);
    }

    const data    = fs.readFileSync(filePath).toString('base64');
    const content = ext === '.pdf'
        ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }, { type: 'text', text: PROMPT }]
        : [{ type: 'image',    source: { type: 'base64', media_type: mimeType, data } },            { type: 'text', text: PROMPT }];

    let response;
    try {
        response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            messages: [{ role: 'user', content }]
        });
    } catch (err) {
        const retryable = err.status === 429 || err.status === 529 || err.status === 503;
        if (retryable && retries > 0) {
            await new Promise(r => setTimeout(r, (3 - retries) * 5000));
            return extractInvoice(client, filePath, retries - 1);
        }
        throw err;
    }

    sessionUsage.input_tokens  += response.usage.input_tokens;
    sessionUsage.output_tokens += response.usage.output_tokens;

    let text = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(text);
    const items  = Array.isArray(parsed) ? parsed : [parsed];
    return items.map(item => ({
        date:           parseDate(item.date),
        invoice_number: cleanInvoiceNum(item.invoice_number),
        tax_id:         cleanStr(item.tax_id),
        store_name:     cleanStr(item.store_name),
        items:          cleanStr(item.items),
        amount:         Number(item.amount) || 0,
        tax:            Number(item.tax)    || 0,
        total:          Number(item.total)  || 0,
        case_name:      '',
    }));
}

// ── Excel ─────────────────────────────────────────────────────────────────────

const COLS = [
    { header: '日期',     key: 'date',           width: 14 },
    { header: '發票號碼', key: 'invoice_number',  width: 16 },
    { header: '統編',     key: 'tax_id',          width: 12 },
    { header: '店家抬頭', key: 'store_name',       width: 22 },
    { header: '品項',     key: 'items',           width: 32 },
    { header: '金額',     key: 'amount',          width: 12 },
    { header: '稅額',     key: 'tax',             width: 10 },
    { header: '總金額',   key: 'total',           width: 12 },
    { header: '案場名稱', key: 'case_name',        width: 20 },
];
const MONEY_COLS = [6, 7, 8];
const SALES_COLS = [
    { header: '日期',       key: 'date',           width: 14 },
    { header: '發票號碼',   key: 'invoice_number',  width: 16 },
    { header: '買受人名稱', key: 'buyer_name',       width: 22 },
    { header: '買受人統編', key: 'buyer_tax_id',     width: 12 },
    { header: '品項',       key: 'items',           width: 32 },
    { header: '金額',       key: 'amount',          width: 12 },
    { header: '稅額',       key: 'tax',             width: 10 },
    { header: '總金額',     key: 'total',           width: 12 },
    { header: '案場名稱',   key: 'case_name',        width: 20 },
];
const H_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C4A6E' } };
const H_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, name: '微軟正黑體', size: 11 };
const D_FONT = { name: '微軟正黑體', size: 10 };
const BORDER = {
    top:    { style: 'thin', color: { argb: 'FFD0D7E0' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D7E0' } },
    left:   { style: 'thin', color: { argb: 'FFD0D7E0' } },
    right:  { style: 'thin', color: { argb: 'FFD0D7E0' } }
};

function styleHeader(row) {
    row.height = 28;
    row.eachCell(cell => {
        cell.fill = H_FILL; cell.font = H_FONT; cell.border = BORDER;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
}

function getBimonthlySheet(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return '日期未知';
    const y = d.getFullYear(), m = d.getMonth() + 1;
    if (m <= 2)  return `${y} 01-02月`;
    if (m <= 4)  return `${y} 03-04月`;
    if (m <= 6)  return `${y} 05-06月`;
    if (m <= 8)  return `${y} 07-08月`;
    if (m <= 10) return `${y} 09-10月`;
    return `${y} 11-12月`;
}

function buildCaseListSheet(ws, caseNames) {
    ws.columns = [{ header: '案場名稱（可直接在此新增或刪除）', key: 'name', width: 36 }];
    styleHeader(ws.getRow(1));
    for (const name of caseNames) {
        const row = ws.addRow([name]);
        row.height = 22;
        row.getCell(1).font      = D_FONT;
        row.getCell(1).border    = BORDER;
        row.getCell(1).alignment = { vertical: 'middle' };
    }
}

function buildSummarySheet(ws, purchaseGroups, salesGroups) {
    ws.columns = [
        { header: '類型',       width: 8  },
        { header: '期間',       width: 16 },
        { header: '筆數',       width: 8  },
        { header: '金額合計',   width: 14 },
        { header: '稅額合計',   width: 12 },
        { header: '總金額合計', width: 14 },
    ];
    styleHeader(ws.getRow(1));

    function addSection(label, groups) {
        if (Object.keys(groups).length === 0) return;
        let totCount = 0, totAmount = 0, totTax = 0, totTotal = 0;
        for (const sn of Object.keys(groups).sort()) {
            const items  = groups[sn];
            const count  = items.length;
            const amount = items.reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const tax    = items.reduce((s, t) => s + (Number(t.tax)    || 0), 0);
            const total  = items.reduce((s, t) => s + (Number(t.total)  || 0), 0);
            totCount += count; totAmount += amount; totTax += tax; totTotal += total;

            const period = sn.replace(/^銷 /, '');
            const row = ws.addRow([label, period, count, amount, tax, total]);
            row.height = 22;
            row.eachCell((cell, col) => {
                cell.font   = D_FONT; cell.border = BORDER;
                cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                cell.alignment = col >= 4 ? { horizontal: 'right', vertical: 'middle' } : { vertical: 'middle' };
                if (col >= 4) cell.numFmt = '#,##0';
            });
        }
        const tRow = ws.addRow([label + '合計', '', totCount, totAmount, totTax, totTotal]);
        tRow.height = 24;
        tRow.eachCell((cell, col) => {
            cell.font   = { ...D_FONT, bold: true }; cell.border = BORDER;
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF4' } };
            cell.alignment = col >= 4 ? { horizontal: 'right', vertical: 'middle' } : { vertical: 'middle' };
            if (col >= 4) cell.numFmt = '#,##0';
        });
    }

    addSection('進項', purchaseGroups);
    addSection('銷項', salesGroups);
}

function buildSheet(ws, items) {
    ws.columns = COLS;
    styleHeader(ws.getRow(1));

    const sorted = [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (let i = 0; i < sorted.length; i++) {
        const t   = sorted[i];
        const row = ws.addRow([
            t.date || '', t.invoice_number || '', t.tax_id || '',
            t.store_name || '', t.items || '',
            Number(t.amount) || 0, Number(t.tax) || 0, Number(t.total) || 0,
            t.case_name || ''
        ]);
        row.height = 22;
        const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF5F7FA';
        row.eachCell((cell, col) => {
            cell.font   = D_FONT; cell.border = BORDER;
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { vertical: 'middle', wrapText: col === 5 };
            if (MONEY_COLS.includes(col)) {
                cell.numFmt    = '#,##0';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        });
        ws.getCell(i + 2, 9).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ["'案場清單'!$A$2:$A$100"]
        };
    }

    const last = sorted.length + 1;
    const tRow = ws.addRow([
        '', '', '', '', '合　計',
        { formula: `SUM(F2:F${last})` },
        { formula: `SUM(G2:G${last})` },
        { formula: `SUM(H2:H${last})` },
        ''
    ]);
    tRow.height = 24;
    tRow.eachCell((cell, col) => {
        cell.font   = { ...D_FONT, bold: true }; cell.border = BORDER;
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF4' } };
        if (MONEY_COLS.includes(col)) {
            cell.numFmt    = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
    });
}

function buildSalesSheet(ws, items) {
    ws.columns = SALES_COLS;
    styleHeader(ws.getRow(1));

    const sorted = [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (let i = 0; i < sorted.length; i++) {
        const t   = sorted[i];
        const row = ws.addRow([
            t.date || '', t.invoice_number || '', t.buyer_name || '', t.buyer_tax_id || '',
            t.items || '',
            Number(t.amount) || 0, Number(t.tax) || 0, Number(t.total) || 0,
            t.case_name || ''
        ]);
        row.height = 22;
        const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF5F7FA';
        row.eachCell((cell, col) => {
            cell.font   = D_FONT; cell.border = BORDER;
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { vertical: 'middle', wrapText: col === 5 };
            if (MONEY_COLS.includes(col)) {
                cell.numFmt    = '#,##0';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        });
        ws.getCell(i + 2, 9).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: ["'案場清單'!$A$2:$A$100"]
        };
    }

    const last = sorted.length + 1;
    const tRow = ws.addRow([
        '', '', '', '', '合　計',
        { formula: `SUM(F2:F${last})` },
        { formula: `SUM(G2:G${last})` },
        { formula: `SUM(H2:H${last})` },
        ''
    ]);
    tRow.height = 24;
    tRow.eachCell((cell, col) => {
        cell.font   = { ...D_FONT, bold: true }; cell.border = BORDER;
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF4' } };
        if (MONEY_COLS.includes(col)) {
            cell.numFmt    = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
    });
}

async function updateExcel(newData, masterPath, defaultCaseNames = [], type = 'purchase') {
    const purchaseData  = [];
    const salesData     = [];
    const seenPurchase  = new Set();
    const seenSales     = new Set();
    let   caseNames     = [];

    if (fs.existsSync(masterPath)) {
        const existing = new ExcelJS.Workbook();
        await existing.xlsx.readFile(masterPath);

        const caseSheet = existing.getWorksheet('案場清單');
        if (caseSheet) {
            caseSheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const val = String(row.values[1] || '').trim();
                if (val) caseNames.push(val);
            });
        }

        existing.eachSheet(ws => {
            if (['年度摘要', '案場清單'].includes(ws.name)) return;
            const isSales = ws.name.startsWith('銷 ');
            ws.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const v = row.values;
                if (!v[1] && !v[2]) return;
                if (String(v[5] || '').trim() === '合　計') return;
                const dateVal    = v[1];
                const dateStr    = dateVal instanceof Date ? dateVal.toISOString().slice(0, 10) : String(dateVal || '');
                const invoiceNum = String(v[2] || '').replace(/[\s\-]/g, '').toUpperCase().trim();
                if (isSales) {
                    salesData.push({
                        date: dateStr, invoice_number: invoiceNum,
                        buyer_name: String(v[3] || ''), buyer_tax_id: String(v[4] || ''),
                        items: String(v[5] || ''),
                        amount: Number(v[6]) || 0, tax: Number(v[7]) || 0, total: Number(v[8]) || 0,
                        case_name: String(v[9] || '')
                    });
                    if (invoiceNum) seenSales.add(invoiceNum);
                } else {
                    purchaseData.push({
                        date: dateStr, invoice_number: invoiceNum,
                        tax_id: String(v[3] || ''), store_name: String(v[4] || ''),
                        items: String(v[5] || ''),
                        amount: Number(v[6]) || 0, tax: Number(v[7]) || 0, total: Number(v[8]) || 0,
                        case_name: String(v[9] || '')
                    });
                    if (invoiceNum) seenPurchase.add(invoiceNum);
                }
            });
        });
    }

    if (caseNames.length === 0) caseNames = defaultCaseNames;

    const targetData = type === 'sales' ? salesData : purchaseData;
    const seenSet    = type === 'sales' ? seenSales  : seenPurchase;

    let added = 0, skipped = 0, duplicates = [];
    for (const item of newData) {
        const num = item.invoice_number || '';
        if (num && seenSet.has(num)) {
            duplicates.push(num);
            skipped++;
            continue;
        }
        targetData.push(item);
        if (num) seenSet.add(num);
        added++;
    }

    const purchaseGroups = {};
    for (const item of purchaseData) {
        const name = getBimonthlySheet(item.date || '');
        if (!purchaseGroups[name]) purchaseGroups[name] = [];
        purchaseGroups[name].push(item);
    }

    const salesGroups = {};
    for (const item of salesData) {
        const name = '銷 ' + getBimonthlySheet(item.date || '');
        if (!salesGroups[name]) salesGroups[name] = [];
        salesGroups[name].push(item);
    }

    const wb = new ExcelJS.Workbook();
    buildSummarySheet(wb.addWorksheet('年度摘要'), purchaseGroups, salesGroups);
    buildCaseListSheet(wb.addWorksheet('案場清單'), caseNames);
    for (const sn of Object.keys(purchaseGroups).sort()) {
        buildSheet(wb.addWorksheet(sn), purchaseGroups[sn]);
    }
    for (const sn of Object.keys(salesGroups).sort()) {
        buildSalesSheet(wb.addWorksheet(sn), salesGroups[sn]);
    }

    try {
        await wb.xlsx.writeFile(masterPath);
    } catch (err) {
        if (err.code === 'EBUSY') throw new Error(`請先關閉桌面的「${path.basename(masterPath)}」再執行`);
        throw err;
    }
    return { added, skipped, duplicates };
}

module.exports = {
    loadConfig, saveConfig,
    parseDate, cleanStr, cleanInvoiceNum,
    extractInvoice, getFlags, isSuspiciousBatch,
    updateExcel,
    calcCost, fmtCost,
    resetSessionUsage, getSessionUsage,
    ALL_EXTS,
};
