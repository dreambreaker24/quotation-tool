<template>
  <div class="bg-white rounded-2xl shadow-md p-4 flex flex-col">
    <div class="flex items-center gap-2 mb-3 flex-shrink-0">
      <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide pl-3 border-l-2" style="border-left-color:#c9a96e">回覆區塊</h2>
    </div>

    <!-- 留言列表 -->
    <div class="flex-1 overflow-y-auto flex flex-col gap-3 mb-3 min-h-0 max-h-72">
      <div v-if="notesStore.notes.length === 0" class="text-xs text-gray-400 py-4 text-center">尚無回覆</div>

      <div v-for="note in notesStore.notes" :key="note.id" class="flex gap-2.5">
        <div class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
          :style="`background:${authorColor(note.authorId)}`">
          {{ note.authorName?.[0] ?? '?' }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-xs font-semibold text-gray-700">{{ note.authorName }}</span>
            <span class="text-[10px] text-gray-400">{{ formatTime(note.createdAt) }}</span>
            <span v-if="note.updatedAt" class="text-[10px] text-gray-300">（已編輯）</span>
          </div>

          <template v-if="editingId === note.id">
            <textarea v-model="editContent" rows="3" autofocus
              class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 resize-none mb-1.5"></textarea>
            <div v-if="editPendingFiles.length" class="flex gap-1.5 flex-wrap mb-1.5">
              <div v-for="(f, i) in editPendingFiles" :key="i"
                class="flex items-center gap-1 text-[10px] bg-gray-100 rounded px-2 py-0.5 text-gray-600">
                {{ f.name }}
                <button @click="editPendingFiles.splice(i, 1)" class="text-gray-400 hover:text-red-500 ml-1">✕</button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button @click="editFileInput.click()"
                class="text-[10px] text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50">📎 附件</button>
              <input ref="editFileInput" type="file" accept="image/jpeg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleEditFiles">
              <button @click="saveEdit(note)" :disabled="saving"
                class="text-[10px] text-white px-3 py-1 rounded-lg disabled:opacity-50" style="background:#1e2533">儲存</button>
              <button @click="cancelEdit" class="text-[10px] text-gray-400">取消</button>
            </div>
          </template>

          <template v-else>
            <p class="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{{ note.content }}</p>
            <div v-if="note.attachments?.length" class="flex gap-1.5 flex-wrap mt-1.5">
              <template v-for="att in note.attachments" :key="att.url">
                <a v-if="att.type === 'pdf'" :href="att.url" target="_blank"
                  class="w-10 h-10 rounded bg-red-50 flex items-center justify-center text-[9px] text-red-600 font-bold hover:bg-red-100">PDF</a>
                <img v-else :src="att.url" @click="openPreview(note, att.url)"
                  class="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80">
              </template>
            </div>
            <div class="flex gap-2 mt-1">
              <button v-if="isOwn(note)" @click="startEdit(note)"
                class="text-[10px] text-gray-400 hover:text-gray-600">編輯</button>
              <button v-if="isOwn(note) || authStore.isAdmin" @click="removeNote(note.id)"
                class="text-[10px] text-red-400 hover:text-red-600">刪除</button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 輸入區 -->
    <div class="border-t border-gray-100 pt-3 flex-shrink-0">
      <textarea v-model="newContent" rows="2" placeholder="輸入回覆…（Enter 換行）"
        class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 resize-none mb-2"
      ></textarea>
      <div v-if="pendingFiles.length" class="flex gap-1.5 flex-wrap mb-2">
        <div v-for="(f, i) in pendingFiles" :key="i"
          class="flex items-center gap-1 text-[10px] bg-gray-100 rounded px-2 py-0.5 text-gray-600">
          {{ f.name }}
          <button @click="pendingFiles.splice(i, 1)" class="text-gray-400 hover:text-red-500 ml-1">✕</button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button @click="fileInput.click()"
          class="text-[10px] text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50">📎 附件</button>
        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleFiles">
        <button @click="submitNote" :disabled="submitting || !newContent.trim()"
          class="text-[10px] text-white px-3 py-1.5 rounded-lg disabled:opacity-50 ml-auto" style="background:#1e2533">
          {{ submitting ? '送出中…' : '送出' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 圖片預覽（支援多張導覽） -->
  <div v-if="previewList.length > 0"
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    @click.self="closePreview">
    <button v-if="previewIndex > 0" @click="navigatePhoto(-1)"
      class="absolute left-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">‹</button>
    <img :src="previewList[previewIndex]" class="max-h-[80vh] max-w-[80vw] rounded-xl cursor-default">
    <button v-if="previewIndex < previewList.length - 1" @click="navigatePhoto(1)"
      class="absolute right-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">›</button>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useDashboardNotesStore } from '@/stores/dashboardNotes'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { useToast } from '@/composables/useToast'

const notesStore = useDashboardNotesStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const { toast } = useToast()

const newContent = ref('')
const pendingFiles = ref([])
const submitting = ref(false)
const fileInput = ref(null)

const editingId = ref(null)
const editContent = ref('')
const editExistingAttachments = ref([])
const editPendingFiles = ref([])
const saving = ref(false)
const editFileInput = ref(null)

const previewList = ref([])
const previewIndex = ref(0)

const EMAIL_COLORS = {
    'dreambreaker24@gmail.com': '#c9a96e',
    'p8105000@gmail.com': '#1f2937',
    'daydream54321@gmail.com': '#ef4444',
}
const FALLBACK_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899']

function authorColor(uid) {
    if (!uid) return '#6b7280'
    const user = usersStore.users.find(u => u.id === uid)
    if (user?.email && EMAIL_COLORS[user.email]) return EMAIL_COLORS[user.email]
    return FALLBACK_COLORS[(uid.charCodeAt(0) + (uid.charCodeAt(uid.length - 1) ?? 0)) % FALLBACK_COLORS.length]
}

function isOwn(note) {
    return note.authorId === authStore.user?.uid
}

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    const now = new Date()
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}/${dd}`
}

function openPreview(note, clickedUrl) {
    const images = (note.attachments ?? []).filter(a => a.type !== 'pdf').map(a => a.url)
    const idx = images.indexOf(clickedUrl)
    previewList.value = images
    previewIndex.value = idx >= 0 ? idx : 0
}

function closePreview() {
    previewList.value = []
    previewIndex.value = 0
}

function navigatePhoto(dir) {
    const next = previewIndex.value + dir
    if (next >= 0 && next < previewList.value.length) previewIndex.value = next
}

function handleKeydown(e) {
    if (!previewList.value.length) return
    if (e.key === 'Escape') { closePreview(); return }
    if (e.key === 'ArrowRight') { e.preventDefault(); navigatePhoto(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); navigatePhoto(-1) }
}

function handleFiles(e) {
    for (const file of e.target.files) {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); continue }
        pendingFiles.value.push(file)
    }
    e.target.value = ''
}

function handleEditFiles(e) {
    for (const file of e.target.files) {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); continue }
        editPendingFiles.value.push(file)
    }
    e.target.value = ''
}

async function submitNote() {
    if (!newContent.value.trim() || submitting.value) return
    submitting.value = true
    try {
        const attachments = []
        for (const file of pendingFiles.value) {
            const url = await uploadPhoto(file, 'dashboard-notes')
            attachments.push({ url, type: file.type === 'application/pdf' ? 'pdf' : 'image', name: file.name })
        }
        await notesStore.addNote({
            content: newContent.value.trim(),
            authorId: authStore.user?.uid ?? '',
            authorName: authStore.name ?? '',
            attachments,
        })
        newContent.value = ''
        pendingFiles.value = []
    } catch {
        toast('送出失敗，請重試', 'error')
    } finally {
        submitting.value = false
    }
}

function startEdit(note) {
    editingId.value = note.id
    editContent.value = note.content
    editExistingAttachments.value = [...(note.attachments ?? [])]
    editPendingFiles.value = []
}

function cancelEdit() {
    editingId.value = null
    editContent.value = ''
    editExistingAttachments.value = []
    editPendingFiles.value = []
}

async function saveEdit(note) {
    if (!editContent.value.trim() || saving.value) return
    saving.value = true
    try {
        const attachments = [...editExistingAttachments.value]
        for (const file of editPendingFiles.value) {
            const url = await uploadPhoto(file, 'dashboard-notes')
            attachments.push({ url, type: file.type === 'application/pdf' ? 'pdf' : 'image', name: file.name })
        }
        await notesStore.updateNote(note.id, { content: editContent.value.trim(), attachments })
        cancelEdit()
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        saving.value = false
    }
}

async function removeNote(id) {
    if (!confirm('確定要刪除這則回覆？')) return
    try {
        await notesStore.deleteNote(id)
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}

onMounted(() => {
    notesStore.subscribe()
    usersStore.subscribe()
    window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
    notesStore.cleanup()
    window.removeEventListener('keydown', handleKeydown)
})
</script>
