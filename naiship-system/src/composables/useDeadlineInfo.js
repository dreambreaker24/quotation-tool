export function deadlineInfo(c) {
    if (!c.deadline) return null
    const d = c.deadline.toDate?.() ?? new Date(c.deadline)
    const days = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
    if (days < 0) return { label: `逾期 ${Math.abs(days)} 天`, color: '#ef4444', bg: 'rgba(239,68,68,0.2)' }
    if (days <= 14) return { label: `剩 ${days} 天`, color: '#f97316', bg: 'rgba(249,115,22,0.2)' }
    if (days <= 30) return { label: `剩 ${days} 天`, color: '#f59e0b', bg: 'rgba(245,158,11,0.2)' }
    return { label: `剩 ${days} 天`, color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' }
}
