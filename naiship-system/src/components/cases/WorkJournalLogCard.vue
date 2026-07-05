<template>
  <div class="bg-white rounded-2xl shadow-sm p-5">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] text-white font-bold"
          :style="`background:${empColor(displayName)}`">
          {{ displayName?.[0] ?? '?' }}
        </span>
        <div>
          <div class="text-sm font-semibold text-gray-800">{{ displayName }}</div>
          <div class="text-[10px] text-gray-400">
            {{ formatTime(log.createdAt) }}
            <span v-if="log.updatedAt" class="ml-1 text-gray-300">（已編輯）</span>
          </div>
        </div>
      </div>
      <button v-if="canEdit" @click="$emit('edit', log)"
        class="text-xs text-gray-400 hover:text-amber-600 border border-gray-200 hover:border-amber-300 rounded-lg px-3 py-1.5 min-h-[36px] transition-colors">
        編輯
      </button>
    </div>

    <!-- Case entries -->
    <div v-if="log.caseEntries?.length || log.content" class="mb-3 bg-gray-50 rounded-xl p-3">
      <div class="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">負責案件回報</div>
      <template v-if="log.caseEntries?.length">
        <div v-for="entry in log.caseEntries" :key="entry.caseId"
          class="bg-white rounded-lg p-2.5 border border-gray-100 mb-2 last:mb-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
              :style="`background:${CASE_STATUS_COLORS[casesStore.cases.find(c => c.id === entry.caseId)?.status] ?? '#3b82f6'}`">
              {{ entry.caseName }}</span>
          </div>
          <div class="text-xs text-gray-600 whitespace-pre-wrap">{{ entry.content }}</div>
        </div>
      </template>
      <div v-else class="bg-white rounded-lg p-2.5 border border-gray-100">
        <div class="text-xs text-gray-600 whitespace-pre-wrap">{{ log.content }}</div>
      </div>
    </div>

    <!-- Other items -->
    <div v-if="log.otherItems?.length" class="mb-3 bg-gray-50 rounded-xl p-3">
      <div class="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">其他工作項目</div>
      <div v-for="(item, i) in log.otherItems" :key="i"
        class="bg-white rounded-lg p-2.5 border border-gray-100 mb-2 last:mb-0 text-xs text-gray-600 whitespace-pre-wrap">
        {{ item.content }}
      </div>
    </div>

    <!-- Fuel expenses (new multi format) -->
    <div v-if="log.fuelExpenses?.length" class="mb-3 bg-amber-50 rounded-xl p-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">
          申請油資（共 {{ log.fuelExpenses.length }} 筆）
        </div>
        <div class="flex items-center gap-2">
          <span v-if="log.fuelApproved" class="text-[10px] text-green-600 font-semibold">✓ 已確認</span>
          <button v-else-if="isManager" @click="$emit('approve-fuel', log.id)"
            class="text-[11px] text-white px-2.5 py-1 rounded-lg" style="background:#22c55e">✓ 確認油資</button>
          <span v-else class="text-[10px] text-amber-500 font-semibold">待主管確認</span>
        </div>
      </div>
      <div v-for="(f, i) in log.fuelExpenses" :key="i"
        class="flex gap-3 items-start mb-2 last:mb-0 pb-2 last:pb-0 border-b last:border-0 border-amber-100">
        <img v-if="f.photoUrl" :src="f.photoUrl"
          class="w-14 h-14 rounded-lg object-cover cursor-pointer flex-shrink-0"
          @click="previewImage(f.photoUrl)">
        <div>
          <div class="text-xs text-gray-700 mb-1"><span class="text-gray-400">原因：</span>{{ f.reason }}</div>
          <div class="text-xs text-gray-700"><span class="text-gray-400">路程：</span>{{ Number(f.distance).toFixed(2) }} 公里</div>
          <div class="text-xs text-amber-600 font-semibold mt-0.5">補貼金額：{{ (f.distance * 6).toFixed(2) }} 元</div>
        </div>
      </div>
    </div>
    <!-- Fuel expense (old single format) -->
    <div v-else-if="log.fuelExpense" class="mb-3 bg-amber-50 rounded-xl p-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">申請油資</div>
        <span v-if="log.fuelApproved !== false" class="text-[10px] text-green-600 font-semibold">✓ 已確認</span>
      </div>
      <div class="flex gap-3 items-start">
        <img v-if="log.fuelExpense.photoUrl" :src="log.fuelExpense.photoUrl"
          class="w-16 h-16 rounded-lg object-cover cursor-pointer flex-shrink-0"
          @click="previewImage(log.fuelExpense.photoUrl)">
        <div>
          <div class="text-xs text-gray-700 mb-1"><span class="text-gray-400">原因：</span>{{ log.fuelExpense.reason }}</div>
          <div class="text-xs text-gray-700"><span class="text-gray-400">路程：</span>{{ Number(log.fuelExpense.distance).toFixed(2) }} 公里</div>
          <div class="text-xs text-amber-600 font-semibold mt-0.5">補貼金額：{{ (log.fuelExpense.distance * 6).toFixed(2) }} 元</div>
        </div>
      </div>
    </div>

    <!-- Overtime items -->
    <div v-if="log.overtimeItems?.length" class="mb-3 bg-purple-50 rounded-xl p-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[10px] text-purple-600 font-semibold uppercase tracking-wide">
          加班申請（共 {{ log.overtimeItems.length }} 筆）
        </div>
        <span v-if="allOvertimeDecided" class="text-[10px] text-green-600 font-semibold">✓ 全部已審核</span>
        <span v-else class="text-[10px] text-purple-500 font-semibold">{{ pendingOvertimeCount }} 筆待審核</span>
      </div>
      <div v-for="(ot, i) in log.overtimeItems" :key="i"
        class="bg-white rounded-lg p-2.5 border mb-2 last:mb-0 text-xs text-gray-700"
        :class="ot.approved === true ? 'border-green-200' : ot.approved === false ? 'border-red-200' : 'border-purple-100'">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <div><span class="text-gray-400">原因：</span>{{ ot.reason }}</div>
            <div class="text-purple-600 font-semibold mt-0.5">{{ ot.type || '平日' }} 加班 {{ ot.hours }} 小時</div>
          </div>
          <div class="flex-shrink-0">
            <span v-if="ot.approved === true"
              class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">✓ 同意</span>
            <span v-else-if="ot.approved === false"
              class="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">✕ 不同意</span>
            <div v-else-if="isManager" class="flex gap-1">
              <button @click="$emit('approve-overtime-item', log, i, true)"
                class="text-[11px] text-white px-2 py-0.5 rounded-lg" style="background:#22c55e">✓ 同意</button>
              <button @click="$emit('approve-overtime-item', log, i, false)"
                class="text-[11px] text-white px-2 py-0.5 rounded-lg" style="background:#ef4444">✕ 不同意</button>
            </div>
            <span v-else class="text-[10px] text-purple-400">待審核</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Log attachments -->
    <div v-if="log.logAttachments?.length" class="mb-3 bg-gray-50 rounded-xl p-3">
      <div class="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">附件</div>
      <div class="flex gap-2 flex-wrap">
        <a v-for="att in log.logAttachments" :key="att.url"
          :href="att.isPdf ? (att.pdfUrl ?? att.url) : undefined" :target="att.isPdf ? '_blank' : undefined">
          <div v-if="att.isPdf" class="w-12 h-12 rounded bg-red-100 flex items-center justify-center text-[10px] text-red-600 font-bold hover:bg-red-200">PDF</div>
          <img v-else :src="att.url" @click.prevent="previewImage(att.url)" class="w-12 h-12 rounded object-cover cursor-pointer hover:opacity-80">
        </a>
      </div>
    </div>

    <!-- Replies -->
    <div class="border-t border-gray-100 pt-3">
      <div v-for="reply in (log.replies || [])" :key="reply.id" class="flex items-start gap-2 mb-2">
        <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold flex-shrink-0" style="background:#c9a96e">
          {{ reply.creatorName?.[0] ?? '管' }}
        </span>
        <div class="flex-1 rounded-xl px-3 py-2.5 border-l-4 text-xs text-gray-800 whitespace-pre-wrap" style="background:#fffbf4;border-left-color:#c9a96e">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style="background:#c9a96e">主管</span>
            <span class="text-[10px] text-gray-500">{{ reply.creatorName }} · {{ formatTime(reply.createdAt) }}</span>
          </div>
          {{ reply.content }}
        </div>
      </div>
      <button v-if="isManager" @click="showReply = !showReply"
        class="text-xs font-medium px-3 py-1.5 rounded-lg border ml-4 sm:ml-10 transition-colors"
        style="color:#c9a96e;border-color:#c9a96e"
        onmouseover="this.style.background='rgba(201,169,110,0.1)'" onmouseout="this.style.background=''">
        {{ log.replies?.length ? '＋ 繼續回覆' : '＋ 主管回覆' }}
      </button>
      <div v-if="showReply" class="mt-2 flex flex-col gap-2 ml-4 sm:ml-8">
        <textarea v-model="replyContent" rows="3" placeholder="輸入回覆..."
          class="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 resize-none"></textarea>
        <div class="flex justify-end gap-2">
          <button @click="showReply = false; replyContent = ''"
            class="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">取消</button>
          <button @click="submitReply"
            class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">送出</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useCasesStore } from '@/stores/cases'
