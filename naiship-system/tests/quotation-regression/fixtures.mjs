// 報價系統 Vue 改寫前提②：新舊 PDF 逐項比對用的測試題庫。
// 每筆資料是餵給 quotation-dev.html 的 loadQuote() 用的完整物件，
// 涵蓋幾種容易讓 A4 排版跑掉的情境（單頁/多頁、含稅/未稅、長文字、不同公司品牌）。
// 之後 Vue 版本做出來後，同一批資料用相同流程餵給新版，兩邊截圖逐像素比對。

function subItem(desc, spec, qty, unit, price, cost) {
    return { desc, spec, qty, unit, price, cost: cost ?? 0, margin: 0, flag: 0 }
}

function category(name, note, subItems) {
    return { name, unit: '式', qty: 1, note: note ?? '', subItems }
}

export const fixtures = [
    {
        id: 'basic-single-page',
        label: '基本款：單頁、未稅、無折扣',
        data: {
            company: 'naiship',
            contractNo: 'TEST-0001',
            date: '2026-08-13',
            clientName: '測試客戶一',
            project: '台南市東區住宅翻新工程',
            clientPhone: '0912-345-678',
            address: '台南市東區大同路二段123號',
            designer: '柏',
            startDate: '2026-09-01',
            endDate: '2026-10-15',
            notes: '材料以實際採購為準，如有變更另行議定。',
            mgmtPct: 6,
            discount: '',
            tax: false,
            p1: 30, p2: 30, p3: 30, p4: 10, p5: 0, p6: 0,
            categories: [
                category('拆除工程', '', [
                    subItem('隔間拆除', '含清運', 1, '式', 25000, 15000),
                    subItem('地坪拆除', '', 12, '坪', 800, 400),
                ]),
                category('水電工程', '', [
                    subItem('配電迴路新增', '含材料', 6, '迴路', 3500, 2000),
                    subItem('給排水管路', '', 1, '式', 45000, 28000),
                ]),
            ],
        },
    },
    {
        id: 'with-tax-and-discount',
        label: '含稅 + 折扣',
        data: {
            company: 'naiship',
            contractNo: 'TEST-0002',
            date: '2026-08-13',
            clientName: '測試客戶二',
            project: '台南市北區店面裝修工程',
            clientPhone: '0922-111-222',
            address: '台南市北區海安路三段9號',
            designer: '柯其宏',
            startDate: '2026-09-15',
            endDate: '2026-11-01',
            notes: '本報價已含 5% 營業稅，折扣為業主續約優惠。',
            mgmtPct: 8,
            discount: 15000,
            tax: true,
            p1: 40, p2: 30, p3: 20, p4: 10, p5: 0, p6: 0,
            categories: [
                category('木作工程', '', [
                    subItem('系統櫃訂製', '含五金', 1, '式', 180000, 120000),
                    subItem('天花板封板', '矽酸鈣板', 40, '坪', 1200, 700),
                ]),
                category('油漆工程', '', [
                    subItem('全室批土上漆', '含底漆', 1, '式', 65000, 38000),
                ]),
            ],
        },
    },
    {
        id: 'multi-page-many-items',
        label: '多頁：大量品項強制跨頁',
        data: {
            company: 'naiship',
            contractNo: 'TEST-0003',
            date: '2026-08-13',
            clientName: '測試客戶三',
            project: '台南市中西區透天整棟翻新工程',
            clientPhone: '0933-444-555',
            address: '台南市中西區民權路一段88號',
            designer: '柏',
            startDate: '2026-09-01',
            endDate: '2027-01-31',
            notes: '整棟三層樓翻新，工期較長，分四期付款。',
            mgmtPct: 6,
            discount: '',
            tax: true,
            p1: 25, p2: 25, p3: 25, p4: 15, p5: 10, p6: 0,
            categories: [
                category('拆除工程', '', [
                    subItem('一樓隔間拆除', '含清運', 1, '式', 35000, 20000),
                    subItem('二樓隔間拆除', '含清運', 1, '式', 32000, 18000),
                    subItem('三樓隔間拆除', '含清運', 1, '式', 30000, 17000),
                    subItem('全棟地坪拆除', '', 48, '坪', 800, 400),
                ]),
                category('水電工程', '', [
                    subItem('全棟配電迴路', '含材料', 24, '迴路', 3500, 2000),
                    subItem('給排水管路重拉', '', 1, '式', 120000, 75000),
                    subItem('弱電網路配線', '', 1, '式', 45000, 25000),
                ]),
                category('泥作工程', '', [
                    subItem('浴室防水施作', '共3間', 3, '間', 18000, 10000),
                    subItem('磁磚鋪貼', '', 60, '坪', 2200, 1400),
                    subItem('隔間砌磚', '', 1, '式', 55000, 32000),
                ]),
                category('木作工程', '', [
                    subItem('全室系統櫃', '含五金', 1, '式', 380000, 250000),
                    subItem('天花板封板', '矽酸鈣板', 90, '坪', 1200, 700),
                    subItem('木地板鋪設', '', 35, '坪', 3200, 2000),
                ]),
                category('油漆工程', '', [
                    subItem('全棟批土上漆', '含底漆', 1, '式', 145000, 85000),
                ]),
                category('鋁窗工程', '', [
                    subItem('氣密窗更換', '共12樘', 12, '樘', 8500, 5500),
                ]),
                category('空調工程', '', [
                    subItem('分離式冷氣安裝', '共6台', 6, '台', 28000, 20000),
                    subItem('管線配置', '', 1, '式', 35000, 22000),
                ]),
            ],
        },
    },
    {
        id: 'long-text-notes-terms',
        label: '超長備註與合約條款文字',
        data: {
            company: 'naiship',
            contractNo: 'TEST-0004',
            date: '2026-08-13',
            clientName: '測試客戶四（極長姓名測試極長姓名測試極長姓名測試）',
            project: '台南市安平區商業空間規劃暨室內裝修統包工程含機電消防整合施作',
            clientPhone: '0955-666-777',
            address: '台南市安平區literature路一段 100 號之 1 3 樓（原址原為某公司辦公室現改為複合式商業空間）',
            designer: '蕭雅丰',
            startDate: '2026-09-01',
            endDate: '2026-12-31',
            notes: '本工程材料以現場實際勘查與甲方確認之品項為準，若因原物料市場價格波動、供應商缺貨、法規變更或不可抗力因素（如天災、疫情、政府政策調整）導致材料需變更或工期需延展，雙方應本誠信原則另行協議處理方式，乙方應於知悉相關情事後三個工作天內以書面（含電子郵件、LINE 等即時通訊軟體）通知甲方，甲方應於收到通知後五個工作天內回覆是否同意變更，逾期未回覆視為同意乙方提出之方案；如涉及追加減帳，應另行簽署補充協議書並經雙方用印確認後始生效力。',
            contractTerms: '一、本合約書一式二份，甲乙雙方各執一份為憑，自簽約日起生效。\n二、付款方式依本報價單所載付款期程辦理，甲方應依約定期程於乙方提出請款單後七個工作天內完成付款，逾期未付款達十五日者，乙方得暫停施工，因此所生之工期延誤由甲方負責。\n三、乙方應依約定工期完工，如非可歸責於乙方之事由導致工期延誤，得經雙方書面協議延展工期，不列入乙方遲延之計算。\n四、材料變更或追加減項目，須經雙方書面確認並簽署補充協議書後始生效力，未經雙方書面確認之口頭約定不具契約效力。\n五、保固期間自驗收完成日起算一年，保固範圍不含人為損壞、天災或非正常使用所致之損害。\n六、雙方如因本合約發生爭議，應先以協商方式解決，協商不成時，同意以台灣台南地方法院為第一審管轄法院。',
            mgmtPct: 6,
            discount: '',
            tax: true,
            p1: 30, p2: 30, p3: 30, p4: 10, p5: 0, p6: 0,
            categories: [
                category('拆除工程', '含極長備註測試極長備註測試極長備註測試極長備註測試看排版會不會撐開表格', [
                    subItem('隔間拆除暨清運（含分類回收與廢棄物合法清運處理費用一併估算在內）', '含清運與廢棄物申報', 1, '式', 45000, 28000),
                ]),
            ],
        },
    },
    {
        id: 'second-company-baiting',
        label: '第二品牌（柏延）',
        data: {
            company: 'baiting',
            contractNo: 'TEST-0005',
            date: '2026-08-13',
            clientName: '測試客戶五',
            project: '台南市永康區辦公室裝修工程',
            clientPhone: '0966-777-888',
            address: '台南市永康區中華路二段50號',
            designer: '柏',
            startDate: '2026-09-10',
            endDate: '2026-10-20',
            notes: '',
            mgmtPct: 6,
            discount: '',
            tax: false,
            p1: 50, p2: 50, p3: 0, p4: 0, p5: 0, p6: 0,
            categories: [
                category('輕隔間工程', '', [
                    subItem('輕鋼架隔間', '含矽酸鈣板雙面', 20, '坪', 2800, 1800),
                ]),
            ],
        },
    },
    {
        id: 'edge-zero-values',
        label: '邊界值：管理費 0%、無折扣、單一付款期',
        data: {
            company: 'naiship',
            contractNo: 'TEST-0006',
            date: '2026-08-13',
            clientName: '測試客戶六',
            project: '小型修繕工程',
            clientPhone: '0977-888-999',
            address: '台南市南區興國路20號',
            designer: '柏',
            startDate: '2026-09-05',
            endDate: '2026-09-10',
            notes: '',
            mgmtPct: 0,
            discount: 0,
            tax: false,
            p1: 100, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0,
            categories: [
                category('修繕工程', '', [
                    subItem('水龍頭更換', '', 2, '個', 1500, 800),
                ]),
            ],
        },
    },
]
