import { computed } from 'vue'
import { useUsersStore } from '@/stores/users'

const FIXED_COLORS = {
    'IG': '#ec4899',
    'FB': '#3b82f6',
    '官網': '#22c55e',
    '朋友介紹': '#f97316',
    '其他': '#6b7280',
    'Instagram': '#ec4899',
    '展場': '#a855f7',
}

export function useClientSources() {
    const usersStore = useUsersStore()

    const employeeNames = computed(() => usersStore.users.map(u => u.name))

    const sourceOptions = computed(() => ['IG', 'FB', '官網'])

    // 員工姓名 → 朋友介紹，Instagram → IG，其餘保留
    function normalizeSource(src) {
        if (!src) return '其他'
        if (src === 'Instagram') return 'IG'
        if (employeeNames.value.includes(src)) return '朋友介紹'
        return src
    }

    function sourceColor(src) {
        return FIXED_COLORS[normalizeSource(src)] ?? '#6b7280'
    }

    return { sourceOptions, sourceColor, normalizeSource, employeeNames }
}
