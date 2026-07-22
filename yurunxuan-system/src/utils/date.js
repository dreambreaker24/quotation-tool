export function todayInTaipei() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
}

export function currentMonthInTaipei() {
    return todayInTaipei().slice(0, 7)
}

export function calcExpiryDate(producedDate) {
    const [y, m, d] = producedDate.split('-').map(Number)
    const expiry = new Date(Date.UTC(y, m - 1, d + 7))
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(expiry)
}
