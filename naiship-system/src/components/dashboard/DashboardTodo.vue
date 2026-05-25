<template>
  <div class="bg-white rounded-2xl shadow-sm p-4">
    <div class="flex items-center gap-2 mb-3">
      <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">待處理事項</h2>
      <span v-if="totalCount > 0"
        class="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
        style="background:#c9a96e">{{ totalCount }}</span>
    </div>

    <!-- 自訂待辦 -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">自訂待辦</span>
        <button @click="showAddForm = !showAddForm" class="text-[10px] hover:underline" style="color:#c9a96e">+ 新增</button>
      </div>
      <div v-if="showAddForm" class="flex gap-2 mb-2">
        <input v-model="newTodoText" type="text" placeholder="輸入待辦事項…"
          class="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1"
          @keyup.enter="addTodo" @keyup.escape="showAddForm = false; newTodoText = ''" autofocus>
        <button @click="addTodo" class="text-xs text-white px-3 py-1 rounded-lg flex-shrink-0" style="background:#1e2533">新增</button>
        <button @click="showAddForm = false; newTodoText = ''" class="text-xs text-gray-400 px-1.5">✕</button>
      </div>
      <div v-if="todosStore.todos.length === 0 && !showAddForm" class="text-xs text-gray-400 py-1">尚無自訂待辦</div>
      <div v-for="todo in todosStore.todos" :key="todo.id"
        class="group flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 mb-1.5 last:mb-0">
        <input type="checkbox" :checked="todo.done"
          @change="todosStore.updateTodo(todo.id, { done: !todo.done })"
          class="flex-shrink-0 cursor-pointer accent-amber-500">
        <template v-if="editingId === todo.id">
          <input v-model="editText" type="text"
            class="flex-1 text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1"
            @keyup.enter="saveEdit(todo.id)" @keyup.escape="editingId = null">
          <button @click="saveEdit(todo.id)" class="text-[10px] text-white px-2 py-0.5 rounded flex-shrink-0" style="background:#1e2533">存</button>
          <button @click="editingId = null" class="text-[10px] text-gray-400 flex-shrink-0">✕</button>
        </template>
        <template v-else>
          <span class="flex-1 text-xs text-gray-700" :class="todo.done ? 'line-through text-gray-400' : ''">{{ todo.text }}</span>
          <button @click="startEdit(todo)" class="hidden group-hover:block text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0">編輯</button>
          <button @click="todosStore.deleteTodo(todo.id)" class="hidden group-hover:block text-[10px] text-red-400 hover:text-red-600 flex-shrink-0">刪除</button>
        </template>
      </div>
    </div>

    <div v-if="totalCount === 0" class="text-xs text-gray-400 py-2">目前無系統提醒事項</div>

    <template v-if="totalCount > 0">
      <!-- 即將到期案件 -->
      <div v-if="urgentCases.length > 0" class="mb-3">
        <div class="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">即將到期案件</div>
        <div v-for="c in urgentCases" :key="c.id"
          @click="router.push({ name: 'cases', query: { region: c.companyId } })"
          class="flex items-center justify-between px-3 py-2 rounded-xl border border-red-100 bg-red-50 mb-1.5 last:mb-0 cursor-pointer hover:bg-red-100 transition-colors">
          <div>
            <div class="text-xs font-semibold text-gray-800">{{ c.name }}</div>
            <div class="text-[10px] text-gray-500">{{ c.assigneeName }}</div>
          </div>
          <span class="text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
            {{ deadlineLabel(c.deadline) }}
          </span>
        </div>
      </div>

      <!-- 今日跟進客戶 -->
      <div v-if="followUpClients.length > 0" class="mb-3">
        <div class="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">今日跟進客戶</div>
        <div v-for="c in followUpClients" :key="c.id"
          @click="router.push({ name: 'clients' })"
          class="flex items-center justify-between px-3 py-2 rounded-xl border border-amber-100 bg-amber-50 mb-1.5 last:mb-0 cursor-pointer hover:bg-amber-100 transition-colors">
          <div>
            <div class="text-xs font-semibold text-gray-800">{{ c.name }}</div>
            <div class="text-[10px] text-gray-500">{{ c.phone || c.email || '' }}</div>
          </div>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
            style="background:#c9a96e;color:#fff">
            {{ c.followUpDate }}
          </span>
        </div>
      </div>

      <!-- 逾期未收款 -->
      <div v-if="overduePayments.length > 0">
        <div class="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">逾期未收款</div>
        <div v-for="p in overduePayments" :key="`${p.caseId}-${p.label}`"
          @click="router.push({ name: 'cases', query: { region: p.companyId } })"
          class="flex items-center justify-between px-3 py-2 rounded-xl border border-orange-100 bg-orange-50 mb-1.5 last:mb-0 cursor-pointer hover:bg-orange-100 transition-colors">
          <div>
            <div class="text-xs font-semibold text-gray-800">{{ p.caseName }}</div>
            <div class="text-[10px] text-gray-500">{{ p.label }} · 到期 {{ p.dueStr }}</div>
          </div>
          <span class="text-[10px] font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
            ${{ (p.amount - p.paidAmount).toLocaleString() }} 未收
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCasesStore } from '@/stores/cases'
import { useClientsStore } from '@/stores/clients'
import { useTodosStore } from '@/stores/todos'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const casesStore = useCasesStore()
const clientsStore = useClientsStore()
const todosStore = useTodosStore()
const authStore = useAuthStore()

