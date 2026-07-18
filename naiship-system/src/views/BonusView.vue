<template>
  <main class="flex-1 overflow-y-auto px-4 py-6 max-w-5xl mx-auto w-full">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-bold text-gray-800">季度獎金統計</h1>
      <select v-model="selectedQuarter" class="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
        <option v-for="q in quarterOptions" :key="q" :value="q">{{ q }}</option>
      </select>
    </div>

    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <h2 class="text-sm font-bold text-gray-700 mb-3">本季完工案件（業務／設計師／工務）</h2>
      <div v-if="eligibleCases.length === 0" class="text-sm text-gray-400 py-4 text-center">這一季沒有完工案件</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-400 text-xs border-b border-gray-100">
            <th class="py-2 font-medium">案件</th>
            <th class="font-medium">簽約金額</th>
            <th class="font-medium">資格</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in eligibleCases" :key="c.id" class="border-b border-gray-50">
            <td class="py-2">{{ c.name }}</td>
            <td>{{ (c.signedAmount || 0).toLocaleString() }}</td>
            <td>
              <span v-if="isEligibleByAmount(c.signedAmount)" class="text-green-600">符合</span>
              <span v-else class="text-gray-400">未達 50 萬</span>
            </td>
            <td class="text-right">
              <button @click="editingCaseId = c.id" class="text-xs text-blue-600 hover:underline">編輯獎金資料</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <CaseBonusForm v-if="editingCaseId" :case-id="editingCaseId"
      :case-info="eligibleCases.find(c => c.id === editingCaseId)"
      @close="closeCaseBonusForm" />

    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <h2 class="text-sm font-bold text-gray-700 mb-3">行政獎金</h2>
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">本季進件量</label>
          <input v-model.number="quarterForm.adminTarget.leadCount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">本季簽約量</label>
          <input v-model.number="quarterForm.adminTarget.signedCount" type="number" min="0" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
      </div>
      <div class="mb-3">
        <label class="text-xs text-gray-500 mb-1 block">進件量門檻（達標金額，可新增多級）</label>
        <div v-for="(t, i) in quarterForm.adminTarget.leadThresholds" :key="i" class="flex gap-2 mb-1">
          <input v-model.number="t.count" type="number" min="0" placeholder="件數" class="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1">
          <input v-model.number="t.amount" type="number" min="0" placeholder="金額" class="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1">
          <button @click="quarterForm.adminTarget.leadThresholds.splice(i, 1)" class="text-xs text-red-500">刪除</button>
        </div>
        <button @click="quarterForm.adminTarget.leadThresholds.push({ count: 0, amount: 0 })" class="text-xs text-blue-600">+ 新增門檻</button>
      </div>
      <div class="mb-3">
        <label class="text-xs text-gray-500 mb-1 block">每成交一件獎金</label>
        <input v-model.number="quarterForm.adminTarget.signedBonusPerCase" type="number" min="0" class="w-40 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>
      <div>
        <label class="text-xs text-gray-500 mb-1 block">發放對象</label>
        <select v-model="quarterForm.adminTarget.assignedToUid" @change="onAdminAssigneeChange" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
          <option value="">— 選擇 —</option>
          <option v-for="u in usersStore.users" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
      </div>
      <div class="text-xs text-gray-500 mt-2">行政建議獎金：{{ adminEntry ? adminEntry.suggestedAmount.toLocaleString() : 0 }} 元</div>
    </section>

    <section class="bg-white rounded-2xl shadow-md p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold text-gray-700">本季發放彙總</h2>
        <div class="flex gap-3">
          <button @click="recalculate" class="text-xs text-blue-600 hover:underline">重新試算</button>
          <button @click="saveQuarterData" :disabled="savingQuarter" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">
            {{ savingQuarter ? '儲存中…' : '儲存本季資料' }}
          </button>
        </div>
      </div>
      <div v-if="allEntries.length === 0" class="text-sm text-gray-400 py-4 text-center">目前沒有可發放的項目</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-400 text-xs border-b border-gray-100">
            <th class="py-2 font-medium">角色</th>
            <th class="font-medium">對象</th>
            <th class="font-medium">案件</th>
            <th class="font-medium">建議金額</th>
            <th class="font-medium">實發金額</th>
            <th class="font-medium">已發放</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in allEntries" :key="i" class="border-b border-gray-50">
            <td class="py-2">{{ roleLabel(e.role) }}</td>
            <td>{{ e.personName }}</td>
            <td>{{ e.caseName || '—' }}</td>
            <td>{{ e.suggestedAmount.toLocaleString() }}</td>
            <td>
              <input v-model.number="e.finalAmount" :disabled="e.paid" type="number" min="0" class="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 disabled:bg-gray-50 disabled:text-gray-400">
            </td>
            <td>
              <input type="checkbox" :checked="e.paid" @change="togglePaid(i, $event.target.checked)" class="rounded">
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>
<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { useUsersStore } from '@/stores/users'
import { useCaseBonusDataStore } from '@/stores/caseBonusData'
import { useBonusQuartersStore, defaultQuarterData } from '@/stores/bonusQuarters'
import { useToast } from '@/composables/useToast'
import {
    isEligibleByAmount, dateToQuarterKey, isCompletedInQuarter,
    buildCaseBonusEntries, buildAdminEntry,
} from '@/utils/bonusCalc'
import CaseBonusForm from '@/components/bonus/CaseBonusForm.vue'

