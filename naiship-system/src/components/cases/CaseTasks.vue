<template>
  <div class="border-t border-gray-200 bg-white">
    <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
      <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
      <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(201,169,110,0.15);color:#c9a96e">待辦事項</span>
    </div>

    <div class="flex flex-col gap-0">
      <!-- 客戶需求 + 主管指示 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-gray-100 divide-y sm:divide-y-0">
        <!-- 客戶需求 -->
        <div class="p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-blue-600 pl-2 border-l-2 border-blue-400">客戶需求</span>
              <span v-if="clientTasks.length" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{{ clientTasks.filter(t=>t.done).length }}/{{ clientTasks.length }}</span>
            </div>
            <button @click="openAdd('client')" class="text-[11px] px-2.5 py-1 rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50">+ 新增</button>
          </div>
          <div class="flex flex-col gap-2">
            <div v-for="(t, idx) in clientTasks" :key="t.id"
              class="group relative flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs text-gray-700 leading-relaxed transition-opacity"
              :class="t.done ? 'bg-gray-50 opacity-50' : 'bg-blue-50'">
              <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                :class="t.done ? 'bg-gray-400' : 'bg-blue-500'">{{ idx + 1 }}</span>
              <div class="flex-1 min-w-0">
                <template v-if="editingId === t.id">
                  <textarea v-model="editContent" rows="2"
                    class="w-full text-xs border border-blue-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 bg-white mb-2 resize-none"></textarea>
                  <div v-if="editExistingAttachments.length" class="flex gap-1.5 flex-wrap mb-2">
                    <div v-for="(att, i) in editExistingAttachments" :key="att.url" class="relative">
                      <div v-if="att.isPdf" class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
                      <img v-else :src="att.url" class="w-10 h-10 rounded object-cover">
                      <button @click="editExistingAttachments.splice(i,1)"
                        class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
                    </div>
                  </div>
                  <div v-if="editPendingFiles.length" class="flex gap-1.5 flex-wrap mb-2">
                    <div v-for="(f, i) in editPendingFiles" :key="i" class="relative">
                      <img v-if="f.preview" :src="f.preview" class="w-10 h-10 rounded object-cover">
                      <div v-else class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
                      <button @click="editPendingFiles.splice(i,1)"
                        class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
                    </div>
                  </div>
                  <div class="flex gap-2 justify-end items-center">
                    <button @click="editAttachInput.click()" class="text-[10px] text-gray-400 hover:text-gray-600">📎 附件</button>
                    <button @click="saveEdit(t.id)" class="text-[10px] text-white px-2.5 py-1 rounded-lg" style="background:#3b82f6">儲存</button>
                    <button @click="cancelEdit" class="text-[10px] text-gray-400 px-2 py-1">取消</button>
                  </div>
                </template>
                <template v-else>
                  <span :class="doneClass(t)" class="break-words" v-html="linkify(t.content)"></span>
                  <div v-if="t.attachments?.length" class="flex gap-1.5 flex-wrap mt-1.5">
                    <a v-for="att in t.attachments" :key="att.url"
                      :href="att.isPdf ? (att.pdfUrl ?? att.url) : undefined" :target="att.isPdf ? '_blank' : undefined">
                      <div v-if="att.isPdf" class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold hover:bg-red-200">PDF</div>
                      <img v-else :src="att.url" @click.prevent="openTaskPreview(t, att.url)" class="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80">
                    </a>
                  </div>
                  <div class="text-[10px] font-semibold mt-1" :style="`color:${personColor(t.createdBy)}`">{{ displayName(t) }} · {{ formatTime(t.createdAt) }}</div>
                  <div class="hidden group-hover:flex gap-1 mt-1 flex-wrap">
                    <button v-if="authStore.isManager" @click="tasksStore.toggleDone(props.caseId, t.id, !t.done, authStore.user?.email ?? '')"
                      class="text-[9px] bg-white border rounded px-1.5 py-0.5"
                      :class="t.done ? 'border-blue-200 text-blue-500 hover:text-blue-700' : 'border-gray-200 text-gray-500 hover:text-gray-700'">
                      {{ t.done ? '取消完成' : '✓ 完成' }}
                    </button>
                    <button v-if="authStore.user?.uid === t.createdBy" @click="startEdit(t)" class="text-[9px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:text-gray-700">編輯</button>
                    <button @click="remove(t.id)" class="text-[9px] bg-white border border-red-100 rounded px-1.5 py-0.5 text-red-400 hover:text-red-600">刪除</button>
                  </div>
                </template>
              </div>
            </div>
            <div v-if="clientTasks.length === 0" class="text-[11px] text-gray-300 py-2">尚無紀錄</div>
          </div>
        </div>

        <!-- 主管指示 -->
        <div class="p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-amber-600 pl-2 border-l-2 border-amber-400">主管指示</span>
              <span v-if="managerTasks.length" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{{ managerTasks.filter(t=>t.done).length }}/{{ managerTasks.length }}</span>
            </div>
            <button v-if="authStore.isManager" @click="openAdd('manager')" class="text-[11px] px-2.5 py-1 rounded-lg border border-amber-200 text-amber-500 hover:bg-amber-50">+ 新增</button>
          </div>
          <div class="flex flex-col gap-2">
            <div v-for="(t, idx) in managerTasks" :key="t.id"
              class="group relative flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs text-gray-700 leading-relaxed transition-opacity"
              :class="t.done ? 'bg-gray-50 opacity-50' : 'bg-amber-50'">
              <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                :class="t.done ? 'bg-gray-400' : 'bg-amber-500'">{{ idx + 1 }}</span>
              <div class="flex-1 min-w-0">
                <template v-if="editingId === t.id">
                  <textarea v-model="editContent" rows="2"
                    class="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 bg-white mb-2 resize-none"></textarea>
                  <div v-if="editExistingAttachments.length" class="flex gap-1.5 flex-wrap mb-2">
                    <div v-for="(att, i) in editExistingAttachments" :key="att.url" class="relative">
                      <div v-if="att.isPdf" class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
                      <img v-else :src="att.url" class="w-10 h-10 rounded object-cover">
                      <button @click="editExistingAttachments.splice(i,1)"
                        class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
                    </div>
                  </div>
                  <div v-if="editPendingFiles.length" class="flex gap-1.5 flex-wrap mb-2">
                    <div v-for="(f, i) in editPendingFiles" :key="i" class="relative">
                      <img v-if="f.preview" :src="f.preview" class="w-10 h-10 rounded object-cover">
                      <div v-else class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
                      <button @click="editPendingFiles.splice(i,1)"
                        class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
                    </div>
                  </div>
                  <div class="flex gap-2 justify-end items-center">
                    <button @click="editAttachInput.click()" class="text-[10px] text-gray-400 hover:text-gray-600">📎 附件</button>
                    <button @click="saveEdit(t.id)" class="text-[10px] text-white px-2.5 py-1 rounded-lg" style="background:#c9a96e">儲存</button>
                    <button @click="cancelEdit" class="text-[10px] text-gray-400 px-2 py-1">取消</button>
                  </div>
                </template>
                <template v-else>
                  <span :class="doneClass(t)" class="break-words" v-html="linkify(t.content)"></span>
                  <div v-if="t.attachments?.length" class="flex gap-1.5 flex-wrap mt-1.5">
                    <a v-for="att in t.attachments" :key="att.url"
                      :href="att.isPdf ? (att.pdfUrl ?? att.url) : undefined" :target="att.isPdf ? '_blank' : undefined">
                      <div v-if="att.isPdf" class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold hover:bg-red-200">PDF</div>
                      <img v-else :src="att.url" @click.prevent="openTaskPreview(t, att.url)" class="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80">
                    </a>
                  </div>
                  <div class="text-[10px] font-semibold mt-1" :style="`color:${personColor(t.createdBy)}`">{{ displayName(t) }} · {{ formatTime(t.createdAt) }}</div>
                  <div v-if="authStore.isManager" class="hidden group-hover:flex gap-1 mt-1 flex-wrap">
                    <button @click="tasksStore.toggleDone(props.caseId, t.id, !t.done, authStore.user?.email ?? '')"
                      class="text-[9px] bg-white border rounded px-1.5 py-0.5"
                      :class="t.done ? 'border-amber-200 text-amber-500 hover:text-amber-700' : 'border-gray-200 text-gray-500 hover:text-gray-700'">
                      {{ t.done ? '取消完成' : '✓ 完成' }}
                    </button>
                    <button v-if="authStore.user?.uid === t.createdBy" @click="startEdit(t)" class="text-[9px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:text-gray-700">編輯</button>
                    <button @click="remove(t.id)" class="text-[9px] bg-white border border-red-100 rounded px-1.5 py-0.5 text-red-400 hover:text-red-600">刪除</button>
                  </div>
                </template>
              </div>
            </div>
            <div v-if="managerTasks.length === 0" class="text-[11px] text-gray-300 py-2">尚無紀錄</div>
          </div>
        </div>
      </div>

      <!-- 人員回覆 -->
      <div class="p-4 border-t border-gray-100">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[11px] font-semibold text-green-600 uppercase tracking-wide">人員回覆</span>
          <button @click="openAdd('reply')" class="text-[11px] text-green-500 hover:text-green-700">+ 回覆</button>
        </div>
        <div class="flex flex-col gap-2">
          <div v-for="t in replyTasks" :key="t.id" class="flex items-start gap-2.5 group">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
              :style="`background:${personColor(t.createdBy)}`">
              {{ displayName(t)?.[0] ?? '?' }}
            </span>
            <div class="relative bg-green-50 rounded-xl px-3 py-2 flex-1 min-w-0 text-xs text-gray-700 leading-relaxed">
              <template v-if="editingId === t.id">
                <textarea v-model="editContent" rows="3" class="w-full text-xs border border-green-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 resize-none bg-white mb-2"></textarea>
                <div v-if="editExistingAttachments.length" class="flex gap-1.5 flex-wrap mb-2">
                  <div v-for="(att, i) in editExistingAttachments" :key="att.url" class="relative">
                    <div v-if="att.isPdf" class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
                    <img v-else :src="att.url" class="w-10 h-10 rounded object-cover">
                    <button @click="editExistingAttachments.splice(i,1)"
                      class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
                  </div>
                </div>
                <div v-if="editPendingFiles.length" class="flex gap-1.5 flex-wrap mb-2">
                  <div v-for="(f, i) in editPendingFiles" :key="i" class="relative">
                    <img v-if="f.preview" :src="f.preview" class="w-10 h-10 rounded object-cover">
                    <div v-else class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
                    <button @click="editPendingFiles.splice(i,1)"
                      class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
                  </div>
                </div>
                <div class="flex gap-2 justify-end items-center">
                  <button @click="editAttachInput.click()" class="text-[10px] text-gray-400 hover:text-gray-600">📎 附件</button>
                  <button @click="saveEdit(t.id)" class="text-[10px] text-white px-2.5 py-1 rounded-lg" style="background:#22c55e">儲存</button>
                  <button @click="cancelEdit" class="text-[10px] text-gray-400 px-2 py-1">取消</button>
                </div>
              </template>
              <template v-else>
                <span class="break-words" v-html="linkify(t.content)"></span>
                <div v-if="t.attachments?.length" class="flex gap-1.5 flex-wrap mt-1.5">
                  <a v-for="att in t.attachments" :key="att.url"
                    :href="att.isPdf ? (att.pdfUrl ?? att.url) : undefined" :target="att.isPdf ? '_blank' : undefined">
                    <div v-if="att.isPdf" class="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold hover:bg-red-200">PDF</div>
                    <img v-else :src="att.url" @click.prevent="openTaskPreview(t, att.url)" class="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80">
                  </a>
                </div>
                <div class="text-[10px] font-semibold mt-1" :style="`color:${personColor(t.createdBy)}`">{{ displayName(t) }} · {{ formatTime(t.createdAt) }}</div>
                <div class="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  <button v-if="authStore.user?.uid === t.createdBy" @click="startEdit(t)" class="text-[9px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:text-gray-700">編輯</button>
                  <button @click="remove(t.id)" class="text-[9px] bg-white border border-red-100 rounded px-1.5 py-0.5 text-red-400 hover:text-red-600">刪除</button>
                </div>
              </template>
            </div>
          </div>
          <div v-if="replyTasks.length === 0" class="text-[11px] text-gray-300 py-2">尚無回覆</div>
        </div>
      </div>
    </div>

    <!-- 新增 Modal -->
    <div v-if="showAdd" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-gray-800">
            {{ addType === 'client' ? '新增客戶需求' : addType === 'manager' ? '新增主管指示' : '新增回覆' }}
          </h3>
          <button @click="showAdd = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <textarea v-model="addContent" rows="3"
          :placeholder="addType === 'client' ? '輸入客戶需求或交辦事項…' : addType === 'manager' ? '輸入主管指示或要求…' : '輸入回覆內容…'"
          class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 mb-3 resize-none"></textarea>
        <!-- 附件 -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-gray-500">附件（選填）</span>
            <button @click="attachInput.click()" class="text-[11px]" style="color:#c9a96e">+ 選擇檔案</button>
          </div>
          <div v-if="pendingFiles.length" class="flex gap-2 flex-wrap">
            <div v-for="(f, i) in pendingFiles" :key="i" class="relative">
              <img v-if="f.preview" :src="f.preview" class="w-12 h-12 rounded object-cover">
              <div v-else class="w-12 h-12 rounded bg-red-100 flex items-center justify-center text-[9px] text-red-600 font-bold">PDF</div>
              <button @click="removePending(i)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center hover:bg-red-500">✕</button>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button @click="showAdd = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="submitAdd" :disabled="submitting"
            class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60"
            :style="addType === 'client' ? 'background:#3b82f6' : addType === 'manager' ? 'background:#c9a96e' : 'background:#22c55e'">
            {{ submitting ? '送出中…' : '送出' }}
          </button>
        </div>
      </div>
    </div>

    <input ref="attachInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleAttachFiles">
    <input ref="editAttachInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleEditAttachFiles">

    <div v-if="previewList.length > 0" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      @click.self="closePreview">
      <button v-if="previewIndex > 0" @click="navigatePreview(-1)"
        class="absolute left-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">‹</button>
      <img :src="previewList[previewIndex]" class="max-h-[80vh] max-w-[80vw] rounded-xl cursor-default">
      <button v-if="previewIndex < previewList.length - 1" @click="navigatePreview(1)"
        class="absolute right-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">›</button>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useCaseTasksStore } from '@/stores/caseTasks'
