import { computed } from 'vue'
import { useUsersStore } from '@/stores/users'

const FIXED_COLORS = {
    'IG': '#ec4899',
    'FB': '#3b82f6',
    '官網': '#22c55e',
    '其他': '#6b7280',
    'Instagram': '#ec4899',
}
const EMPLOYEE_COLORS = ['#f97316', '#a855f7', '#14b8a6', '#ef4444', '#84cc16', '#0ea5e9']

export function useClientSources() {
    const usersStore = useUsersStore()

    const sourceOptions = computed(() => [
        'IG', 'FB', '官網',
        ...usersStore.users.map(u => u.name),
        '其他',
    ])

    function sourceColor(src) {
        if (FIXED_COLORS[src]) return FIXED_COLORS[src]
        const idx = usersStore.users.findIndex(u => u.name === src)
        return idx >= 0 ? EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length] : '#6b7280'
    }

    return { sourceOptions, sourceColor }
}
