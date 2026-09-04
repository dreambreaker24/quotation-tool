import { describe, it, expect } from 'vitest'
import { calcVendorDueDate, vendorReminderPlan, VENDOR_CASH_THRESHOLD, VENDOR_MANUAL_FOLLOWUP_THRESHOLD } from '@/utils/paymentDueDate'

describe('calcVendorDueDate', () => {
    it('完工日 <= 15 號，算同月 15 號（範例：8 號完工）', () => {
        // 2026-08-15 是週六，往前提到週五 8/14
        expect(calcVendorDueDate('2026-08-08')).toBe('2026-08-14')
    })

    it('完工日 > 15 號，算同月月底（範例：17 號完工）', () => {
        // 2026-08-31 是週一，不用調整
        expect(calcVendorDueDate('2026-08-17')).toBe('2026-08-31')
    })

    it('完工日剛好 15 號，直接算當天（如果是平日）', () => {
        // 2026-09-15 是週二
        expect(calcVendorDueDate('2026-09-15')).toBe('2026-09-15')
    })

    it('目標日剛好是平日，不調整', () => {
        // 2026-09-15（週二）、2026-09-30（週三）
        expect(calcVendorDueDate('2026-09-08')).toBe('2026-09-15')
        expect(calcVendorDueDate('2026-09-20')).toBe('2026-09-30')
    })

    it('遇週休往前提到最近的平日', () => {
        // 8/15 是週六 → 往前到 8/14（週五）
        expect(calcVendorDueDate('2026-08-01')).toBe('2026-08-14')
    })

    it('連續遇到週休＋國定假日，要一路往前提到真正的平日', () => {
        // 2026-02-20 完工 → 目標 2/28（月底，週六）→ 2/27（週五，剛好是和平補假）→ 2/26（週四，平日）
        expect(calcVendorDueDate('2026-02-20')).toBe('2026-02-26')
    })
})

describe('vendorReminderPlan', () => {
    it('金額在 1 萬以下（含）：不建立提醒，直接付現', () => {
        expect(vendorReminderPlan(5000)).toEqual({ shouldRemind: false, needsManualFollowup: false })
        expect(vendorReminderPlan(VENDOR_CASH_THRESHOLD)).toEqual({ shouldRemind: false, needsManualFollowup: false })
    })

    it('金額超過 1 萬、在 10 萬以下（含）：建立提醒並標記手動提醒', () => {
        expect(vendorReminderPlan(VENDOR_CASH_THRESHOLD + 1)).toEqual({ shouldRemind: true, needsManualFollowup: true })
        expect(vendorReminderPlan(VENDOR_MANUAL_FOLLOWUP_THRESHOLD)).toEqual({ shouldRemind: true, needsManualFollowup: true })
    })

    it('金額超過 10 萬：建立提醒，不標記手動提醒', () => {
        expect(vendorReminderPlan(VENDOR_MANUAL_FOLLOWUP_THRESHOLD + 1)).toEqual({ shouldRemind: true, needsManualFollowup: false })
        expect(vendorReminderPlan(500000)).toEqual({ shouldRemind: true, needsManualFollowup: false })
    })
})
