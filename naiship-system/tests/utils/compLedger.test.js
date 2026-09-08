import { describe, it, expect } from 'vitest'
import {
    computeOvertimeValue, buildLedgerEntry, consumeFIFO, refundConsumption,
    valueForConsumption, sumRemainingHours, isExpired, expiredEntries,
} from '@/utils/compLedger'

describe('computeOvertimeValue', () => {
    it('平日加班：前2小時×4/3、超過×5/3', () => {
        // 底薪36000 → 時薪150；2h*150*4/3=400；1h*150*5/3=250；合計650
        expect(computeOvertimeValue(3, '平日', 36000)).toBe(650)
    })

    it('休息日加班：前2h×4/3、3-8h×5/3、超過8h×8/3', () => {
        // 底薪36000 → 時薪150；2h*150*4/3=400；6h*150*5/3=1500；1h*150*8/3=400；合計2300
        expect(computeOvertimeValue(9, '休息日', 36000)).toBe(2300)
    })

    it('時數或底薪為0時回傳0', () => {
        expect(computeOvertimeValue(0, '平日', 36000)).toBe(0)
        expect(computeOvertimeValue(3, '平日', 0)).toBe(0)
    })

    it('type非"平日"時按休息日費率計算（例如打錯字或未知值）', () => {
        // type 傳 '平日外' 會走 else 分支，使用休息日費率
        // 底薪36000 → 時薪150；2h*150*4/3=400
        expect(computeOvertimeValue(2, '平日外', 36000)).toBe(400)
        // 傳其他字串也是一樣走休息日路線
        expect(computeOvertimeValue(9, '國定假日', 36000)).toBe(2300)
    })
})

describe('buildLedgerEntry', () => {
    it('組出完整分錄，value用階梯公式算好、remainingHours等於hours', () => {
        const entry = buildLedgerEntry({
            type: '平日', hours: 2, baseSalary: 36000, expireDate: '2027-03-01',
            sourceLogId: 'log1', source: 'overtime',
        })
        expect(entry).toEqual({
            type: '平日', hours: 2, remainingHours: 2, value: 400,
            baseRateAtAccrual: 150, expireDate: '2027-03-01',
            sourceLogId: 'log1', source: 'overtime',
        })
    })

    it('sourceLogId/source有預設值', () => {
        const entry = buildLedgerEntry({ type: '休息日', hours: 1, baseSalary: 36000, expireDate: null })
        expect(entry.sourceLogId).toBeNull()
        expect(entry.source).toBe('overtime')
    })
})

describe('consumeFIFO', () => {
    function makeEntries() {
        return [
            { id: 'e1', type: '平日', hours: 3, remainingHours: 3, value: 600 },
            { id: 'e2', type: '平日', hours: 2, remainingHours: 2, value: 500 },
            { id: 'e3', type: '休息日', hours: 4, remainingHours: 4, value: 1000 },
        ]
    }

    it('單筆分錄足夠時只扣一筆', () => {
        const { consumptions, updatedEntries, shortfall } = consumeFIFO(makeEntries(), '平日', 2)
        expect(consumptions).toEqual([{ id: 'e1', hours: 2 }])
        expect(updatedEntries.find(e => e.id === 'e1').remainingHours).toBe(1)
        expect(updatedEntries.find(e => e.id === 'e2').remainingHours).toBe(2)
        expect(shortfall).toBe(0)
    })

    it('跨筆消耗依FIFO順序（陣列順序=舊到新）', () => {
        const { consumptions, updatedEntries } = consumeFIFO(makeEntries(), '平日', 4)
        expect(consumptions).toEqual([{ id: 'e1', hours: 3 }, { id: 'e2', hours: 1 }])
        expect(updatedEntries.find(e => e.id === 'e1').remainingHours).toBe(0)
        expect(updatedEntries.find(e => e.id === 'e2').remainingHours).toBe(1)
    })

    it('只挑指定type的分錄，不會誤扣別的type', () => {
        const { consumptions } = consumeFIFO(makeEntries(), '休息日', 2)
        expect(consumptions).toEqual([{ id: 'e3', hours: 2 }])
    })

    it('餘額不夠時回傳shortfall', () => {
        const { consumptions, shortfall } = consumeFIFO(makeEntries(), '平日', 10)
        expect(consumptions).toEqual([{ id: 'e1', hours: 3 }, { id: 'e2', hours: 2 }])
        expect(shortfall).toBe(5)
    })
})

describe('valueForConsumption', () => {
    it('依比例算出這次消耗對應的金額', () => {
        const entries = [{ id: 'e1', hours: 3, value: 600 }, { id: 'e2', hours: 2, value: 500 }]
        // e1消耗2/3 → 400；e2消耗1/2 → 250；合計650
        const total = valueForConsumption(entries, [{ id: 'e1', hours: 2 }, { id: 'e2', hours: 1 }])
        expect(total).toBe(650)
    })

    it('consumptions裡有找不到的id時靜默略過', () => {
        const entries = [{ id: 'e1', hours: 3, value: 600 }]
        // e2不存在，應該被略過，只計算e1的250
        const total = valueForConsumption(entries, [{ id: 'e1', hours: 1 }, { id: 'e2', hours: 2 }])
        expect(total).toBe(200)
    })
})

