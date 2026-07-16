<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold text-gray-700">聯繫記錄</h3>
      <button @click="openModal" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">＋ 新增聯繫記錄</button>
    </div>

    <!-- 時間軸列表 -->
    <div v-if="logs.length > 0" class="relative">
      <div class="absolute left-[52px] top-0 bottom-0 w-px bg-gray-100"></div>
      <div v-for="log in logs" :key="log.id" class="flex gap-3 mb-5 relative">
        <!-- 日期 -->
        <div class="w-[52px] flex-shrink-0 text-right pr-3">
          <span class="text-[11px] font-semibold text-gray-600 leading-tight block">{{ formatDateShort(log.date) }}</span>
          <span class="text-[10px] text-gray-400 block">{{ formatYear(log.date) }}</span>
        </div>
        <!-- 圓點 -->
        <div class="flex-shrink-0 mt-0.5 relative z-10">
          <div class="w-3 h-3 rounded-full border-2 border-white shadow-sm" :class="outcomeDotClass(log.outcome)"></div>
        </div>
        <!-- 內容 -->
        <div class="flex-1 min-w-0 pb-1">
          <div class="flex items-center gap-1.5 flex-wrap mb-1">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="methodBadgeClass(log.method)">{{ log.method }}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="outcomeBadgeClass(log.outcome)">{{ log.outcome }}</span>
          </div>
          <p v-if="log.notes" class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-1">{{ log.notes }}</p>
          <div v-if="log.nextAction" class="flex items-center gap-1 text-[11px] text-amber-600">
            <span>🕐</span>
            <span>{{ log.nextAction }}</span>
          </div>
          <p class="text-[10px] text-gray-400 mt-1">{{ log.creatorName || '—' }}</p>
        </div>
      </div>
    </div>
    <div v-else class="text-center py-8 text-gray-400 text-sm">尚無聯繫記錄</div>

    <!-- 新增 Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border-t-4" style="border-top-color:#c9a96e">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-base font-bold text-gray-800">新增聯繫記錄</h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div class="flex flex-col gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">聯繫日期</label>
            <input v-model="form.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">聯繫方式</label>
              <select v-model="form.method" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option v-for="m in methodOptions" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">結果</label>
              <select v-model="form.outcome" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option v-for="o in outcomeOptions" :key="o" :value="o">{{ o }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">備註</label>
            <textarea v-model="form.notes" rows="3" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none" placeholder="記錄對話重點…"></textarea>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">下次行動（選填）</label>
            <input v-model="form.nextAction" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：下週再致電確認">
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button @click="closeModal" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="submitLog" :disabled="submitting" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
            {{ submitting ? '儲存中…' : '儲存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { useNotificationsStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'

const props = defineProps({ clientId: { type: String, required: true } })

const authStore = useAuthStore()
const clientsStore = useClientsStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const logs = ref([])
const showModal = ref(false)
const submitting = ref(false)

const methodOptions = ['電話', 'Line', '見面', 'Email', '其他']
const outcomeOptions = ['有興趣', '需考慮', '已報價', '準備簽約', '婉拒', '無回應', '其他']

const today = () => new Date().toISOString().slice(0, 10)

const form = ref({ date: today(), method: '電話', outcome: '有興趣', notes: '', nextAction: '' })

async function loadLogs() {
    if (!props.clientId) return
    const q = query(collection(db, 'clients', props.clientId, 'contactLogs'), orderBy('date', 'desc'))
    const snap = await getDocs(q)
    logs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

function openModal() {
    form.value = { date: today(), method: '電話', outcome: '有興趣', notes: '', nextAction: '' }
    showModal.value = true
}

function closeModal() {
    showModal.value = false
}

async function submitLog() {
    if (submitting.value) return
    submitting.value = true
    try {
        await addDoc(collection(db, 'clients', props.clientId, 'contactLogs'), {
            date: form.value.date,
            method: form.value.method,
            outcome: form.value.outcome,
            notes: form.value.notes,
            nextAction: form.value.nextAction,
            createdAt: serverTimestamp(),
            createdBy: authStore.user?.uid ?? '',
            creatorName: authStore.name ?? '',
        })
        notifStore.notifyAll(authStore.name ?? '', `新增了聯繫記錄（${form.value.method}・${form.value.outcome}）`, '', '')
        toast('聯繫記錄已新增')
        closeModal()
        await loadLogs()
        if (form.value.outcome === '準備簽約') {
            if (confirm('是否同步將此客戶狀態更新為「已簽約」？')) {
                await clientsStore.updateClient(props.clientId, { status: 'signed' })
            }
        }
    } finally {
        submitting.value = false
    }
}

function formatDateShort(dateStr) {
    if (!dateStr) return ''
    const [, m, d] = dateStr.split('-')
    return `${parseInt(m)}/${parseInt(d)}`
}

function formatYear(dateStr) {
    if (!dateStr) return ''
    return dateStr.slice(0, 4)
}

function outcomeDotClass(outcome) {
    const map = {
        '有興趣': 'bg-green-400',
        '需考慮': 'bg-yellow-400',
        '已報價': 'bg-blue-400',
        '準備簽約': 'bg-indigo-500',
        '婉拒': 'bg-red-400',
        '無回應': 'bg-gray-300',
        '其他': 'bg-gray-400',
    }
    return map[outcome] ?? 'bg-gray-300'
}

function outcomeBadgeClass(outcome) {
    const map = {
        '有興趣': 'bg-green-100 text-green-700',
        '需考慮': 'bg-yellow-100 text-yellow-700',
        '已報價': 'bg-blue-100 text-blue-700',
        '準備簽約': 'bg-indigo-100 text-indigo-700',
        '婉拒': 'bg-red-100 text-red-500',
        '無回應': 'bg-gray-100 text-gray-500',
        '其他': 'bg-gray-100 text-gray-500',
    }
    return map[outcome] ?? 'bg-gray-100 text-gray-500'
}

function methodBadgeClass(method) {
    const map = {
        '電話': 'bg-purple-100 text-purple-700',
        'Line': 'bg-green-100 text-green-700',
        '見面': 'bg-amber-100 text-amber-700',
        'Email': 'bg-sky-100 text-sky-700',
        '其他': 'bg-gray-100 text-gray-500',
    }
    return map[method] ?? 'bg-gray-100 text-gray-500'
}

onMounted(loadLogs)
</script>
