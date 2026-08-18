<template>
  <!-- line-height:normal 是刻意加的：Tailwind preflight 把 html line-height 設成 1.5，
       會蓋過瀏覽器預設值滲進表格列高，跟獨立的 quotation-dev.html（沒有任何 CSS reset，
       用瀏覽器預設 normal）不一致，逐大項累加下來會造成明顯的排版偏移 -->
  <div id="a4-page" style="width:210mm; min-height:297mm; background:#fff; padding:4mm 16mm 20mm 16mm; box-shadow:0 2px 12px rgba(0,0,0,0.15); font-family:'Microsoft JhengHei','Noto Sans TC',sans-serif; font-size:11pt; color:#1a1a1a; position:relative; line-height:normal;">
    <img class="page-watermark" :src="wmLogo" alt="">

    <div style="display:flex; justify-content:space-between; align-items:center; background:#2C2C2C; border-bottom:3px solid #c9a96e; margin: -4mm -16mm 0 -16mm; padding: 0 16mm; height:50mm; overflow:hidden;">
      <div style="display:flex; align-items:center;">
        <img :src="company.logo" :alt="company.name" :style="`height:${company.logoHeight};object-fit:contain;display:block;margin-left:-10px;filter:drop-shadow(0 0 4px rgba(255,255,255,0.95)) drop-shadow(0 0 16px rgba(255,220,150,0.8)) drop-shadow(0 0 40px rgba(201,169,110,0.5));`">
      </div>
      <div style="font-size:10pt; text-align:left; display:flex; flex-direction:column; justify-content:center; color:#fff;">
        <div style="margin-bottom:5px;">合約編號：{{ quote.contractNo }}</div>
        <div style="margin-bottom:5px;">報價日期：{{ quote.date }}<span v-if="quote.versionLabel" style="margin-left:6px; font-size:9pt; opacity:0.8;">{{ quote.versionLabel }}</span></div>
        <div style="margin-bottom:5px; font-size:9pt; color:#e0e0e0;">官網：{{ company.web }}</div>
        <div style="font-size:9pt; color:#e0e0e0;">Email：{{ company.email }}</div>
      </div>
    </div>

    <div style="text-align:center; font-size:18pt; font-weight:bold; letter-spacing:4px; padding: 2mm 0 1mm 0;">報價單</div>
    <hr style="border:none; border-top:2px solid #2C2C2C; margin: 0 0 2mm 0;">

    <table style="width:100%; margin-bottom:2mm; font-size:10pt; border-collapse:collapse;">
      <tr>
        <td style="width:14%; color:#555; padding:2px 0;">委託人</td>
        <td style="width:36%; font-weight:bold;">{{ quote.clientName }}</td>
        <td style="width:14%; color:#555; padding:2px 0;">設計師</td>
        <td style="width:36%;">{{ quote.designer }}</td>
      </tr>
      <tr>
        <td style="color:#555; padding:2px 0;">施工項目</td>
        <td>{{ quote.project }}</td>
        <td style="color:#555; padding:2px 0;">聯絡電話</td>
        <td>{{ quote.clientPhone }}</td>
      </tr>
      <tr>
        <td style="color:#555; padding:2px 0;">施工地址</td>
        <td>{{ quote.address }}</td>
        <td style="color:#555; padding:2px 0;">工程期限</td>
        <td>{{ quote.startDate }} ～ {{ quote.endDate }}</td>
      </tr>
    </table>

    <table style="width:100%; border-collapse:collapse; margin-bottom:2mm; font-size:10pt;">
      <thead>
        <tr style="background:#2C2C2C; color:#fff;">
          <th style="padding:4px 8px; text-align:center; width:9%;">項次</th>
          <th style="padding:4px 8px; text-align:left; width:37%;">工程項目</th>
          <th style="padding:4px 8px; text-align:right; width:9%;">數量</th>
          <th style="padding:4px 8px; text-align:center; width:9%;">單位</th>
          <th style="padding:4px 8px; text-align:right; width:18%;">複價</th>
          <th class="cost-col" style="padding:4px 8px; text-align:right; width:18%;">成本</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(cat, idx) in quote.categories" :key="idx" data-test="item-row" :style="`background:${idx % 2 === 0 ? '#fff' : '#f9f9f9'}`">
          <td style="padding:3px 8px; border-bottom:1px solid #eee; text-align:center;">{{ store.cnNum(idx) }}</td>
          <td style="padding:3px 8px; border-bottom:1px solid #eee;">{{ cat.name || '—' }}</td>
          <td style="padding:3px 8px; border-bottom:1px solid #eee; text-align:right;">{{ cat.qty || 1 }}</td>
          <td style="padding:3px 8px; border-bottom:1px solid #eee; text-align:center;">{{ cat.unit }}</td>
          <td style="padding:3px 8px; border-bottom:1px solid #eee; text-align:right; font-weight:bold;">{{ store.getCatTotal(cat).toLocaleString() }}</td>
          <td class="cost-col" style="padding:3px 8px; border-bottom:1px solid #eee; text-align:right; color:#888;">{{ store.getCatCost(cat) > 0 ? store.getCatCost(cat).toLocaleString() : '—' }}</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1mm;">
      <div style="font-size:9pt; color:#444; line-height:1.8; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden; min-width:170px;">
        <div style="background:#2C2C2C; color:#fff; padding:4px 10px; font-size:10pt; font-weight:bold; border-left:3px solid #c9a96e;">匯款資訊</div>
        <div style="padding:5px 10px; line-height:1.9;">
          <div>銀行：{{ company.bank.name }} | {{ company.bank.code }}</div>
          <div>帳號：{{ company.bank.account }}</div>
          <div>分行：{{ company.bank.branch }}</div>
          <div>戶名：{{ company.bank.holder }}</div>
        </div>
      </div>
      <table style="width:240px; font-size:10pt; border-collapse:collapse;">
        <tr>
          <td style="padding:3px 8px; color:#555;">工程小計</td>
          <td style="padding:3px 8px; text-align:right;">${{ store.subtotal.toLocaleString() }}</td>
        </tr>
        <tr v-if="quote.mgmtPct > 0" data-test="mgmt-row">
          <td style="padding:3px 8px; color:#555;">工程管理費（{{ quote.mgmtPct }}%）</td>
          <td style="padding:3px 8px; text-align:right;">${{ store.mgmtAmount.toLocaleString() }}</td>
        </tr>
        <tr v-if="quote.discount > 0" data-test="discount-row">
          <td style="padding:3px 8px; color:#555;">折扣</td>
          <td style="padding:3px 8px; text-align:right; color:#e53935;">-${{ quote.discount.toLocaleString() }}</td>
        </tr>
        <tr v-if="quote.tax" data-test="tax-row">
          <td style="padding:3px 8px; color:#555;">稅金（5%）</td>
          <td style="padding:3px 8px; text-align:right;">${{ store.taxAmount.toLocaleString() }}</td>
        </tr>
        <tr style="border-top:2px solid #2C2C2C; font-weight:bold; font-size:12pt; color:#e53935;">
          <td style="padding:6px 8px;">總額</td>
          <td style="padding:6px 8px; text-align:right;">${{ store.total.toLocaleString() }}</td>
        </tr>
      </table>
    </div>

    <div v-if="store.totalCost > 0" id="prev-cost-section" class="cost-block" style="display:flex; justify-content:flex-end; margin-bottom:1mm;">
      <table style="width:280px; font-size:10pt; border-collapse:collapse; border-top:1px dashed #ccc; padding-top:4px;">
        <tr>
          <td style="padding:2px 8px; color:#888;">成本合計</td>
          <td style="padding:2px 8px; text-align:right;">${{ store.totalCost.toLocaleString() }}</td>
        </tr>
        <tr>
          <td style="padding:2px 8px; color:#888;">預估利潤</td>
          <td style="padding:2px 8px; text-align:right;">${{ store.profit.toLocaleString() }}</td>
        </tr>
        <tr style="font-weight:bold;">
          <td style="padding:2px 8px; color:#888;">利潤比例</td>
          <td style="padding:2px 8px; text-align:right; color:#e53935;">{{ store.profitPct }}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:2mm; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden;">
      <div style="background:#2C2C2C; color:#fff; padding:4px 10px; font-size:10pt; font-weight:bold; border-left:3px solid #c9a96e;">備註</div>
      <div style="font-size:10pt; color:#444; padding:5px 10px; white-space:pre-wrap; min-height:16px;">{{ quote.notes || '—' }}</div>
    </div>

    <div style="margin-bottom:2mm; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden;">
      <div style="background:#2C2C2C; color:#fff; padding:4px 10px; font-size:10pt; font-weight:bold; border-left:3px solid #c9a96e;">付款條件</div>
      <table style="width:100%; font-size:10pt; border-collapse:collapse;">
        <tr v-for="(row, r) in paymentRows" :key="r" :style="`background:${r % 2 === 0 ? '#fff' : '#fafaf8'}; border-bottom:1px solid #f0f0f0;`">
          <td style="padding:4px 7px; color:#555;">{{ row[0].label }}</td>
          <td style="padding:4px 7px;">{{ row[0].pct }}%</td>
          <td style="padding:4px 9px; font-weight:bold; color:#e53935;">{{ row[0].amount ? '$' + row[0].amount.toLocaleString() : '' }}</td>
          <td style="padding:4px 7px 4px 18px; color:#555;">{{ row[1].label }}</td>
          <td style="padding:4px 7px;">{{ row[1].pct }}%</td>
          <td style="padding:4px 9px; font-weight:bold; color:#e53935;">{{ row[1].amount ? '$' + row[1].amount.toLocaleString() : '' }}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:2mm; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden; font-size:9pt; color:#444; line-height:1.4;">
      <div style="background:#2C2C2C; color:#fff; padding:4px 10px; font-size:10pt; font-weight:bold; border-left:3px solid #c9a96e;">合約條款</div>
      <ol style="padding:4px 10px 5px 26px; margin:0;">
        <li v-for="(line, i) in contractTermLines" :key="i">{{ line }}</li>
      </ol>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:2mm;">
      <div style="text-align:center; width:45%;">
        <div style="border-top:1px solid #333; padding-top:6px; font-size:10pt; color:#555;">委託人簽名</div>
      </div>
      <div style="text-align:center; width:45%; position:relative;">
        <img :src="company.stamp" alt="公司章" style="width:130px; height:130px; object-fit:contain; display:block; margin:0 auto 4px;">
        <div style="border-top:1px solid #333; padding-top:6px; font-size:10pt; color:#555;">{{ company.name }}</div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { useQuotationStore, COMPANIES, WM_LOGOS } from '@/stores/quotation'

