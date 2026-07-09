// naiship-system/src/utils/memberColor.js
const MEMBER_COLORS = { '柏': '#c9a96e', '其宏': '#1f2937', '蚌': '#ef4444' }
const FALLBACK_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#14b8a6', '#f97316']

export function memberColor(name) {
    if (!name) return '#9ca3af'
    if (MEMBER_COLORS[name]) return MEMBER_COLORS[name]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}
