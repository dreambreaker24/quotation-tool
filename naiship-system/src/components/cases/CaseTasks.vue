<template>
  <div class="border-t border-gray-200 bg-white">
    <!-- Header -->
    <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
      <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
      <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">待辦事項</span>
    </div>

    <div class="flex flex-col gap-0">
      <!-- 客戶需求 + 主管指示 (side by side) -->
      <div class="grid grid-cols-2 divide-x divide-gray-100">
        <!-- 客戶需求 -->
        <div class="p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">客戶需求</span>
            <button @click="openAdd('client')" class="text-[11px] text-blue-500 hover:text-blue-700">+ 新增</button>
          </div>
          <div class="flex flex-col gap-2">
            <div v-for="t in clientTasks" :key="t.id" class="group relative bg-blue-50 rounded-xl px-3 py-2.5 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              <template v-if="editingId === t.id">
                <textarea v-model="editContent" rows="3"
                  class="w-full text-xs border border-blue-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 resize-none bg-white mb-2"></textarea>
                <div class="flex gap-2 justify-end">
                  <button @click="saveEdit(t.id)" class="text-[10px] text-white px-2.5 py-1 rounded-lg" style="background:#3b82f6">儲存</button>
                  <button @click="editingId = null" class="text-[10px] text-gray-400 px-2 py-1">取消</button>
                </div>
              </template>
              <template v-else>
                {{ t.content }}
                <div class="text-[10px] text-blue-400 mt-1">{{ t.creatorName }} · {{ formatTime(t.createdAt) }}</div>
                <div class="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  <button @click="startEdit(t)" class="text-[9px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:text-gray-700">編輯</button>
                  <button @click="remove(t.id)" class="text-[9px] bg-white border border-red-100 rounded px-1.5 py-0.5 text-red-400 hover:text-red-600">刪除</button>
                </div>
              </template>
            </div>
            <div v-if="clientTasks.length === 0" class="text-[11px] text-gray-300 py-2">尚無紀錄</div>
          </div>
        </div>

        <!-- 主管指示 -->
        <div class="p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">主管指示</span>
            <button v-if="authStore.isManager" @click="openAdd('manager')"
              class="text-[11px] text-amber-500 hover:text-amber-700">+ 新增</button>
          </div>
          <div class="flex flex-col gap-2">
            <div v-for="t in managerTasks" :key="t.id" class="group relative bg-amber-50 rounded-xl px-3 py-2.5 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              <template v-if="editingId === t.id">
                <textarea v-model="editContent" rows="3"
                  class="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 resize-none bg-white mb-2"></textarea>
                <div class="flex gap-2 justify-end">
                  <button @click="saveEdit(t.id)" class="text-[10px] text-white px-2.5 py-1 rounded-lg" style="background:#c9a96e">儲存</button>
                  <button @click="editingId = null" class="text-[10px] text-gray-400 px-2 py-1">取消</button>
                </div>
              </template>
              <template v-else>
                {{ t.content }}
                <div class="text-[10px] text-amber-400 mt-1">{{ t.creatorName }} · {{ formatTime(t.createdAt) }}</div>
                <div v-if="authStore.isManager" class="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  <button @click="startEdit(t)" class="text-[9px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:text-gray-700">編輯</button>
                  <button @click="remove(t.id)" class="text-[9px] bg-white border border-red-100 rounded px-1.5 py-0.5 text-red-400 hover:text-red-600">刪除</button>
                </div>
              </template>
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
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              :style="`background:${empColor(t.createdBy)}`">
              {{ t.creatorName?.[0] ?? '?' }}
            </span>
            <div class="relative bg-green-50 rounded-xl px-3 py-2 flex-1 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              <template v-if="editingId === t.id">
                <textarea v-model="editContent" rows="3"
                  class="w-full text-xs border border-green-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 resize-none bg-white mb-2"></textarea>
                <div class="flex gap-2 justify-end">
                  <button @click="saveEdit(t.id)" class="text-[10px] text-white px-2.5 py-1 rounded-lg" style="background:#22c55e">儲存</button>
                  <button @click="editingId = null" class="text-[10px] text-gray-400 px-2 py-1">取消</button>
                </div>
              </template>
              <template v-else>
                {{ t.content }}
                <div class="text-[10px] text-green-400 mt-1">{{ t.creatorName }} · {{ formatTime(t.createdAt) }}</div>
                <div class="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  <button @click="startEdit(t)" class="text-[9px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:text-gray-700">編輯</button>
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
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-gray-800">
            {{ addType === 'client' ? '新增客戶需求' : addType === 'manager' ? '新增主管指示' : '新增回覆' }}
          </h3>
          <button @click="showAdd = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <textarea v-model="addContent" rows="4"
          :placeholder="addType === 'client' ? '輸入客戶需求或交辦事項…' : addType === 'manager' ? '輸入主管指示或要求…' : '輸入回覆內容…'"
          class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 resize-none">
        </textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showAdd = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="submitAdd" :disabled="submitting"
            class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60"
            :style="addType === 'client' ? 'background:#3b82f6' : addType === 'manager' ? 'background:#c9a96e' : 'background:#22c55e'">
            {{ submitting ? '送出中…' : '送出' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useCaseTasksStore } from '@/stores/caseTasks'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const props = defineProps({ caseId: String, caseName: String })
const tasksStore = useCaseTasksStore()
const authStore = useAuthStore()
const { toast } = useToast()

const showAdd = ref(false)
const addType = ref('reply')
const addContent = ref('')
const submitting = ref(false)
const editingId = ref(null)
const editContent = ref('')

const clientTasks = computed(() => tasksStore.tasks.filter(t => t.type === 'client'))
const managerTasks = computed(() => tasksStore.tasks.filter(t => t.type === 'manager'))
const replyTasks = computed(() => tasksStore.tasks.filter(t => t.type === 'reply'))

const empColors = ['#c9a96e','#a855f7','#3b82f6','#22c55e','#f59e0b','#ef4444']
function empColor(uid) { return empColors[(uid?.charCodeAt(0) ?? 0) % empColors.length] }

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function openAdd(type) {
    addType.value = type
    addContent.value = ''
    showAdd.value = true
}

function startEdit(task) {
    editingId.value = task.id
    editContent.value = task.content
}

async function saveEdit(taskId) {
    if (!editContent.value.trim()) return
    try {
        await tasksStore.updateTask(props.caseId, taskId, editContent.value.trim())
        editingId.value = null
    } catch {
        toast('修改失敗，請重試', 'error')
    }
}

async function remove(taskId) {
    try {
        await tasksStore.deleteTask(props.caseId, taskId)
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}

async function submitAdd() {
    if (!addContent.value.trim() || submitting.value) return
    submitting.value = true
    try {
        await tasksStore.addTask(props.caseId, addType.value, addContent.value.trim(), authStore.name ?? '', authStore.user?.uid ?? '')
        addContent.value = ''
        showAdd.value = false
        toast('已送出')
    } finally {
        submitting.value = false
    }
}
</script>
