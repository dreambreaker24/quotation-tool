<!-- src/components/bonus/BonusManager.vue -->
<template>
    <div class="flex flex-col gap-4">
        <div class="bg-white rounded-2xl shadow-md p-5">
            <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                    <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">季度獎金試算</h2>
                    <select v-model="quarterKey" class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1">
                        <option v-for="q in recentQuarters" :key="q" :value="q">{{ q }}</option>
                    </select>
                </div>
                <button @click="recalculate" :disabled="calculating" class="text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-60" style="background:#4a3535">
                    {{ calculating ? '試算中…' : '重新試算' }}
                </button>
            </div>

            <div v-if="!store.currentQuarter" class="text-sm text-gray-400 text-center py-8">本季尚未試算，點擊右上「重新試算」開始</div>
            <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                <div><div class="text-gray-400">季營收</div><div class="font-medium text-gray-800">{{ team.revenue?.toLocaleString() }}</div></div>
                <div><div class="text-gray-400">季 COGS</div><div class="font-medium text-gray-800">{{ team.cogs?.toLocaleString() }}</div></div>
                <div><div class="text-gray-400">季支出</div><div class="font-medium text-gray-800">{{ team.expense?.toLocaleString() }}</div></div>
                <div><div class="text-gray-400">季毛利</div>
                    <div class="font-medium" :class="team.profit >= 0 ? 'text-gray-800' : 'text-red-500'">{{ team.profit?.toLocaleString() }}</div>
                </div>
                <div><div class="text-gray-400">門檻</div><div class="font-medium text-gray-800">{{ team.threshold?.toLocaleString() }}</div></div>
                <div><div class="text-gray-400">獎金池百分比</div><div class="font-medium text-gray-800">{{ team.percent }}%</div></div>
                <div class="col-span-2"><div class="text-gray-400">團隊獎金池</div><div class="font-bold" style="color:#d98fa0">{{ team.poolAmount?.toLocaleString() }}</div></div>
            </div>
            <div v-if="store.unknownDrinkNames.length" class="text-xs text-orange-500 mt-2">
                ⚠ {{ store.unknownDrinkNames.join('、') }} 尚無進貨資料，成本未知，COGS 可能低估
            </div>
        </div>

        <div v-if="store.currentQuarter" class="bg-white rounded-2xl shadow-md p-5">
            <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-3" style="border-left-color:#d98fa0">團隊獎金（全員均分）</h2>
            <div v-if="team.participants?.length === 0" class="text-sm text-gray-400 text-center py-4">目前沒有非負責人帳號</div>
            <div v-else class="flex flex-col gap-1">
                <div v-for="p in team.participants" :key="p.uid" class="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
                    <span class="flex-1 font-medium text-gray-800">{{ p.name }}</span>
                    <span class="text-gray-600">{{ p.amount?.toLocaleString() }} 元</span>
                    <button @click="store.setTeamPaid(quarterKey, p.uid, !p.paid)"
                        class="px-2 py-1 rounded-full text-[10px]"
                        :class="p.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                        {{ p.paid ? '已發放' : '標記已發放' }}
                    </button>
                </div>
            </div>
        </div>

        <div v-if="store.currentQuarter" class="bg-white rounded-2xl shadow-md p-5">
            <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-3" style="border-left-color:#d98fa0">個人銷售抽成</h2>
            <div v-if="store.currentQuarter.individual?.length === 0" class="text-sm text-gray-400 text-center py-4">目前沒有非負責人帳號</div>
            <div v-else class="flex flex-col gap-1">
                <div v-for="i in store.currentQuarter.individual" :key="i.uid" class="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
                    <span class="flex-1 font-medium text-gray-800">{{ i.name }}</span>
                    <span class="text-gray-400">銷售額 {{ i.personalRevenue?.toLocaleString() }}</span>
                    <span class="text-gray-400">建議 {{ i.suggestedAmount?.toLocaleString() }}</span>
                    <input type="number" :value="i.finalAmount" :disabled="i.paid"
                        @change="e => store.updateIndividualFinalAmount(quarterKey, i.uid, Number(e.target.value))"
                        class="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 disabled:bg-gray-100">
                    <button @click="store.setIndividualPaid(quarterKey, i.uid, !i.paid)"
                        class="px-2 py-1 rounded-full text-[10px]"
                        :class="i.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                        {{ i.paid ? '已發放' : '標記已發放' }}
                    </button>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-md p-5">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">獎金設定</h2>
                <button @click="doExport" :disabled="!store.currentQuarter" class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400 disabled:opacity-40">匯出 Excel</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                    <label class="text-gray-500 mb-1 block">季毛利門檻</label>
                    <input v-model.number="settingsDraft.teamProfitThreshold" type="number" class="w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-gray-500 mb-1 block">超過門檻的獎金百分比</label>
                    <input v-model.number="settingsDraft.teamBonusPercent" type="number" class="w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1">
                </div>
                <div>
                    <label class="text-gray-500 mb-1 block">個人銷售抽成百分比</label>
                    <input v-model.number="settingsDraft.individualCommissionRate" type="number" class="w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1">
                </div>
            </div>
            <button @click="saveSettings" class="text-xs text-white px-3 py-1.5 rounded-lg mt-3" style="background:#4a3535">儲存設定</button>
        </div>
    </div>
</template>
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useBonusStore } from '@/stores/bonus'
import { useExport } from '@/composables/useExport'
import { useToast } from '@/composables/useToast'
import { getCurrentQuarterKey, listRecentQuarterKeys } from '@/utils/quarter'

const store = useBonusStore()
const { exportBonus } = useExport()
const { toast } = useToast()

const quarterKey = ref(getCurrentQuarterKey())
const recentQuarters = listRecentQuarterKeys(8, getCurrentQuarterKey())
const calculating = ref(false)
const settingsDraft = ref({ teamProfitThreshold: null, teamBonusPercent: null, individualCommissionRate: null })

const team = computed(() => store.currentQuarter?.team || {})

watch(() => store.settings, (v) => { settingsDraft.value = { ...v } }, { immediate: true, deep: true })

async function loadForQuarter() {
    await store.loadQuarter(quarterKey.value)
}
watch(quarterKey, loadForQuarter)

onMounted(async () => {
    await store.loadSettings()
    await loadForQuarter()
})

async function recalculate() {
    if (store.currentQuarter && !confirm('重新試算將覆蓋已手動調整、尚未標記已發放的實發金額，確定嗎？')) return
    calculating.value = true
    try {
        await store.calculateQuarter(quarterKey.value)
        toast('試算完成')
    } catch (e) {
        console.warn('季度獎金試算失敗:', e)
        toast('試算失敗，請重試', 'error')
    } finally {
        calculating.value = false
    }
}

async function saveSettings() {
    try {
        await store.updateSettings(settingsDraft.value)
        toast('設定已更新')
    } catch (e) {
        console.warn('更新獎金設定失敗:', e)
        toast('更新失敗，請重試', 'error')
    }
}

function doExport() {
    exportBonus(store.currentQuarter, quarterKey.value)
}
</script>
