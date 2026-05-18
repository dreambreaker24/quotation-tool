const { GoogleGenerativeAI } = require('@google/generative-ai');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const PDF_EXT   = '.pdf';
const ALL_EXTS  = [...IMAGE_EXTS, PDF_EXT];
const MEDIA_TYPES = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png',  '.gif': 'image/gif', '.webp': 'image/webp',
    '.pdf': 'application/pdf'
};
const CONCURRENCY = 2;

// ── Config ────────────────────────────────────────────────────────────────────

const CFG_PATH = path.join(__dirname, 'config.json');
const LOG_PATH = path.join(__dirname, 'log.txt');

function loadConfig() {
    try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); }
    catch { return { gemini_api_key: '', case_names: [] }; }
}

function saveConfig(config) {
    fs.writeFileSync(CFG_PATH, JSON.stringify(config, null, 4), 'utf8');
}

// ── 日期正規化 ────────────────────────────────────────────────────────────────

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

// ── Gemini API ────────────────────────────────────────────────────────────────

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

function cleanStr(s) {
    return String(s || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

function cleanInvoiceNum(s) {
    return cleanStr(s).replace(/[\s\-]/g, '').toUpperCase();
}

async function extractInvoice(model, filePath) {
    const ext      = path.extname(filePath).toLowerCase();
    const data     = fs.readFileSync(filePath).toString('base64');
    const mimeType = MEDIA_TYPES[ext] || 'image/jpeg';

    const result = await model.generateContent([
        { inlineData: { data, mimeType } },
        PROMPT
    ]);

    let text = result.response.text().trim()
        .replace(/^```json\s*/i, '').replace(/\s*```$/, '');
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

async function processFiles(model, files) {
    const results = new Array(files.length);
    let completed = 0;
    const queue   = files.map((_, i) => i);

    async function worker() {
        while (true) {
            const i = queue.shift();
            if (i === undefined) break;
            const p = files[i];
            try {
                const items = await extractInvoice(model, p);
                results[i]  = { ok: true, items };
                completed++;
                if (items.length === 1) {
                    const d = items[0];
                    console.log(`✓ [${completed}/${files.length}] ${path.basename(p)}  ${d.date || '?'}  ${d.store_name || '?'}  $${Number(d.total || 0).toLocaleString()}`);
                } else {
                    console.log(`✓ [${completed}/${files.length}] ${path.basename(p)}  → ${items.length} 張`);
                    items.forEach((d, j) => console.log(
                        `     第 ${j+1}/${items.length} 張  ${d.date || '?'}  ${d.store_name || '?'}  $${Number(d.total || 0).toLocaleString()}`
                    ));
                }
            } catch (err) {
                results[i] = { ok: false, error: err.message };
                completed++;
                console.log(`✗ [${completed}/${files.length}] ${path.basename(p)}  辨識失敗：${err.message}`);
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
    return results;
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
        row.getCell(1).font   = D_FONT;
        row.getCell(1).border = BORDER;
        row.getCell(1).alignment = { vertical: 'middle' };
    }
}

function buildSummarySheet(ws, groups) {
    ws.columns = [
        { header: '期間',       width: 16 },
        { header: '筆數',       width: 8  },
        { header: '金額合計',   width: 14 },
        { header: '稅額合計',   width: 12 },
        { header: '總金額合計', width: 14 },
    ];
    styleHeader(ws.getRow(1));

    let totCount = 0, totAmount = 0, totTax = 0, totTotal = 0;
    for (const sn of Object.keys(groups).sort()) {
        const items  = groups[sn];
        const count  = items.length;
        const amount = items.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const tax    = items.reduce((s, t) => s + (Number(t.tax)    || 0), 0);
        const total  = items.reduce((s, t) => s + (Number(t.total)  || 0), 0);
        totCount += count; totAmount += amount; totTax += tax; totTotal += total;

        const row = ws.addRow([sn, count, amount, tax, total]);
        row.height = 22;
        row.eachCell((cell, col) => {
            cell.font = D_FONT; cell.border = BORDER;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.alignment = col >= 3 ? { horizontal: 'right', vertical: 'middle' } : { vertical: 'middle' };
            if (col >= 3) cell.numFmt = '#,##0';
        });
    }

    const tRow = ws.addRow(['合計', totCount, totAmount, totTax, totTotal]);
    tRow.height = 24;
    tRow.eachCell((cell, col) => {
        cell.font = { ...D_FONT, bold: true }; cell.border = BORDER;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF4' } };
        cell.alignment = col >= 3 ? { horizontal: 'right', vertical: 'middle' } : { vertical: 'middle' };
        if (col >= 3) cell.numFmt = '#,##0';
    });
}

function buildSheet(ws, items) {
    ws.columns = COLS;
    styleHeader(ws.getRow(1));

    const sorted = [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (let i = 0; i < sorted.length; i++) {
        const t = sorted[i];
        const row = ws.addRow([
            t.date || '', t.invoice_number || '', t.tax_id || '',
            t.store_name || '', t.items || '',
            Number(t.amount) || 0, Number(t.tax) || 0, Number(t.total) || 0,
            t.case_name || ''
        ]);
        row.height = 22;
        const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF5F7FA';
        row.eachCell((cell, col) => {
            cell.font = D_FONT; cell.border = BORDER;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { vertical: 'middle', wrapText: col === 5 };
            if (MONEY_COLS.includes(col)) {
                cell.numFmt = '#,##0';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        });
        // 案場名稱下拉（參照「案場清單」分頁）
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
        cell.font = { ...D_FONT, bold: true }; cell.border = BORDER;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF4' } };
        if (MONEY_COLS.includes(col)) {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
    });
}

async function updateExcel(newData, onDuplicate, masterPath, defaultCaseNames = []) {
    const allData  = [];
    const seenNums = new Set();
    let   caseNames = [];

    if (fs.existsSync(masterPath)) {
        const existing = new ExcelJS.Workbook();
        await existing.xlsx.readFile(masterPath);

        // 讀取並保留案場清單
        const caseSheet = existing.getWorksheet('案場清單');
        if (caseSheet) {
            caseSheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const val = String(row.values[1] || '').trim();
                if (val) caseNames.push(val);
            });
        }

        // 讀取現有發票資料
        existing.eachSheet(ws => {
            if (['年度摘要', '案場清單'].includes(ws.name)) return;
            ws.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const v = row.values;
                if (!v[1] && !v[2]) return;
                if (String(v[5] || '').trim() === '合　計') return;
                const dateVal    = v[1];
                const dateStr    = dateVal instanceof Date ? dateVal.toISOString().slice(0, 10) : String(dateVal || '');
                const invoiceNum = String(v[2] || '').replace(/[\s\-]/g, '').toUpperCase().trim();
                allData.push({
                    date: dateStr, invoice_number: invoiceNum,
                    tax_id: String(v[3] || ''), store_name: String(v[4] || ''),
                    items: String(v[5] || ''),
                    amount: Number(v[6]) || 0, tax: Number(v[7]) || 0, total: Number(v[8]) || 0,
                    case_name: String(v[9] || '')
                });
                if (invoiceNum) seenNums.add(invoiceNum);
            });
        });
    }

    // 首次建立時，從公司設定取案場清單
    if (caseNames.length === 0) {
        caseNames = defaultCaseNames;
    }

    // 合併新資料（發票號碼去重，有重複時呼叫 onDuplicate）
    let added = 0, skipped = 0;
    for (const item of newData) {
        const num = item.invoice_number || '';
        if (num && seenNums.has(num)) {
            const action = onDuplicate ? await onDuplicate(num, item) : 'skip';
            if (action === 'skip') { skipped++; continue; }
            if (action === 'overwrite') {
                const idx = allData.findIndex(d => d.invoice_number === num);
                if (idx !== -1) { allData.splice(idx, 1); seenNums.delete(num); }
            }
            // 'keep'：兩筆都保留，直接 fall-through
        }
        allData.push(item);
        if (num) seenNums.add(num);
        added++;
    }

    // 分組
    const groups = {};
    for (const item of allData) {
        const name = getBimonthlySheet(item.date || '');
        if (!groups[name]) groups[name] = [];
        groups[name].push(item);
    }

    // 重建 Excel
    const wb = new ExcelJS.Workbook();
    buildSummarySheet(wb.addWorksheet('年度摘要'), groups);
    buildCaseListSheet(wb.addWorksheet('案場清單'), caseNames);
    for (const sn of Object.keys(groups).sort()) {
        buildSheet(wb.addWorksheet(sn), groups[sn]);
    }

    try {
        await wb.xlsx.writeFile(masterPath);
    } catch (err) {
        if (err.code === 'EBUSY') throw new Error(`請先關閉桌面的「${path.basename(masterPath)}」再執行`);
        throw err;
    }
    return { added, skipped };
}

// ── Log & 移動檔案 ────────────────────────────────────────────────────────────

function moveToProcessed(files, folder) {
    const dest = path.join(folder, '已處理');
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const file of files) {
        const base   = path.basename(file, path.extname(file));
        const ext    = path.extname(file);
        const target = path.join(dest, path.basename(file));
        const final  = fs.existsSync(target)
            ? path.join(dest, `${base}_${Date.now()}${ext}`) : target;
        fs.renameSync(file, final);
    }
}

// ── CLI helpers ───────────────────────────────────────────────────────────────

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, ans => resolve(ans.trim())));