onMounted(() => todosStore.subscribe())

const showAddForm = ref(false)
const newTodoText = ref('')
const editingId = ref(null)
const editText = ref('')

async function addTodo() {
    if (!newTodoText.value.trim()) return
    await todosStore.addTodo(newTodoText.value.trim(), authStore.user?.uid ?? '')
    newTodoText.value = ''
    showAddForm.value = false
}

function startEdit(todo) {
    editingId.value = todo.id
    editText.value = todo.text
}

async function saveEdit(id) {
    if (!editText.value.trim()) return
    await todosStore.updateTodo(id, { text: editText.value.trim() })
    editingId.value = null
}

const today = new Date()
today.setHours(0, 0, 0, 0)
const in7Days = new Date(today)
in7Days.setDate(in7Days.getDate() + 7)

const todayStr = today.toISOString().slice(0, 10)

const urgentCases = computed(() =>
    casesStore.activeCases.filter(c => {
        if (!c.deadline) return false
        const dl = c.deadline.toDate?.()
        if (!dl) return false
        return dl >= today && dl <= in7Days
    }).sort((a, b) => {
        const da = a.deadline.toDate?.()
        const db = b.deadline.toDate?.()
        return da - db
    })
)

const followUpClients = computed(() =>
    clientsStore.clients.filter(c => c.followUpDate && c.followUpDate <= todayStr)
        .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
)

const overduePayments = computed(() => {
    const result = []
    casesStore.cases.forEach(c => {
        if (!c.paymentMilestones?.length) return
        c.paymentMilestones.forEach(p => {
            if (!p.dueDate || p.dueDate >= todayStr) return
            const paidAmount = p.paidAmount || 0
            const amount = p.amount || 0
            if (amount <= 0 || paidAmount >= amount) return
            result.push({ caseName: c.name, caseId: c.id, companyId: c.companyId, label: p.label, amount, paidAmount, dueStr: p.dueDate })
        })
    })
    return result.sort((a, b) => a.dueStr.localeCompare(b.dueStr))
})

const totalCount = computed(() => urgentCases.value.length + followUpClients.value.length + overduePayments.value.length)

function deadlineLabel(deadline) {
    const dl = deadline.toDate?.()
    if (!dl) return ''
    const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24))
    if (diff === 0) return '今日到期'
    if (diff === 1) return '明日到期'
    return `${diff} 天後`
}
</script>
