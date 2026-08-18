<template>
  <!-- line-height:normal 是刻意加的：Tailwind preflight 把 html line-height 設成 1.5，
       會蓋過瀏覽器預設值滲進表格列高，跟獨立的 quotation-dev.html（沒有任何 CSS reset，
       用瀏覽器預設 normal）不一致，逐大項累加下來會造成明顯的排版偏移 -->
  <div id="a4-page-2" style="width:210mm; min-height:297mm; background:#fff; padding:0 14mm 14mm 14mm; box-shadow:0 2px 12px rgba(0,0,0,0.15); font-family:'Microsoft JhengHei','Noto Sans TC',sans-serif; font-size:10pt; color:#1a1a1a; position:relative; line-height:normal;">
    <img class="page-watermark" :src="wmLogo" alt="">

    <table id="detail-table" style="width:100%; border-collapse:collapse; table-layout:fixed;">
      <thead>
        <tr>
          <td style="padding:0;">
            <div id="prev2-header" style="display:flex; justify-content:space-between; align-items:center; background:#2C2C2C; border-bottom:3px solid #c9a96e; margin:0 -14mm 4mm -14mm; padding:0 14mm; height:22mm; overflow:hidden; print-color-adjust:exact; -webkit-print-color-adjust:exact;">
              <img :src="company.logo" :alt="company.name" :style="`height:${company.logo2Height};object-fit:contain;display:block;filter:drop-shadow(0 0 4px rgba(255,255,255,0.95)) drop-shadow(0 0 16px rgba(255,220,150,0.8)) drop-shadow(0 0 40px rgba(201,169,110,0.5));`">
              <table style="font-size:9pt; color:#fff; line-height:1.6; border-collapse:collapse;">
                <tr><td style="white-space:nowrap; padding-right:4px;">合約編號：</td><td>{{ quote.contractNo }}</td></tr>
                <tr><td style="white-space:nowrap; padding-right:4px;">報價日期：</td><td>{{ quote.date }}</td></tr>
                <tr><td style="white-space:nowrap; padding-right:4px;">版本：</td><td style="color:#555;">{{ quote.versionLabel }}</td></tr>
              </table>
            </div>
          </td>
        </tr>
      </thead>
      <tbody v-for="(cat, catIdx) in quote.categories" :key="catIdx" style="break-inside:avoid; page-break-inside:avoid;">
        <tr>
          <td style="padding:0; vertical-align:top;">
            <div style="margin-bottom:6mm; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden; box-shadow:0 1px 5px rgba(0,0,0,0.07);">
              <div style="background:#2C2C2C; color:#fff; padding:8px 16px; font-size:11.5pt; font-weight:900; margin-bottom:0; letter-spacing:0.5px;">
                {{ store.cnNum(catIdx) }}、{{ cat.name || '（未命名）' }}
              </div>
              <table style="width:100%; border-collapse:collapse; font-size:9pt; margin-bottom:0;">
                <thead>
                  <tr style="background:#444; color:#e0e0e0;">
                    <th style="padding:5px 6px; text-align:center; width:6%; white-space:nowrap;">項次</th>
                    <th style="padding:5px 6px; text-align:left; width:17%;">工程項目</th>
                    <th style="padding:5px 6px; text-align:left; width:25%;">設備／工法／材料／規格</th>
                    <th style="padding:5px 6px; text-align:right; width:6%;">數量</th>
                    <th style="padding:5px 6px; text-align:left; width:6%; white-space:nowrap;">單位</th>
                    <th style="padding:5px 6px; text-align:right; width:11%;">單價</th>
                    <th style="padding:5px 6px; text-align:right; width:13%;">複價</th>
                    <th class="cost-col" style="padding:5px 6px; text-align:right; width:9%; line-height:1.3;">成本<br>單價</th>
                    <th class="cost-col" style="padding:5px 6px; text-align:right; width:7%; line-height:1.3;">成本<br>複價</th>
                  </tr>
                </thead>
                <tbody v-if="cat.subItems && cat.subItems.length">
                  <tr v-for="(s, idx) in cat.subItems" :key="idx" data-test="sub-row"
                    :style="`background:${flagStyle(s.flag).bg || (idx % 2 === 0 ? '#fff' : '#f9f9f9')};${flagStyle(s.flag).border ? 'border-left:4px solid ' + flagStyle(s.flag).border + ';' : ''}`">
                    <!-- 拆除工程列顯示強制覆寫為 1/式/—/—，但成本欄與小計仍用真實數量計算——
                         對應舊版 quotation-dev.html 第 3268-3279 行的 DOM 覆寫邏輯，故意保留真實數量供內部成本追蹤，
                         不是 bug，不要「修正」成跟顯示欄位一致 -->
                    <template v-if="isDemolition(cat.name)">
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:center;">{{ idx + 1 }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb;">{{ s.desc || '—' }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; color:#555; white-space:pre-wrap;">{{ s.spec || '' }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right;">1</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:center;">式</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right;">—</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:bold;">—</td>
                      <td class="cost-col" style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right; color:#888;">{{ s.cost ? s.cost.toLocaleString() : '—' }}</td>
                      <td class="cost-col" style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right; color:#888;">{{ s.cost ? ((s.cost||0)*(s.qty||0)).toLocaleString() : '—' }}</td>
                    </template>
                    <template v-else>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:center;">{{ idx + 1 }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb;">{{ s.desc || '—' }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; color:#555; white-space:pre-wrap;">{{ s.spec || '' }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right;">{{ s.qty }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:center;">{{ s.unit }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right;">{{ (s.price||0).toLocaleString() }}</td>
                      <td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:bold;">{{ ((s.price||0)*(s.qty||0)).toLocaleString() }}</td>
                      <td class="cost-col" style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right; color:#888;">{{ s.cost ? (s.cost||0).toLocaleString() : '—' }}</td>
                      <td class="cost-col" style="padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:right; color:#888;">{{ s.cost ? ((s.cost||0)*(s.qty||0)).toLocaleString() : '—' }}</td>
                    </template>
                  </tr>
                </tbody>
                <tbody v-else>
                  <tr><td colspan="9" style="padding:6px; color:#aaa; text-align:center;">（尚無細項）</td></tr>
                </tbody>
                <tfoot>
                  <tr style="background:#fdf8ee; font-weight:bold; border-top:2px solid #c9a96e;">
                    <td colspan="6" style="padding:5px 6px; text-align:right; font-size:10pt; color:#2C2C2C; letter-spacing:1px;">小計</td>
                    <td style="padding:5px 6px; text-align:right; font-size:10pt; color:#2C2C2C; font-weight:bold;">{{ store.getCatTotal(cat).toLocaleString() }}</td>
                    <td class="cost-col" style="padding:5px 6px; text-align:right; font-size:10pt; color:#888;" colspan="2">{{ store.getCatCost(cat) > 0 ? store.getCatCost(cat).toLocaleString() : '—' }}</td>
                  </tr>
                </tfoot>
              </table>
              <div v-if="cat.note" style="background:#eff6ff;color:#1e40af;font-size:8.5pt;padding:6px 12px;border-left:3px solid #60a5fa;margin-top:0;white-space:pre-wrap;line-height:1.6;">{{ cat.note }}</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { useQuotationStore, COMPANIES, WM_LOGOS, FLAG_STYLES } from '@/stores/quotation'

const store = useQuotationStore()
const quote = computed(() => store.quote)
const company = computed(() => COMPANIES[quote.value.company] || COMPANIES.naiship)
const wmLogo = computed(() => WM_LOGOS[quote.value.company] || company.value.logo)

function isDemolition(name) {
    return !!(name && name.includes('拆除'))
}
function flagStyle(flag) {
    return FLAG_STYLES[flag || 0] || {}
}
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
