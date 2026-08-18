import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const COMPANIES = {
    naiship: {
        name: '奈拾室內裝修設計有限公司',
        logo: 'assets/奈拾設計LOGO2.png',
        stamp: 'assets/奈拾公司章.png',
        email: 'nextdesign62@gmail.com',
        web: 'nextplus-design.com/design',
        logoHeight: '450px',
        logo2Height: '160px',
        bank: { name: '玉山銀行', code: '808-0761', account: '0761-940-050557', branch: '東台南分行', holder: '奈拾室內裝修設計有限公司' },
    },
    // 已核對 quotation-dev.html 第 1774-1783 行原文，跟 naiship 的值不一樣，不能照抄
    baiting: {
        name: '柏延',
        logo: 'assets/柏延LOGO.png',
        stamp: 'assets/柏延公司章.png',
        email: 'nextdesign62@gmail.com',
        web: 'nextplus-design.com/design',
        logoHeight: '208px',
        logo2Height: '60px',
        bank: { name: '玉山銀行', code: '808-0761', account: '0761-940-050817', branch: '東台南分行', holder: '柏延有限公司' },
    },
}
export const WM_LOGOS = { naiship: 'assets/奈拾設計LOGO2.png', baiting: 'assets/柏延LOGO.png' }
export const FLAG_STYLES = [
    null,
    { bg: '#fef9c3', border: '#f59e0b', label: '調整' },
    { bg: '#dcfce7', border: '#22c55e', label: '綁定' },
    { bg: '#dbeafe', border: '#3b82f6', label: '備用' },
]
const CN = ['壹','貳','參','肆','伍','陸','柒','捌','玖','拾','拾壹','拾貳','拾參','拾肆','拾伍','拾陸','拾柒','拾捌','拾玖','貳拾']

// 已核對 quotation-dev.html 第 1728 行原文，逐字搬過來——這是新建/未填合約條款時的預設法律文字，
// loadQuote() 沒帶 contractTerms 時要用這個，不能留空字串（跟舊版 loadQuote 第 2809 行
// `q.contractTerms || DEFAULT_CONTRACT_TERMS` 的 fallback 邏輯一致）
export const DEFAULT_CONTRACT_TERMS = '付款條款：依付款條件約定期程給付，逾期每日加計千分之三違約金。\n工程變更：工程施作期間如需變更設計或材料，須雙方書面同意，並另行議定費用。\n工期延誤：因不可抗力（天災、疫情、供料延誤）造成工期延誤，雙方不互相追究。\n驗收標準：工程完工後，委託人應於 7 日內完成驗收；逾期視為驗收通過。\n保固責任：竣工驗收後，乙方提供 1 年工程保固，材料瑕疵不在此限。\n爭議處理：因本合約發生爭議，雙方同意以台灣台南地方法院為第一審管轄法院。'

function blankQuote() {
    return {
        company: 'naiship', contractNo: '', date: '', clientName: '', project: '',
        clientPhone: '', address: '', designer: '', startDate: '', endDate: '',
        notes: '', contractTerms: '', mgmtPct: 6, discount: 0, tax: false,
        p1: 30, p2: 30, p3: 30, p4: 10, p5: 0, p6: 0,
        p1amt: '', p2amt: '', p3amt: '', p4amt: '', p5amt: '', p6amt: '',
        versionLabel: '', sourceId: '', categories: [],
    }
}

export const useQuotationStore = defineStore('quotation', () => {
    const quote = ref(blankQuote())

    function loadQuote(q) {
        quote.value = { ...blankQuote(), ...q, contractTerms: (q && q.contractTerms) || DEFAULT_CONTRACT_TERMS }
    }

    function cnNum(n) { return CN[n] || String(n + 1) }

    function getCatTotal(cat) {
        return (cat.subItems || []).reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0)
    }
    function getCatCost(cat) {
        return (cat.subItems || []).reduce((s, i) => s + (i.cost || 0) * (i.qty || 0), 0)
    }

    const subtotal = computed(() => quote.value.categories.reduce((s, cat) => s + getCatTotal(cat), 0))
    const totalCost = computed(() => quote.value.categories.reduce((s, cat) => s + getCatCost(cat), 0))
    const mgmtAmount = computed(() => Math.round(subtotal.value * (quote.value.mgmtPct || 0) / 100))
    const taxAmount = computed(() => {
        if (!quote.value.tax) return 0
        const base = subtotal.value + mgmtAmount.value - (quote.value.discount || 0)
        return Math.round(base * 0.05)
    })
    const total = computed(() => subtotal.value + mgmtAmount.value - (quote.value.discount || 0) + taxAmount.value)
    const profit = computed(() => total.value - totalCost.value)
    const profitPct = computed(() => total.value > 0 ? (profit.value / total.value * 100).toFixed(1) + '%' : '—')

    return {
        quote, loadQuote, cnNum, getCatTotal, getCatCost,
        subtotal, totalCost, mgmtAmount, taxAmount, total, profit, profitPct,
    }
})