describe('refundConsumption', () => {
    it('把消耗紀錄加回對應分錄的remainingHours，上限是原始hours', () => {
        const entries = [{ id: 'e1', hours: 3, remainingHours: 0 }]
        const refunded = refundConsumption(entries, [{ id: 'e1', hours: 3 }])
        expect(refunded.find(e => e.id === 'e1').remainingHours).toBe(3)
    })

    it('歸還量加上原本剩餘不會超過原始hours上限', () => {
        const entries = [{ id: 'e1', hours: 3, remainingHours: 2 }]
        const refunded = refundConsumption(entries, [{ id: 'e1', hours: 5 }])
        expect(refunded.find(e => e.id === 'e1').remainingHours).toBe(3)
    })

    it('consumptions裡有找不到的id時靜默略過', () => {
        const entries = [{ id: 'e1', hours: 3, remainingHours: 1 }]
        // e2不存在，應該被略過，只歸還e1
        const refunded = refundConsumption(entries, [{ id: 'e1', hours: 1 }, { id: 'e2', hours: 1 }])
        expect(refunded.find(e => e.id === 'e1').remainingHours).toBe(2)
        expect(refunded.length).toBe(1)
    })
})

describe('sumRemainingHours', () => {
    it('只加總指定type的remainingHours', () => {
        const entries = [
            { type: '平日', remainingHours: 3 }, { type: '平日', remainingHours: 2 },
            { type: '休息日', remainingHours: 4 },
        ]
        expect(sumRemainingHours(entries, '平日')).toBe(5)
        expect(sumRemainingHours(entries, '休息日')).toBe(4)
    })
})

describe('isExpired / expiredEntries', () => {
    it('過期日早於今天且還有剩餘時數才算到期', () => {
        expect(isExpired({ expireDate: '2026-08-01', remainingHours: 2 }, '2026-09-08')).toBe(true)
        expect(isExpired({ expireDate: '2026-10-01', remainingHours: 2 }, '2026-09-08')).toBe(false)
        expect(isExpired({ expireDate: '2026-08-01', remainingHours: 0 }, '2026-09-08')).toBe(false)
        expect(isExpired({ expireDate: null, remainingHours: 2 }, '2026-09-08')).toBe(false)
    })

    it('expiredEntries篩出所有到期分錄', () => {
        const entries = [
            { id: 'e1', expireDate: '2026-08-01', remainingHours: 2 },
            { id: 'e2', expireDate: '2026-10-01', remainingHours: 2 },
        ]
        expect(expiredEntries(entries, '2026-09-08').map(e => e.id)).toEqual(['e1'])
    })
})

describe('浮點精度測試', () => {
    it('反覆 consume/refund 多次後 remainingHours 精確回到原始值', () => {
        // 建立初始分錄，type='平日'
        let entries = [{ id: 'e1', type: '平日', hours: 5.5, remainingHours: 5.5, value: 1000 }]

        // 第1次消耗2.3小時
        let { consumptions: c1, updatedEntries: u1 } = consumeFIFO(entries, '平日', 2.3)
        entries = u1
        expect(entries[0].remainingHours).toBe(3.2)

        // 第1次歸還
        entries = refundConsumption(entries, c1)
        expect(entries[0].remainingHours).toBe(5.5)

        // 第2次消耗1.7小時
        let { consumptions: c2, updatedEntries: u2 } = consumeFIFO(entries, '平日', 1.7)
        entries = u2
        expect(entries[0].remainingHours).toBe(3.8)

        // 第2次歸還
        entries = refundConsumption(entries, c2)
        expect(entries[0].remainingHours).toBe(5.5)

        // 第3次消耗0.8小時
        let { consumptions: c3, updatedEntries: u3 } = consumeFIFO(entries, '平日', 0.8)
        entries = u3
        expect(entries[0].remainingHours).toBe(4.7)

        // 第3次歸還
        entries = refundConsumption(entries, c3)
        expect(entries[0].remainingHours).toBe(5.5)

        // 第4次消耗1.2小時
        let { consumptions: c4, updatedEntries: u4 } = consumeFIFO(entries, '平日', 1.2)
        entries = u4
        expect(entries[0].remainingHours).toBe(4.3)

        // 第4次歸還
        entries = refundConsumption(entries, c4)
        expect(entries[0].remainingHours).toBe(5.5)

        // 最後驗證：完全消耗並歸還全部5.5小時
        let { consumptions: cAll, updatedEntries: uAll } = consumeFIFO(entries, '平日', 5.5)
        entries = uAll
        expect(entries[0].remainingHours).toBe(0)

        entries = refundConsumption(entries, cAll)
        expect(entries[0].remainingHours).toBe(5.5)
    })
})
