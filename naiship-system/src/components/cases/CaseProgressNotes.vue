<template>
  <div class="border-t border-gray-200 bg-white">
    <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
      <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
      <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">洽談進度</span>
      <button @click="showAddForm = true" class="ml-auto text-[11px] text-amber-500 hover:text-amber-700">+ 新增備注</button>
    </div>

    <div class="px-5 py-4 flex flex-col gap-4">
      <div v-if="notesStore.notes.length === 0 && !showAddForm"
        class="text-[11px] text-gray-300 text-center py-3">尚無洽談進度備注</div>

      <div v-for="note in notesStore.notes" :key="note.id" class="flex gap-3">
        <div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] text-white font-bold"
          :style="`background:${userColor(note.authorId)}`">
          {{ note.authorName?.[0] ?? '?' }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-semibold text-gray-700">{{ note.authorName }}</span>
            <span class="text-[10px] text-gray-400">{{ formatTime(note.createdAt) }}</span>
            <span v-if="note.updatedAt" class="text-[10px] text-gray-300">（已編輯）</span>
          </div>
          <template v-if="editingId === note.id">
            <textarea v-model="editText" rows="3"
              class="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none mb-2"></textarea>
            <div class="flex gap-2">
              <button @click="saveEdit(note)"
                class="text-[11px] text-white px-3 py-1 rounded-lg" style="background:#1e2533">儲存</button>
              <button @click="editingId = null" class="text-[11px] text-gray-400">取消</button>
            </div>
          </template>
          <template v-else>
            <p class="text-xs text-gray-700 whitespace-pre-wrap">{{ note.text }}</p>
            <div v-if="note.attachments?.length" class="flex gap-2 flex-wrap mt-2">
              <template v-for="att in note.attachments" :key="att.url">
                <a v-if="att.type === 'pdf'" :href="att.url" target="_blank"
                  class="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center text-[10px] text-red-600 font-bold hover:bg-red-100">PDF</a>
                <img v-else :src="att.url" @click="previewUrl = att.url"
                  class="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80">
              </template>
            </div>
            <button v-if="isOwn(note)" @click="startEdit(note)"
              class="mt-1 text-[10px] text-gray-400 hover:text-gray-600">編輯</button>
          </template>
        </div>
      </div>

      <div v-if="showAddForm" class="border-t border-gray-100 pt-4">
        <textarea v-model="newText" rows="3" placeholder="輸入備注內容…"
          class="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 resize-none mb-2"
          autofocus></textarea>
        <div v-if="pendingFiles.length" class="flex gap-2 flex-wrap mb-2">
          <div v-for="(f, i) in pendingFiles" :key="i"
            class="flex items-center gap-1 text-[10px] bg-gray-100 rounded px-2 py-1 text-gray-600">
            {{ f.name }}
            <button @click="pendingFiles.splice(i, 1)" class="text-gray-400 hover:text-red-500 ml-1">✕</button>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button @click="fileInput.click()"
            class="text-[11px] text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">📎 附件</button>
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleFiles">
          <button @click="submitNote" :disabled="submitting || !newText.trim()"
            class="text-[11px] text-white px-4 py-1.5 rounded-lg disabled:opacity-50" style="background:#1e2533">
            {{ submitting ? '送出中…' : '送出' }}
          </button>
          <button @click="cancelAdd" class="text-[11px] text-gray-400">取消</button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="previewUrl" @click="previewUrl = null"
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-pointer">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl">
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useCaseProgressNotesStore } from '@/stores/caseProgressNotes'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useNotificationsStore } from '@/stores/notifications'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { useToast } from '@/composables/useToast'

const props = defineProps({ caseId: String, caseName: String, companyId: String })
const notesStore = useCaseProgressNotesStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

onMounted(() => notesStore.subscribe(props.caseId))
onUnmounted(() => notesStore.cleanup())

const showAddForm = ref(false)
const newText = ref('')
const pendingFiles = ref([])
const submitting = ref(false)
const editingId = ref(null)
const editText = ref('')
const previewUrl = ref(null)
const fileInput = ref(null)

const EMAIL_COLORS = {
    'dreambreaker24@gmail.com': '#c9a96e',
    'p8105000@gmail.com': '#1f2937',
    'daydream54321@gmail.com': '#ef4444',
}
const FALLBACK_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899']

function userColor(uid) {
    if (!uid) return '#6b7280'
    const user = usersStore.users.find(u => u.id === uid)
    if (user?.email && EMAIL_COLORS[user.email]) return EMAIL_COLORS[user.email]
    return FALLBACK_COLORS[(uid.charCodeAt(0) + (uid.charCodeAt(uid.length - 1) ?? 0)) % FALLBACK_COLORS.length]
}

function isOwn(note) { return note.authorId === authStore.user?.uid }

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function handleFiles(e) {
    for (const file of e.target.files) {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); continue }
        pendingFiles.value.push(file)
    }
    e.target.value = ''
}

async function submitNote() {
    if (!newText.value.trim()) return
    submitting.value = true
    try {
        const attachments = []
        for (const file of pendingFiles.value) {
            const url = await uploadPhoto(file, 'progress-notes')
            attachments.push({ url, type: file.type === 'application/pdf' ? 'pdf' : 'image', name: file.name })
        }
        const text = newText.value.trim()
        await notesStore.addNote(props.caseId, {
            text,
            authorId: authStore.user?.uid ?? '',
            authorName: authStore.name ?? '',
            attachments,
        })
        const preview = text.slice(0, 30) + (text.length > 30 ? '…' : '')
        await notifStore.notifyAll(
            authStore.name ?? '',
            `「${props.caseName}」新增了洽談進度備注：${preview}`,
            props.caseId,
            props.caseName,
            props.companyId
        )
        newText.value = ''
        pendingFiles.value = []
        showAddForm.value = false
    } finally {
        submitting.value = false
    }
}

function cancelAdd() {
    showAddForm.value = false
    newText.value = ''
    pendingFiles.value = []
}

function startEdit(note) {
    editingId.value = note.id
    editText.value = note.text
}

async function saveEdit(note) {
    if (!editText.value.trim()) return
    await notesStore.updateNote(props.caseId, note.id, {
        text: editText.value.trim(),
        attachments: note.attachments ?? [],
    })
    editingId.value = null
}
</script>
