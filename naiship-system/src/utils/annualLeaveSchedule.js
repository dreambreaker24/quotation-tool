// 勞基法第38條年資對照表：years 是「滿幾個完整年」（6個月週期用0.5表示）
function daysForCompletedYears(years) {
    if (years < 0.5) return 0
    if (years < 1) return 3
    if (years < 2) return 7
    if (years < 3) return 10
    if (years < 5) return 14
    if (years < 10) return 15
    return Math.min(30, 15 + Math.floor(years - 9))
}

// 用 y/m/d 數字建構 Date（而不是直接 new Date('YYYY-MM-DD') 字串解析），
// 避免 ISO 日期字串被當成 UTC 午夜解析、跟本地時區的 getFullYear/getMonth/getDate 對不齊而位移一天
// 重要：對於月底日期（29/30/31），加月份時若目標月份較短會溢出到隔月，需要 clamp 到目標月的最後一天
function addMonths(dateStr, months) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const targetMonthIndex = m - 1 + months
    const daysInTargetMonth = new Date(y, targetMonthIndex + 1, 0).getDate()
    const clampedDay = Math.min(d, daysInTargetMonth)
    const date = new Date(y, targetMonthIndex, clampedDay)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 週期起算日的月份門檻：到職日當天（0個月，0天）、滿6個月、之後每滿1年一個新週期
// （即使天數在某個區間內不變，例如3~4年都是14天，每年到職週年日依然各自是獨立一個週期）
function cycleMonthMarks(maxYears = 60) {
    const marks = [0, 6]
    for (let y = 1; y <= maxYears; y++) marks.push(y * 12)
    return marks
}

export function getAnnualLeaveCycleInfo(hireDate, today = new Date()) {
    if (!hireDate) return null
    const todayStr = toDateStr(today)

    const cycles = cycleMonthMarks().map(months => ({
        start: addMonths(hireDate, months),
        days: daysForCompletedYears(months / 12),
    }))

    let currentIndex = 0
    for (let i = 0; i < cycles.length; i++) {
        if (cycles[i].start <= todayStr) currentIndex = i
        else break
    }

    return {
        currentCycleStart: cycles[currentIndex].start,
        currentCycleDays: cycles[currentIndex].days,
        nextCycleStart: cycles[currentIndex + 1].start,
        nextCycleDays: cycles[currentIndex + 1].days,
    }
}
