import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import QuotationPreviewPage1 from '@/components/quotation/QuotationPreviewPage1.vue'
import { useQuotationStore } from '@/stores/quotation'

describe('QuotationPreviewPage1', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function mountWithQuote(data) {
    const store = useQuotationStore()
    store.loadQuote(data)
    return mount(QuotationPreviewPage1)
  }

  it('顯示合約編號、客戶資訊、公司資訊', () => {
    const wrapper = mountWithQuote({
      contractNo: 'NS-2026-001', clientName: '黃千惠小姐', designer: '柏',
      project: '台南市東區住宅翻新工程', clientPhone: '0912-345-678',
      address: '台南市東區大同路二段123號', startDate: '2026-09-01', endDate: '2026-10-15',
      categories: [],
    })
    expect(wrapper.text()).toContain('NS-2026-001')
    expect(wrapper.text()).toContain('黃千惠小姐')
    expect(wrapper.text()).toContain('台南市東區住宅翻新工程')
    expect(wrapper.text()).toContain('2026-09-01')
  })

  it('工程項目表格依 categories 順序顯示中文數字項次、名稱、複價', () => {
    const wrapper = mountWithQuote({
      categories: [
        { name: '拆除工程', unit: '式', qty: 1, subItems: [{ price: 34600, qty: 1, cost: 19800 }] },
        { name: '水電工程', unit: '式', qty: 1, subItems: [{ price: 66000, qty: 1, cost: 40000 }] },
      ],
    })
    const rows = wrapper.findAll('[data-test="item-row"]')
    expect(rows.length).toBe(2)
    expect(rows[0].text()).toContain('壹')
    expect(rows[0].text()).toContain('拆除工程')
    expect(rows[0].text()).toContain('34,600')
    expect(rows[1].text()).toContain('貳')
    expect(rows[1].text()).toContain('水電工程')
  })

  it('管理費列只在 mgmtPct > 0 時顯示', () => {
    const shown = mountWithQuote({ categories: [{ name: 'A', subItems: [{ price: 1000, qty: 1 }] }], mgmtPct: 6 })
    expect(shown.find('[data-test="mgmt-row"]').exists()).toBe(true)
    const hidden = mountWithQuote({ categories: [{ name: 'A', subItems: [{ price: 1000, qty: 1 }] }], mgmtPct: 0 })
    expect(hidden.find('[data-test="mgmt-row"]').exists()).toBe(false)
  })

  it('折扣列只在 discount > 0 時顯示', () => {
    const shown = mountWithQuote({ categories: [], discount: 5000 })
    expect(shown.find('[data-test="discount-row"]').exists()).toBe(true)
    const hidden = mountWithQuote({ categories: [], discount: 0 })
    expect(hidden.find('[data-test="discount-row"]').exists()).toBe(false)
  })

  it('稅金列只在 tax=true 時顯示', () => {
    const shown = mountWithQuote({ categories: [], tax: true })
    expect(shown.find('[data-test="tax-row"]').exists()).toBe(true)
    const hidden = mountWithQuote({ categories: [], tax: false })
    expect(hidden.find('[data-test="tax-row"]').exists()).toBe(false)
  })

  it('付款條件表格依照舊版特殊順序（p1,p2,p3,p5,p6,p4）對應到訂金～尾款六個標籤與正確金額', () => {
    const wrapper = mountWithQuote({
      categories: [{ name: 'A', subItems: [{ price: 100000, qty: 1 }] }],
      p1: 10, p2: 20, p3: 30, p4: 5, p5: 15, p6: 20,
    })
    const rows = wrapper.findAll('table')
      .find(t => t.text().includes('訂金'))
      .findAll('tr')
    // row0: 訂金(p1=10%) / 第二期款(p2=20%)
    expect(rows[0].text()).toContain('訂金')
    expect(rows[0].text()).toContain('10%')
    expect(rows[0].text()).toContain('第二期款')
    expect(rows[0].text()).toContain('20%')
    // row1: 第三期款(p3=30%) / 第四期款(p5=15%，不是 p4！)
    expect(rows[1].text()).toContain('第三期款')
    expect(rows[1].text()).toContain('30%')
    expect(rows[1].text()).toContain('第四期款')
    expect(rows[1].text()).toContain('15%')
    // row2: 第五期款(p6=20%，不是 p5！) / 尾款(p4=5%，不是 p6！)
    expect(rows[2].text()).toContain('第五期款')
    expect(rows[2].text()).toContain('20%')
    expect(rows[2].text()).toContain('尾款')
    expect(rows[2].text()).toContain('5%')
  })

  it('公司切換到 baiting 時顯示柏延品牌資訊', () => {
    const wrapper = mountWithQuote({ company: 'baiting', categories: [] })
    expect(wrapper.text()).toContain('柏延')
  })
})