import { getWeekStart } from '@/utils/replyWeeks'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useNotificationsStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'

const props = defineProps({ caseId: String, caseName: String, companyId: { type: String, default: '' } })
const tasksStore = useCaseTasksStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()

const showAdd = ref(false)
const addType = ref('reply')
const addContent = ref('')
const submitting = ref(false)
const editingId = ref(null)
const editContent = ref('')
const editExistingAttachments = ref([])
const editPendingFiles = ref([])
const pendingFiles = ref([])
const attachInput = ref(null)
const editAttachInput = ref(null)
const previewList = ref([])
const previewIndex = ref(-1)

function openTaskPreview(task, clickedUrl) {
    const images = (task.attachments ?? []).filter(a => !a.isPdf).map(a => a.url)
    const idx = images.indexOf(clickedUrl)
    previewList.value = images
    previewIndex.value = idx >= 0 ? idx : 0
}

function closePreview() {
    previewList.value = []
    previewIndex.value = -1
}

function navigatePreview(dir) {
    const next = previewIndex.value + dir
    if (next >= 0 && next < previewList.value.length) previewIndex.value = next
}

function handleKeydown(e) {
    if (!previewList.value.length) return
    if (e.key === 'Escape') { closePreview(); return }
    if (e.key === 'ArrowRight') { e.preventDefault(); navigatePreview(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); navigatePreview(-1) }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

const clientTasks = computed(() => tasksStore.tasks.filter(t => t.type === 'client'))
const managerTasks = computed(() => tasksStore.tasks.filter(t => t.type === 'manager'))
const replyTasks = computed(() => tasksStore.tasks.filter(t => t.type === 'reply'))

const expandedWeeks = reactive({})
function toggleWeek(weekStart) {
    expandedWeeks[weekStart] = !expandedWeeks[weekStart]
}

function weekLabel(weekStart) {
    const [y, m, d] = weekStart.split('-').map(Number)
    const start = new Date(y, m - 1, d)
    const end = new Date(y, m - 1, d + 6)
    return `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`
}

const groupedReplies = computed(() => {
    const currentWeekStart = getWeekStart(new Date())
    const groups = new Map()
    groups.set(currentWeekStart, [])
    for (const t of replyTasks.value) {
        const key = getWeekStart(t.createdAt)
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(t)
    }
    return [...groups.keys()]
        .sort((a, b) => b.localeCompare(a))
        .map(weekStart => ({
            weekStart,
            isCurrent: weekStart === currentWeekStart,
            items: groups.get(weekStart),
        }))
})

const EMAIL_COLORS = {
    'dreambreaker24@gmail.com': '#c9a96e',
    'p8105000@gmail.com': '#1f2937',
    'daydream54321@gmail.com': '#ef4444',
}
const FALLBACK_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899']

function personColor(uid) {
    if (!uid) return '#6b7280'
    const user = usersStore.users.find(u => u.id === uid)
    if (user?.email && EMAIL_COLORS[user.email]) return EMAIL_COLORS[user.email]
    return FALLBACK_COLORS[(uid.charCodeAt(0) + (uid.charCodeAt(uid.length - 1) ?? 0)) % FALLBACK_COLORS.length]
}

function displayName(task) {
    if (task.createdBy) {
        const user = usersStore.users.find(u => u.id === task.createdBy)
        if (user?.name) return user.name
    }
    return task.creatorName ?? ''
}

function linkify(text) {
    if (!text) return ''
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    const linked = escaped.replace(/(https?:\/\/[^\s<>"&]+)/g,
        url => `<a href="${url}" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:underline;word-break:break-all">${url}</a>`
    )
    return linked.replace(/\n/g, '<br>')
}

const DONE_COLORS = {
    'dreambreaker24@gmail.com': 'line-through text-amber-500',
    'daydream54321@gmail.com':  'line-through text-red-500',
    'p8105000@gmail.com':       'line-through text-gray-900',
}
function doneClass(task) {
    if (!task.done) return ''
    return DONE_COLORS[task.doneByEmail] ?? 'line-through text-gray-400'
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth()+1}/${d.getDate()}（週${WEEKDAYS[d.getDay()]}）${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function openAdd(type) {
    addType.value = type
    addContent.value = ''
    pendingFiles.value = []
    showAdd.value = true
}

function handleAttachFiles(e) {
    Array.from(e.target.files).forEach(file => {
        if (validateUploadFile(file)) { toast(validateUploadFile(file), 'error'); return }
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        pendingFiles.value.push({ file, preview: isPdf ? null : URL.createObjectURL(file) })
    })
    e.target.value = ''
}

function handleEditAttachFiles(e) {
    Array.from(e.target.files).forEach(file => {
        if (validateUploadFile(file)) { toast(validateUploadFile(file), 'error'); return }
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        editPendingFiles.value.push({ file, preview: isPdf ? null : URL.createObjectURL(file) })
    })
    e.target.value = ''
}

function removePending(i) { pendingFiles.value.splice(i, 1) }

function startEdit(task) {
    editingId.value = task.id
    editContent.value = task.content
    editExistingAttachments.value = [...(task.attachments ?? [])]
    editPendingFiles.value = []
}

function cancelEdit() {
    editingId.value = null
    editExistingAttachments.value = []
    editPendingFiles.value = []
}

async function saveEdit(taskId) {
    if (!editContent.value.trim()) return
    try {
        const newAttachments = []
        for (const pf of editPendingFiles.value) {
            try {
                const url = await uploadPhoto(pf.file, 'task')
                const isPdf = pf.file.name.toLowerCase().endsWith('.pdf')
                const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
                newAttachments.push({ url, isPdf, pdfUrl })
            } catch { /* skip failed */ }
        }
        const allAttachments = [...editExistingAttachments.value, ...newAttachments]
        await tasksStore.updateTask(props.caseId, taskId, editContent.value.trim(), allAttachments)
        cancelEdit()
    } catch {
        toast('修改失敗，請重試', 'error')
    }
}

async function remove(taskId) {
    try { await tasksStore.deleteTask(props.caseId, taskId) }
    catch { toast('刪除失敗，請重試', 'error') }
}

async function submitAdd() {
    if (!addContent.value.trim() || submitting.value) return
    submitting.value = true
    try {
        const attachments = []
        for (const pf of pendingFiles.value) {
            try {
                const url = await uploadPhoto(pf.file, 'task')
                const isPdf = pf.file.name.toLowerCase().endsWith('.pdf')
                const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
                attachments.push({ url, isPdf, pdfUrl })
            } catch { /* skip failed */ }
        }
        const taskContent = addContent.value.trim()
        await tasksStore.addTask(props.caseId, addType.value, taskContent, authStore.name ?? '', authStore.user?.uid ?? '', attachments)
        const taskTypeLabels = { client: '客戶需求', manager: '主管指示', reply: '人員回覆' }
        const taskTypeLabel = taskTypeLabels[addType.value] ?? addType.value
        const preview = taskContent.length > 20 ? taskContent.slice(0, 20) + '…' : taskContent
        notifStore.notifyAll(authStore.name ?? '', `在「${props.caseName}」交辦事項 › ${taskTypeLabel} 新增了「${preview}」`, props.caseId, props.caseName, props.companyId, '', 'tasks')
        addContent.value = ''
        pendingFiles.value = []
        showAdd.value = false
        toast('已送出')
    } finally {
        submitting.value = false
    }
}
</script>
