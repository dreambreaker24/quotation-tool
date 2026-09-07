// 廠商付款方式：總額 ≤1萬現金付清、1萬~10萬完工全款、>10萬訂金分期。
// 這裡只算「預設建議」，使用者存檔前可以自由新增/刪除/改比例，不是強制格式。
export const VENDOR_CASH_THRESHOLD = 10000
export const VENDOR_STAGED_PLAN_THRESHOLD = 100000

// 同一毫秒內產生多個階段 id 時，用計數器確保各階段 id 唯一
let stageIdCounter = 0
function nextStageId() {
    stageIdCounter += 1
    return `stage_${Date.now()}_${stageIdCounter}`
}

export function makeStage(name, pct) {
    return { id: nextStageId(), name, pct, dueDate: '', status: 'pending' }
}

export function suggestPaymentPlan(total) {
    if (total <= VENDOR_CASH_THRESHOLD) {
        return { mode: 'cash', cashDate: '', autoSuggested: true, stages: [] }
    }
    if (total <= VENDOR_STAGED_PLAN_THRESHOLD) {
        return { mode: 'plan', cashDate: '', autoSuggested: true, stages: [makeStage('完工全款', 100)] }
    }
    return {
        mode: 'plan',
        cashDate: '',
        autoSuggested: true,
        stages: [
            makeStage('訂金', 30),
            makeStage('中間', 30),
            makeStage('驗收', 30),
            makeStage('完工', 10),
        ],
    }
}
