export function hoursToDays(hours) {
    const full = Math.floor(Math.abs(hours) / 8)
    const rem = Math.abs(hours) % 8
    const days = full + (rem === 0 ? 0 : rem <= 4 ? 0.5 : 1)
    return hours >= 0 ? days : -days
}
