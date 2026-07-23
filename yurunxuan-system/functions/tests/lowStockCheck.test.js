import { describe, it, expect } from 'vitest'
import { shouldSendLowStockPush } from '../lowStockCheck.js'

describe('shouldSendLowStockPush', () => {
    it('沒有設定門檻時不推播', () => {
        expect(shouldSendLowStockPush({
            totalRemainingQty: 5, threshold: null, lastPushAt: null, now: 1000
        })).toBe(false)
    })

    it('庫存等於門檻時不算低庫存', () => {
        expect(shouldSendLowStockPush({
            totalRemainingQty: 20, threshold: 20, lastPushAt: null, now: 1000
        })).toBe(false)
    })

    it('庫存高於門檻時不推播', () => {
        expect(shouldSendLowStockPush({
            totalRemainingQty: 25, threshold: 20, lastPushAt: null, now: 1000
        })).toBe(false)
    })

    it('庫存低於門檻且從未推播過時要推播', () => {
        expect(shouldSendLowStockPush({
            totalRemainingQty: 15, threshold: 20, lastPushAt: null, now: 1000
        })).toBe(true)
    })

    it('庫存低於門檻但 60 秒內已推播過時不重複推播', () => {
        const now = 100_000
        expect(shouldSendLowStockPush({
            totalRemainingQty: 15, threshold: 20, lastPushAt: now - 30_000, now
        })).toBe(false)
    })

    it('庫存低於門檻且距上次推播超過 60 秒時要再推播', () => {
        const now = 100_000
        expect(shouldSendLowStockPush({
            totalRemainingQty: 15, threshold: 20, lastPushAt: now - 90_000, now
        })).toBe(true)
    })

    it('距上次推播剛好 60 秒時視為已過冷卻，要再推播', () => {
        const now = 100_000
        expect(shouldSendLowStockPush({
            totalRemainingQty: 15, threshold: 20, lastPushAt: now - 60_000, now
        })).toBe(true)
    })
})