async function manualInput() {
    const date           = await ask('  日期 (YYYY-MM-DD)：');
    const invoice_number = await ask('  發票號碼：');
    const tax_id         = await ask('  統編（無則 Enter）：');
    const store_name     = await ask('  店家抬頭：');
    const items          = await ask('  品項：');
    const amount         = parseFloat(await ask('  金額（不含稅）：')) || 0;
    const tax            = parseFloat(await ask('  稅額：')) || 0;
    const total          = amount + tax;
    console.log(`  總金額（自動加總）：$${total.toLocaleString()}`);
    return { date: parseDate(date), invoice_number: cleanInvoiceNum(invoice_number), tax_id: cleanStr(tax_id), store_name: cleanStr(store_name), items: cleanStr(items), amount, tax, total, case_name: '' };
}

// ── 工作流程 ──────────────────────────────────────────────────────────────────

async function scanFlow(model, scanFolder, masterPath, defaultCaseNames, ownNames = []) {
    const folder = scanFolder;
    if (!fs.existsSync(folder)) { console.log(`找不到資料夾：${folder}`); return; }

    const files = fs.readdirSync(folder)
        .filter(f => ALL_EXTS.includes(path.extname(f).toLowerCase()))
        .map(f => path.join(folder, f));

    if (files.length === 0) { console.log('找不到發票檔案（支援 jpg / png / pdf）'); return; }
    console.log(`\n找到 ${files.length} 個檔案，開始辨識（最多 ${CONCURRENCY} 張同時進行）...\n`);

    const apiResults = await processFiles(model, files);

    const currentYear = new Date().getFullYear();

    function isSuspiciousBatch(items) {
        if (items.length < 5) return false;
        const first = items[0];
        return items.every(item => item.store_name === first.store_name && item.date === first.date);
    }

    function getFlags(item) {
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

    // 分類辨識結果（failed: true = 辨識失敗，顯示在表格中）
    const candidates  = [];
    const autoSkipped = [];

    for (let i = 0; i < files.length; i++) {
        const r    = apiResults[i];
        const file = files[i];
        if (!r.ok) {
            candidates.push({ invoice: null, sourceFile: file, flags: ['⚠辨識失敗'], failed: true });
            continue;
        }
        if (isSuspiciousBatch(r.items)) {
            console.log(`\n⚠ 疑似 AI 幻覺，自動略過：${path.basename(file)}`);
            console.log(`   （${r.items.length} 張全是「${r.items[0].store_name}」${r.items[0].date}）`);
            autoSkipped.push(file);
            continue;
        }
        for (const item of r.items) {
            candidates.push({ invoice: item, sourceFile: file, flags: getFlags(item), failed: false });
        }
    }

    // 顯示預覽表格
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  辨識結果預覽（確認後才會匯入 Excel）');
    console.log('══════════════════════════════════════════════════════════════');

    if (candidates.length === 0) {
        console.log('  （無可預覽的發票）');
    } else {
        console.log('  #    日期        店家抬頭               總金額    發票號碼');
        console.log('  ──────────────────────────────────────────────────────────');
        for (let i = 0; i < candidates.length; i++) {
            const { invoice, flags, failed, sourceFile } = candidates[i];
            const idx = String(i + 1).padStart(3);
            if (failed) {
                console.log(`  ${idx}. ${path.basename(sourceFile).slice(0, 42)}  ⚠辨識失敗`);
            } else {
                const date    = (invoice.date || '').padEnd(10);
                const store   = (invoice.store_name || '(空)').slice(0, 20).padEnd(20);
                const total   = `$${Number(invoice.total || 0).toLocaleString()}`.padStart(9);
                const num     = (invoice.invoice_number || '').padEnd(12);
                const flagStr = flags.length > 0 ? `  ${flags.join(' ')}` : '';
                console.log(`  ${idx}. ${date}  ${store}  ${total}  ${num}${flagStr}`);
            }
        }
    }

    console.log('══════════════════════════════════════════════════════════════');

    if (candidates.length === 0) {
        console.log('\n沒有可匯入的發票');
        return;
    }

    console.log('\n  Enter = 全部匯入  |  數字 = 略過（如 1,3）  |  w2 = 手動輸入/修改第 2 筆  |  q = 取消');
    const ans = await ask('請輸入：');

    if (ans.toLowerCase() === 'q') {
        console.log('已取消，未匯入任何資料');
        return;
    }

    // 解析略過號碼與手動編輯號碼
    const skipIndices = new Set();
    const editIndices = new Set();
    if (ans.trim()) {
        for (const s of ans.split(',')) {
            const token = s.trim();
            if (/^w\d+$/i.test(token)) {
                const n = parseInt(token.slice(1));
                if (n >= 1 && n <= candidates.length) editIndices.add(n - 1);
            } else {
                const n = parseInt(token);
                if (!isNaN(n) && n >= 1 && n <= candidates.length) skipIndices.add(n - 1);
            }
        }
    }

    // 手動輸入/修改指定筆數（w 指令）
    for (const idx of [...editIndices].sort((a, b) => a - b)) {
        const c = candidates[idx];
        if (c.failed) {
            console.log(`\n── 手動輸入：${path.basename(c.sourceFile)} ──`);
        } else {
            console.log(`\n── 修改第 ${idx + 1} 筆（原：${c.invoice.store_name || '?'}  $${Number(c.invoice.total || 0).toLocaleString()}）──`);
        }
        candidates[idx] = { ...c, invoice: await manualInput(), failed: false };
    }

    // 建立最終匯入清單（辨識失敗且未用 w 指定的，詢問是否手動輸入）
    const toImport = [];
    const inlineManualIndices = new Set();
    for (let i = 0; i < candidates.length; i++) {
        if (skipIndices.has(i)) continue;
        const c = candidates[i];
        if (c.failed) {
            console.log(`\n⚠ 辨識失敗：${path.basename(c.sourceFile)}`);
            const yn = await ask('  是否手動輸入？(y/n)：');
            if (yn.toLowerCase() === 'y') {
                inlineManualIndices.add(i);
                let n = 0;
                while (true) {
                    n++;
                    console.log(`\n  ── 第 ${n} 張 ──`);
                    toImport.push(await manualInput());
                    const more = await ask('  還有下一張？(y/n)：');
                    if (more.toLowerCase() !== 'y') break;
                }
            }
            continue;
        }
        toImport.push(c.invoice);
    }

    if (toImport.length === 0) {
        console.log('\n沒有選擇匯入任何資料');
        return;
    }

    // 移動已處理檔案（候選檔、自動略過的幻覺檔）
    const filesToMove = new Set([
        ...candidates.map(c => c.sourceFile),
        ...autoSkipped,
    ]);
    moveToProcessed([...filesToMove], folder);
    console.log(`\n已移動 ${filesToMove.size} 個檔案至「已處理」資料夾`);

    const { added, skipped } = await updateExcel(toImport, async (num, item) => {
        console.log(`\n⚠ 重複發票：${num}  ${item.store_name || ''}  ${item.date || ''}  $${Number(item.total || 0).toLocaleString()}`);
        console.log('   1. 略過（保留原有資料）');
        console.log('   2. 覆蓋舊資料');
        console.log('   3. 兩筆都保留');
        const c = await ask('   請選擇 (1/2/3)：');
        if (c === '2') return 'overwrite';
        if (c === '3') return 'keep';
        return 'skip';
    }, masterPath, defaultCaseNames);

    // 寫入 log
    const ts = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const logLines = [`\n=== ${ts}  資料夾：${path.resolve(folder)} ===`];
    for (let i = 0; i < candidates.length; i++) {
        const { invoice, sourceFile, failed } = candidates[i];
        const name = path.basename(sourceFile);
        if (skipIndices.has(i)) {
            logLines.push(`  ✗ ${name}  略過`);
        } else if (failed && !inlineManualIndices.has(i)) {
            logLines.push(`  ✗ ${name}  辨識失敗略過`);
        } else if (editIndices.has(i) || inlineManualIndices.has(i)) {
            logLines.push(`  ✎ ${name}  手動輸入  ${invoice ? (invoice.store_name || '?') : '?'}  $${Number((invoice || {}).total || 0).toLocaleString()}`);
        } else {
            logLines.push(`  ✓ ${name}  ${invoice.date || '?'}  ${invoice.store_name || '?'}  $${Number(invoice.total || 0).toLocaleString()}`);
        }
    }
    for (const file of autoSkipped) {
        logLines.push(`  ⚠ ${path.basename(file)}  自動略過（疑似 AI 幻覺）`);
    }
    logLines.push(`  → 新增 ${added} 筆，略過重複 ${skipped} 筆`);
    fs.appendFileSync(LOG_PATH, logLines.join('\n') + '\n', 'utf8');

    console.log(`\n完成！新增 ${added} 筆，略過重複 ${skipped} 筆`);
    console.log(`請開啟桌面的「${path.basename(masterPath)}」，在案場名稱欄選擇下拉選項`);
    console.log(`執行紀錄：${LOG_PATH}`);
}

async function manualFlow(masterPath, defaultCaseNames) {
    console.log('（案場名稱請在 Excel 下拉選單填入）\n');
    const data = await manualInput();
    const { added, skipped } = await updateExcel([data], async (num, item) => {
        console.log(`\n⚠ 發票號碼 ${num} 已存在`);
        console.log('   1. 略過（保留原有資料）');
        console.log('   2. 覆蓋舊資料');
        const c = await ask('   請選擇 (1/2)：');
        return c === '2' ? 'overwrite' : 'skip';
    }, masterPath, defaultCaseNames);
    console.log(`\n完成！新增 ${added} 筆，略過重複 ${skipped} 筆`);
    console.log(`總表位置：${masterPath}`);
}

// ── 主選單 ────────────────────────────────────────────────────────────────────

function printMenu() {
    console.log('\n══════════════════════════');
    console.log('      發票整理報帳系統');
    console.log('══════════════════════════');
    console.log('  1. 掃描發票資料夾');
    console.log('  2. 手動輸入發票');
    console.log('  3. 結束');
    console.log('══════════════════════════\n');
}

async function main() {
    const config = loadConfig();

    let apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('請先取得 Google Gemini API Key（免費）：aistudio.google.com');
        apiKey = await ask('Gemini API Key：');
        config.gemini_api_key = apiKey;
        saveConfig(config);
        console.log('  API Key 已儲存\n');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // 選擇公司
    console.log('\n══════════════════════════');
    console.log('      請選擇發票類別');
    console.log('══════════════════════════');
    console.log('  1. 奈拾設計');
    console.log('  2. 柏延');
    console.log('══════════════════════════\n');
    const coChoice = await ask('請選擇 (1/2)：');
    const companyKey = coChoice === '2' ? '柏延' : '奈拾設計';
    const companies  = config.companies || {};
    const co         = companies[companyKey] || {};
    const scanFolder     = co.scan_folder || `C:\\scan\\發票\\${companyKey}`;
    const masterPath     = path.join(os.homedir(), 'Desktop', co.excel_name || `${companyKey}_發票報帳總表.xlsx`);
    const defaultCaseNames = co.case_names || [];
    const ownNames         = co.own_names  || [];
    console.log(`\n已選擇：${companyKey}\n`);

    while (true) {
        printMenu();
        const choice = await ask('請選擇：');
        switch (choice) {
            case '1': await scanFlow(model, scanFolder, masterPath, defaultCaseNames, ownNames); break;
            case '2': await manualFlow(masterPath, defaultCaseNames);                  break;
            case '3': rl.close(); process.exit(0);
            default:  console.log('請輸入 1-3');
        }
        if (choice !== '3') await ask('\n按 Enter 繼續...');
    }
}

main().catch(err => { console.error('\n錯誤：', err.message); rl.close(); process.exit(1); });