import { useUsersStore } from '@/stores/users'
import { CASE_STATUS_COLORS } from '@/constants/caseStatus'

const casesStore = useCasesStore()
const usersStore = useUsersStore()

const props = defineProps({
    log: Object,
    canEdit: Boolean,
    isManager: Boolean,
})
const emit = defineEmits(['edit', 'approve-fuel', 'approve-overtime-item', 'reply', 'preview'])

const displayName = computed(() =>
    usersStore.users.find(u => u.id === props.log.userId)?.name || props.log.userName
)

const allOvertimeDecided = computed(() =>
    props.log.overtimeItems?.length > 0 &&
    props.log.overtimeItems.every(i => i.approved != null)
)
const pendingOvertimeCount = computed(() =>
    props.log.overtimeItems?.filter(i => i.approved == null).length ?? 0
)

const showReply = ref(false)
const replyContent = ref('')

function getLogImages(log) {
    const urls = []
    if (log.fuelExpenses?.length) {
        log.fuelExpenses.forEach(f => { if (f.photoUrl) urls.push(f.photoUrl) })
    } else if (log.fuelExpense?.photoUrl) {
        urls.push(log.fuelExpense.photoUrl)
    }
    if (log.logAttachments?.length) {
        log.logAttachments.forEach(att => { if (!att.isPdf) urls.push(att.url) })
    }
    return urls
}

function previewImage(url) {
    const urls = getLogImages(props.log)
    const idx = urls.indexOf(url)
    emit('preview', { urls, index: idx >= 0 ? idx : 0 })
}

function submitReply() {
    if (!replyContent.value.trim()) return
    emit('reply', props.log.id, replyContent.value.trim())
    replyContent.value = ''
    showReply.value = false
}

const MEMBER_COLORS = { '柏': '#c9a96e', '其宏': '#1f2937', '蚌': '#ef4444' }
function empColor(name) {
    if (!name) return '#9ca3af'
    if (MEMBER_COLORS[name]) return MEMBER_COLORS[name]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
    const fallback = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#14b8a6', '#f97316']
    return fallback[hash % fallback.length]
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（週${WEEKDAYS[d.getDay()]}）${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>
