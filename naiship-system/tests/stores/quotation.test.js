// naiship-system/tests/stores/quotation.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useQuotationStore } from '@/stores/quotation'

describe('quotation store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('預設空白狀態', () => {
    const store = useQuotationStore()
    expect(store.quote.company).toBe('naiship')
    expect(store.quote.categories).toEqual([])
  })

  it('loadQuote 可以載入完整報價資料', () => {
    const store = useQuotationStore()
    store.loadQuote({
      company: 'naiship', contractNo: 'TEST-0001', date: '2026-08-13',
      clientName: '測試客戶', categories: [
        { name: '拆除工程', unit: '式', qty: 1, note: '', subItems: [
          { desc: '隔間拆除', spec: '', qty: 1, unit: '式', price: 25000, cost: 15000 },
        ]},
      ],
    })
    expect(store.quote.contractNo).toBe('TEST-0001')
    expect(store.quote.categories.length).toBe(1)
    expect(store.quote.categories[0].subItems[0].price).toBe(25000)
  })

  it('getCatTotal 計算大項小計（單價×數量加總）', () => {
    const store = useQuotationStore()
    store.loadQuote({ categories: [
      { name: 'A', subItems: [
        { price: 1000, qty: 2, cost: 500 },
        { price: 500, qty: 3, cost: 200 },
      ]},
    ]})
    expect(store.getCatTotal(store.quote.categories[0])).toBe(1000*2 + 500*3)
  })

  it('getCatCost 計算大項成本小計', () => {
    const store = useQuotationStore()
    store.loadQuote({ categories: [
      { name: 'A', subItems: [
        { price: 1000, qty: 2, cost: 500 },
        { price: 500, qty: 3, cost: 200 },
      ]},
    ]})
    expect(store.getCatCost(store.quote.categories[0])).toBe(500*2 + 200*3)
  })

  it('subtotal / totalCost 是所有大項加總', () => {
    const store = useQuotationStore()
    store.loadQuote({ categories: [
      { name: 'A', subItems: [{ price: 1000, qty: 1, cost: 600 }] },
      { name: 'B', subItems: [{ price: 2000, qty: 1, cost: 1200 }] },
    ]})
    expect(store.subtotal).toBe(3000)
    expect(store.totalCost).toBe(1800)
  })

  it('mgmt/discount/tax/total 計算（含稅 5%、管理費、折扣）', () => {
    const store = useQuotationStore()
    store.loadQuote({
      categories: [{ name: 'A', subItems: [{ price: 100000, qty: 1, cost: 60000 }] }],
      mgmtPct: 6, discount: 5000, tax: true,
    })
    // subtotal=100000, mgmt=6000, discount=5000, base=101000, tax=round(101000*0.05)=5050, total=106050
    expect(store.subtotal).toBe(100000)
    expect(store.mgmtAmount).toBe(6000)
    expect(store.taxAmount).toBe(5050)
    expect(store.total).toBe(106050)
  })

  it('cnNum 把索引轉成中文數字', () => {
    const store = useQuotationStore()
    expect(store.cnNum(0)).toBe('壹')
    expect(store.cnNum(9)).toBe('拾')
    expect(store.cnNum(19)).toBe('貳拾')
    expect(store.cnNum(20)).toBe('21') // 超出 CN 陣列範圍時退回數字字串
  })
})
