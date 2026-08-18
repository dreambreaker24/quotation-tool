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

  it('大項名稱含「拆除」時，顯示欄位被覆寫成 1/式/—/—，但成本欄位仍用真實數量計算（不是顯示用的 1）', () => {
    const wrapper = mountWithQuote({
      categories: [{
        name: '隔間拆除工程', subItems: [
          { desc: '隔間拆除', spec: '含清運', qty: 3, unit: '坪', price: 800, cost: 400 },
        ],
      }],
    })
    const cells = wrapper.findAll('[data-test="sub-row"] td')
    // 欄位順序：項次,工程項目,規格,數量,單位,單價,複價,成本單價,成本複價
    const texts = cells.map(c => c.text())
    expect(texts[3]).toBe('1')       // 顯示數量被覆寫
    expect(texts[4]).toBe('式')       // 顯示單位被覆寫
    expect(texts[5]).toBe('—')       // 顯示單價被覆寫
    expect(texts[6]).toBe('—')       // 顯示複價被覆寫
    expect(texts[7]).toBe('400')     // 成本單價：真實值，沒被覆寫
    expect(texts[8]).toBe('1,200')   // 成本複價：400 * 真實數量 3（不是覆寫後的 1），=1200
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

  it('公司切換到 baiting 時，頁首 logo 使用柏延的 logo2Height（跟 naiship 不同，證明真的切換了公司設定）', () => {
    const wrapper = mountWithQuote({ company: 'baiting', contractNo: 'TEST-0005', categories: [] })
    const headerImg = wrapper.find('#prev2-header img')
    expect(headerImg.attributes('style')).toContain('60px') // baiting.logo2Height，跟 naiship 的 160px 不同
  })
})
