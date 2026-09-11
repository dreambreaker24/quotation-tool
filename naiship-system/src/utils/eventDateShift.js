// 行事曆事件「移動 / 複製」用的日期計算。所有日期都是 'YYYY-MM-DD' 字串，
// 用本地時間建構 Date（跟 businessDays.js 一致），避免 UTC 解析誤差。

function parseYMD(s) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
}

function fmtYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(s, n) {
    const d = parseYMD(s)
    d.setDate(d.getDate() + n)
    return fmtYMD(d)
}

function dayDiff(a, b) {
    return Math.round((parseYMD(b).getTime() - parseYMD(a).getTime()) / 86400000)
}

// 把 (原開始日, 原結束日) 平移到 targetDate，保持天數。
// origEndDate 空或不晚於 origDate → 視為單日，endDate 回 null。
export function shiftedRange(origDate, origEndDate, targetDate) {
    if (!origEndDate || origEndDate <= origDate) return { date: targetDate, endDate: null }
    return { date: targetDate, endDate: addDays(targetDate, dayDiff(origDate, origEndDate)) }
}

// 組「複製」用的 payload（日期還是字串，呼叫端負責轉 Firestore Timestamp）。
export function buildCopyDraft(event, origDate, origEndDate, targetDate, { region, uid }) {
    const { date, endDate } = shiftedRange(origDate, origEndDate, targetDate)
    const draft = {
        companyId: event.companyId ?? region ?? '',
        type: event.type,
        label: event.label ?? '',
        createdBy: uid ?? '',
        date,
    }
    if (endDate) draft.endDate = endDate
    const caseIds = Array.isArray(event.caseIds) ? event.caseIds : (event.caseId ? [event.caseId] : [])
    if (caseIds.length) draft.caseIds = [...caseIds]
    if (Array.isArray(event.caseNames) && event.caseNames.length) draft.caseNames = [...event.caseNames]
    const personNames = Array.isArray(event.personNames)
        ? event.personNames
        : (event.type === 'milestone' && event.personName ? [event.personName] : [])
    if (personNames.length) draft.personNames = [...personNames]
    if (event.startTime) {
        draft.startTime = event.startTime
        draft.endTime = event.endTime ?? ''
    }
    return draft
}