const store = useQuotationStore()
const quote = computed(() => store.quote)
const company = computed(() => COMPANIES[quote.value.company] || COMPANIES.naiship)
const wmLogo = computed(() => WM_LOGOS[quote.value.company] || company.value.logo)

// 對應舊版 calcTotals() 第 3331-3355 行的付款期數排列順序：
// 顯示順序是 p1,p2 / p3,p4 / p5,p6，但 p4 是「尾款」標籤、排在陣列最後算，
// 舊版用 pIds = ['in-p1','in-p2','in-p3','in-p5','in-p6','in-p4'] 這個特殊順序取值、
// labels = ['訂金','第二期款','第三期款','第四期款','第五期款','尾款'] 對應顯示，
// 這裡原封不動照搬這個容易搞混的映射關係。
const PAYMENT_ORDER = ['p1', 'p2', 'p3', 'p5', 'p6', 'p4']
const PAYMENT_LABELS = ['訂金', '第二期款', '第三期款', '第四期款', '第五期款', '尾款']

const paymentEntries = computed(() => {
    return PAYMENT_ORDER.map((key, i) => {
        const pct = quote.value[key] || 0
        const auto = pct > 0 ? Math.round(store.total * pct / 100) : 0
        const amtKey = key + 'amt'
        const amount = auto > 0 ? auto : (+quote.value[amtKey] || 0)
        return { label: PAYMENT_LABELS[i], pct, amount }
    })
})
const paymentRows = computed(() => [
    [paymentEntries.value[0], paymentEntries.value[1]],
    [paymentEntries.value[2], paymentEntries.value[3]],
    [paymentEntries.value[4], paymentEntries.value[5]],
])

const contractTermLines = computed(() =>
    (quote.value.contractTerms || '').split('\n').filter(l => l.trim())
)
</script>
<style scoped>
.page-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 62%;
  opacity: 0.10;
  filter: brightness(0);
  pointer-events: none;
  user-select: none;
  z-index: 0;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
@media print {
  .cost-col { display: none !important; }
  :global(body.print-with-cost) .cost-col { display: table-cell !important; }
  .cost-block { display: none !important; }
  :global(body.print-with-cost) .cost-block { display: flex !important; }
}
</style>
