const express   = require('express');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');
const Anthropic = require('@anthropic-ai/sdk');
const core      = require('./invoice_core');

const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, unique + path.extname(file.originalname).toLowerCase());
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, core.ALL_EXTS.includes(ext));
    }
});

app.get('/api/config', (req, res) => {
    const config    = core.loadConfig();
    const companies = config.companies || {};
    const caseNames = {};
    for (const [name, co] of Object.entries(companies)) {
        caseNames[name] = co.case_names || [];
    }
    res.json({ companies: Object.keys(companies), caseNames });
});

app.get('/api/usage', (req, res) => {
    const config   = core.loadConfig();
    const monthKey = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 7);
    const mo       = (config.monthly_usage || {})[monthKey] || { files_scanned: 0, invoices_added: 0, input_tokens: 0, output_tokens: 0 };
    const costUsd  = core.calcCost(mo.input_tokens, mo.output_tokens);
    res.json({ monthKey, ...mo, cost_usd: costUsd, cost_twd: +(costUsd * 32.5).toFixed(1) });
});

app.post('/api/scan', upload.array('files'), async (req, res) => {
    const { company } = req.body;
    if (!company) return res.status(400).json({ error: '請選擇公司' });

    const config = core.loadConfig();
    if (!config.anthropic_api_key) return res.status(500).json({ error: '未設定 Anthropic API Key' });

    const co       = (config.companies || {})[company] || {};
    const ownNames = co.own_names || [];
    const client   = new Anthropic({ apiKey: config.anthropic_api_key });

    core.resetSessionUsage();

    const results = [];
    for (const file of req.files) {
        try {
            const invoices = await core.extractInvoice(client, file.path);
            if (core.isSuspiciousBatch(invoices)) {
                results.push({ sourceFile: file.filename, failed: true, error: '疑似 AI 幻覺（多張相同店家/日期），請手動確認', flags: ['⚠疑似幻覺'] });
            } else {
                for (const inv of invoices) {
                    results.push({ ...inv, sourceFile: file.filename, flags: core.getFlags(inv, ownNames), failed: false });
                }
            }
        } catch (err) {
            results.push({ sourceFile: file.filename, failed: true, error: err.message, flags: ['⚠辨識失敗'] });
        }
    }

    const usage    = core.getSessionUsage();
    const costUsd  = core.calcCost(usage.input_tokens, usage.output_tokens);
    const monthKey = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 7);

    if (!config.monthly_usage) config.monthly_usage = {};
    if (!config.monthly_usage[monthKey]) config.monthly_usage[monthKey] = { input_tokens: 0, output_tokens: 0, files_scanned: 0, invoices_added: 0 };
    config.monthly_usage[monthKey].input_tokens  += usage.input_tokens;
    config.monthly_usage[monthKey].output_tokens += usage.output_tokens;
    config.monthly_usage[monthKey].files_scanned += req.files.length;
    core.saveConfig(config);

    res.json({ results, usage: { ...usage, cost_usd: costUsd, cost_twd: +(costUsd * 32.5).toFixed(1) } });
});

app.post('/api/export', async (req, res) => {
    const { company, invoices } = req.body;
    if (!company || !Array.isArray(invoices)) return res.status(400).json({ error: '參數錯誤' });

    const config           = core.loadConfig();
    const co               = (config.companies || {})[company] || {};
    const masterPath       = path.join(os.homedir(), 'Desktop', co.excel_name || `${company}_發票報帳總表.xlsx`);
    const defaultCaseNames = co.case_names || [];

    try {
        const { added, skipped, duplicates } = await core.updateExcel(invoices, masterPath, defaultCaseNames);

        const monthKey = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 7);
        if (!config.monthly_usage) config.monthly_usage = {};
        if (!config.monthly_usage[monthKey]) config.monthly_usage[monthKey] = { input_tokens: 0, output_tokens: 0, files_scanned: 0, invoices_added: 0 };
        config.monthly_usage[monthKey].invoices_added += added;
        core.saveConfig(config);

        const seen = new Set(invoices.map(i => i.sourceFile).filter(Boolean));
        for (const fname of seen) {
            const fp = path.join(uploadDir, fname);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }

        res.json({ added, skipped, duplicates, masterPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sales', async (req, res) => {
    const { company, invoices } = req.body;
    if (!company || !Array.isArray(invoices)) return res.status(400).json({ error: '參數錯誤' });

    const config           = core.loadConfig();
    const co               = (config.companies || {})[company] || {};
    const masterPath       = path.join(os.homedir(), 'Desktop', co.excel_name || `${company}_發票報帳總表.xlsx`);
    const defaultCaseNames = co.case_names || [];

    try {
        const { added, skipped, duplicates } = await core.updateExcel(invoices, masterPath, defaultCaseNames, 'sales');
        res.json({ added, skipped, duplicates, masterPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n  發票報帳系統已啟動：http://localhost:${PORT}`);
    console.log('  按 Ctrl+C 結束\n');
});
