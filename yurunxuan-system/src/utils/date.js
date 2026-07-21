export function todayInTaipei() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
}

export function currentMonthInTaipei() {
    return todayInTaipei().slice(0, 7)
}