const casesStore = useCasesStore()
const usersStore = useUsersStore()
const caseBonusDataStore = useCaseBonusDataStore()
const bonusQuartersStore = useBonusQuartersStore()
const { toast } = useToast()

onMounted(() => {
    casesStore.subscribe(['north', 'central', 'south'])
})

const quarterOptions = computed(() => {
    const current = dateToQuarterKey(new Date())
    const [y, qStr] = current.split('-Q')
    const year = Number(y)
    const q = Number(qStr)
    const options = []
    for (let i = 0; i < 8; i++) {
        const totalQ = year * 4 + (q - 1) - i
        const oy = Math.floor(totalQ / 4)
        const oq = (totalQ % 4) + 1
        options.push(`${oy}-Q${oq}`)
    }
    return options
})

const selectedQuarter = ref(dateToQuarterKey(new Date()))

const eligibleCases = computed(() =>
    casesStore.cases.filter(c => isCompletedInQuarter(c.completedAt, selectedQuarter.value))
)

const editingCaseId = ref(null)

const quarterForm = reactive(defaultQuarterData())
const caseEntries = ref([])
const savingQuarter = ref(false)

// 切季度：先把 Firestore 存的資料（含之前已標記的發放狀態）原樣載入 caseEntries，
// 再用 recalculate() 重新試算「未發放」的項目金額。分兩步是刻意的——
// 不能直接把 recalculate() 的結果當初始值，否則案件的 caseBonusData 還沒
// fetch 完成前 caseEntries 會暫時是空陣列，如果這時候使用者手滑點了旁邊
// 其他欄位觸發存檔，會把 Firestore 裡本來有的已發放紀錄整批洗掉。
async function loadQuarter(q) {
    const data = await bonusQuartersStore.fetchQuarter(q)
    quarterForm.adminTarget = data.adminTarget
    caseEntries.value = data.entries || []
    await recalculate()
}

watch(selectedQuarter, loadQuarter, { immediate: true })

function onAdminAssigneeChange() {
    const u = usersStore.users.find(u => u.id === quarterForm.adminTarget.assignedToUid)
    quarterForm.adminTarget.assignedToName = u?.name ?? ''
}

const adminEntry = computed(() => buildAdminEntry(quarterForm.adminTarget))

function roleLabel(role) {
    return { sales: '業務', designer: '設計師', siteManager: '工務', admin: '行政', team: '團隊' }[role]
}

// 只更新記憶體內的 caseEntries，不寫 Firestore——存檔動作完全交給
// 「儲存本季資料」按鈕（saveQuarterData），避免自動存檔在資料還沒載入
// 完成的空檔覆蓋掉已經存在雲端的資料。
async function recalculate() {
    const usersById = Object.fromEntries(usersStore.users.map(u => [u.id, u]))
    const results = []
    for (const c of eligibleCases.value) {
        const bonusData = await caseBonusDataStore.fetchData(c.id)
        results.push(...buildCaseBonusEntries(c, bonusData, usersById))
    }
    const admin = buildAdminEntry(quarterForm.adminTarget)
    if (admin) results.push(admin)
    // 已發放的項目維持鎖定金額，不被新試算覆蓋
    const existingPaid = caseEntries.value.filter(e => e.paid)
    caseEntries.value = [
        ...existingPaid,
        ...results.filter(r => !existingPaid.some(p => p.role === r.role && p.personId === r.personId && p.caseId === r.caseId)),
    ]
}

// 關掉「編輯獎金資料」Modal 時順手重新試算一次——這是使用者剛剛編輯完
// 那一筆案件的明確動作觸發，不是自動監看任何案件變動，所以不會重蹈先前
// 那個「其他人改別的案件也會觸發重算、洗掉手動調整的實發金額」的問題，
// 只是省掉「編輯完還要記得手動點重新試算」這一步。
async function closeCaseBonusForm() {
    editingCaseId.value = null
    await recalculate()
}

const allEntries = computed(() => caseEntries.value)

// markEntryPaid 的簽章是 (quarterKey, clientEntries, targetEntry, paid) ——用身分鍵
// （role+personId+caseId）比對，不是用陣列索引，因為前端試算出來的陣列順序不保證
// 跟 Firestore 實際存的順序一致，索引式比對曾經在 code review 時被抓到會標記錯筆。
// 這裡一定要把 caseEntries.value（目前畫面上的完整陣列）當 clientEntries 傳進去，
// 讓文件還沒建立過（第一次點「已發放」、還沒按過「儲存本季資料」）時也能成功寫入。
async function togglePaid(index, paid) {
    const targetEntry = caseEntries.value[index]
    try {
        await bonusQuartersStore.markEntryPaid(selectedQuarter.value, caseEntries.value, targetEntry, paid)
        caseEntries.value[index] = { ...caseEntries.value[index], paid }
        toast(paid ? '已標記發放' : '已取消發放標記')
    } catch {
        toast('標記發放狀態失敗，請重試', 'error')
    }
}

async function saveQuarterData() {
    savingQuarter.value = true
    try {
        await bonusQuartersStore.saveQuarter(selectedQuarter.value, {
            adminTarget: quarterForm.adminTarget,
            entries: caseEntries.value,
        })
        toast('已儲存本季資料')
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        savingQuarter.value = false
    }
}
</script>
