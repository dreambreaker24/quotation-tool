import { getBusinessDays } from '@/utils/businessDays'

// 補休不足時把一段請假切成「前段補休、後段事假」。上班時段固定 09:00-12:00、13:00-18:00
// （跟 CalendarTab 的 calcHours 一樣扣午休），首日從 startTime 起算、末日算到 endTime，沒填就用整天。
// 回傳的兩段一律帶明確的起訖時間，讓之後編輯時用時間重算出來的時數跟存的時數一致。

const WORK_SEGMENTS = [[9 * 60, 12 * 60], [13 * 60, 18 * 60]]

function toMinutes(time) {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
}

function toTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function roundDownToHalfHour(hours) {
    return Math.floor(hours * 2) / 2
}

/**
 * @param {{date: string, endDate: string, startTime: string, endTime: string, compHours: number}} leave
 *   date/endDate 為 'YYYY-MM-DD'（endDate 空字串代表單日），compHours 為要用補休抵的時數
 * @returns {{comp: object, personal: object} | null} 兩段各為 { date, endDate, startTime, endTime }；
 *   compHours <= 0 或已經夠抵整段（不需要拆）時回傳 null
 */
export function splitLeaveRange({ date, endDate, startTime, endTime, compHours }) {
    const days = getBusinessDays(date, endDate)
    if (!days.length || compHours <= 0) return null
    const rangeStart = toMinutes(startTime || '09:00')
    const rangeEnd = toMinutes(endTime || '18:00')

    const pieces = []
    days.forEach((day, i) => {
        const dayStart = i === 0 ? rangeStart : WORK_SEGMENTS[0][0]
        const dayEnd = i === days.length - 1 ? rangeEnd : WORK_SEGMENTS[1][1]
        for (const [a, b] of WORK_SEGMENTS) {
            const from = Math.max(a, dayStart)
            const to = Math.min(b, dayEnd)
            if (to > from) pieces.push({ day, from, to })
        }
    })

    let remaining = Math.round(compHours * 60)
    const total = pieces.reduce((sum, p) => sum + p.to - p.from, 0)
    if (remaining >= total) return null

    let compEnd = null
    let personalStart = null
    for (let i = 0; i < pieces.length; i++) {
        const { day, from, to } = pieces[i]
        const length = to - from
        if (remaining < length) {
            compEnd = { day, minutes: from + remaining }
            personalStart = compEnd
            break
        }
        if (remaining === length) {
            compEnd = { day, minutes: to }
            personalStart = { day: pieces[i + 1].day, minutes: pieces[i + 1].from }
            break
        }
        remaining -= length
    }

    const firstDay = days[0]
    const lastDay = days[days.length - 1]
    return {
        comp: {
            date: firstDay,
            endDate: compEnd.day === firstDay ? '' : compEnd.day,
            startTime: toTime(rangeStart),
            endTime: toTime(compEnd.minutes),
        },
        personal: {
            date: personalStart.day,
            endDate: personalStart.day === lastDay ? '' : lastDay,
            startTime: toTime(personalStart.minutes),
            endTime: toTime(rangeEnd),
        },
    }
}
