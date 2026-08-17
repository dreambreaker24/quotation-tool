import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import QuotationPreviewPage2 from '@/components/quotation/QuotationPreviewPage2.vue'
import { useQuotationStore } from '@/stores/quotation'

describe('QuotationPreviewPage2', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function mountWithQuote(data) {
    const store = useQuotationStore()
    store.loadQuote(data)
    return mount(QuotationPreviewPage2)
  }

  it('每個大項顯示中文數字＋名稱＋細項表格＋小計', () => {
    const wrapper = mountWithQuote({
      categories: [{
        name: '水電工程', subItems: [
          { desc: '配電迴路新增', spec: '含材料', qty: 6, unit: '迴路', price: 3500, cost: 2000 },
        ],
      }],
    })
    expect(wrapper.text()).toContain('壹、水電工程')
    expect(wrapper.text()).toContain('配電迴路新增')
    expect(wrapper.text()).toContain('含材料')
    expect(wrapper.text()).toContain('21,000') // 3500*6
  })

  it('大項名稱含「拆除」時，每列數量/單位/單價/複價被覆寫成 1/式/—/—', () => {
    const wrapper = mountWithQuote({
      categories: [{
        name: '隔間拆除工程', subItems: [
          { desc: '隔間拆除', spec: '含清運', qty: 1, unit: '式', price: 25000, cost: 15000 },
        ],
      }],
    })
    const cells = wrapper.findAll('[data-test="sub-row"] td')
    // 欄位順序：項次,工程項目,規格,數量,單位,單價,複價,成本單價,成本複價
    const texts = cells.map(c => c.text())
    expect(texts[3]).toBe('1')
    expect(texts[4]).toBe('式')
    expect(texts[5]).toBe('—')
    expect(texts[6]).toBe('—')
  })

  it('沒有細項時顯示「（尚無細項）」', () => {
    const wrapper = mountWithQuote({ categories: [{ name: '空大項', subItems: [] }] })
    expect(wrapper.text()).toContain('（尚無細項）')
  })

  it('大項有備註時顯示在區塊底部', () => {
    const wrapper = mountWithQuote({
      categories: [{ name: '拆除工程', note: '現場欲保留物品敬請業主淨空', subItems: [] }],
    })
    expect(wrapper.text()).toContain('現場欲保留物品敬請業主淨空')
  })

  it('公司切換到 baiting 時頁首顯示柏延合約編號區塊', () => {
    const wrapper = mountWithQuote({ company: 'baiting', contractNo: 'TEST-0005', categories: [] })
    expect(wrapper.text()).toContain('TEST-0005')
  })
})
