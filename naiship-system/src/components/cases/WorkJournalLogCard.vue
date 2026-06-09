<template>
  <div class="bg-white rounded-2xl shadow-sm p-5">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] text-white font-bold"
          :style="`background:${empColor(log.userId)}`">
          {{ log.userName?.[0] ?? '?' }}
        </span>
        <div>
          <div class="text-sm font-semibold text-gray-800">{{ log.userName }}</div>
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
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">{{ entry.caseName }}</span>
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
        <div class="flex items-center gap-2">
          <span v-if="log.overtimeApproved" class="text-[10px] text-green-600 font-semibold">✓ 已確認</span>
          <button v-else-if="isManager" @click="$emit('approve-overtime', log.id)"
            class="text-[11px] text-white px-2.5 py-1 rounded-lg" style="background:#22c55e">✓ 確認加班</button>
          <span v-else class="text-[10px] text-purple-500 font-semibold">待主管確認</span>
        </div>
      </div>
      <div v-for="(ot, i) in log.overtimeItems" :key="i"
        class="bg-white rounded-lg p-2.5 border border-purple-100 mb-2 last:mb-0 text-xs text-gray-700">
        <div><span class="text-gray-400">原因：</span>{{ ot.reason }}</div>
        <div class="text-purple-600 font-semibold mt-0.5">加班 {{ ot.hours }} 小時</div>
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
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0" style="background:#1e2533">
          {{ reply.creatorName?.[0] ?? '管' }}
        </span>
        <div class="bg-blue-50 rounded-xl px-3 py-2 text-xs text-gray-700 flex-1 whitespace-pre-wrap">
          {{ reply.content }}
          <div class="text-[10px] text-gray-400 mt-1">{{ reply.creatorName }} · {{ formatTime(reply.createdAt) }}</div>
        </div>
      </div>
      <button v-if="isManager" @click="showReply = !showReply"
        class="text-[11px] hover:underline ml-4 sm:ml-8" style="color:#c9a96e">
        {{ log.replies?.length ? '回覆…' : '＋ 主管回覆' }}
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
import { ref } from 'vue'

const props = defineProps({
    log: Object,
    canEdit: Boolean,
    isManager: Boolean,
})
const emit = defineEmits(['edit', 'approve-fuel', 'approve-overtime', 'reply', 'preview'])

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

const EMP_COLORS = ['#c9a96e', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']
function empColor(uid) { return EMP_COLORS[(uid?.charCodeAt(0) ?? 0) % EMP_COLORS.length] }

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>
