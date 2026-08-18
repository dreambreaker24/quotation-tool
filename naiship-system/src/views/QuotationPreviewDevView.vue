<!-- naiship-system/src/views/QuotationPreviewDevView.vue -->
<!-- 開發用測試頁：不放進導覽列，只能直接打網址進來。用來手動驗證 Vue 版報價預覽 + PDF 匯出。 -->
<template>
  <div style="padding:20px; background:#f0f0f0; min-height:100vh;">
    <div style="max-width:900px; margin:0 auto 20px; background:#fff; border-radius:8px; padding:16px; display:flex; align-items:center; gap:12px;">
      <label style="font-size:14px; font-weight:600;">測試題庫：</label>
      <select v-model="selectedId" style="padding:6px 12px; border:1px solid #ddd; border-radius:6px;">
        <option v-for="f in fixtures" :key="f.id" :value="f.id">{{ f.label }}</option>
      </select>
      <button @click="exportPdf" :disabled="exporting" style="padding:6px 16px; background:#1e2533; color:#fff; border:none; border-radius:6px; cursor:pointer;">
        {{ exporting ? '匯出中…' : '匯出 PDF' }}
      </button>
      <span v-if="exportMsg" style="font-size:13px; color:#555;">{{ exportMsg }}</span>
    </div>

    <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
      <QuotationPreviewPage1 ref="page1Ref" />
      <QuotationPreviewPage2 ref="page2Ref" />
    </div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'
import { useQuotationStore } from '@/stores/quotation'
import QuotationPreviewPage1 from '@/components/quotation/QuotationPreviewPage1.vue'
import QuotationPreviewPage2 from '@/components/quotation/QuotationPreviewPage2.vue'
import { exportQuotationPdf, computePrintZoom } from '@/composables/useQuotationExport'
import { fixtures } from '@/dev-fixtures/quotationFixtures'

const store = useQuotationStore()
const selectedId = ref(fixtures[0].id)
const page1Ref = ref(null)
const page2Ref = ref(null)
const exporting = ref(false)
const exportMsg = ref('')

function loadSelected() {
    const fixture = fixtures.find(f => f.id === selectedId.value)
    if (fixture) store.loadQuote(fixture.data)
}

watch(selectedId, loadSelected)
onMounted(loadSelected)

async function exportPdf() {
    exporting.value = true
    exportMsg.value = ''
    try {
        const page1El = page1Ref.value.$el
        const page2El = page2Ref.value.$el
        const zoom = computePrintZoom(page1El)
        const blob = await exportQuotationPdf({
            page1El, page2El,
            // page1 的第一個 <img> 是浮水印（class="page-watermark"），logo 是第二個，
            // 要排除浮水印才會抓到帶 filter:drop-shadow 的頁首 logo
            logo1El: page1El.querySelector('img:not(.page-watermark)'),
            logo2El: page2El.querySelector('#prev2-header img'),
            wmPage2El: page2El.querySelector('.page-watermark'),
        }, zoom)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${selectedId.value}.pdf`; a.click()
        URL.revokeObjectURL(url)
        exportMsg.value = '匯出完成'
    } catch (e) {
        exportMsg.value = '匯出失敗：' + e.message
        console.error(e)
    } finally {
        exporting.value = false
    }
}
</script>
