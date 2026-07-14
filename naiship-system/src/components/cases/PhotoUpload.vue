<template>
  <div class="px-4 py-4 border-t border-gray-100 bg-gray-50">
    <div class="text-xs font-semibold text-gray-600 mb-3 pl-2 border-l-2" style="border-left-color:#c9a96e">{{ caseName }} — 檔案管理</div>

    <div class="flex flex-col gap-1">
      <div v-for="type in photoTypes" :key="type.key"
        :id="'photo-type-' + type.key"
        class="rounded-xl overflow-hidden"
        :class="hovering === type.key ? 'ring-1 ring-amber-300' : ''">

        <!-- Type header -->
        <div class="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-xl transition-colors"
          :class="expanded[type.key] ? 'bg-white shadow-sm' : (typePhotoCount(type.key) ? 'bg-white/60 hover:bg-white' : 'hover:bg-white/50')"
          @click="toggle(type.key)"
          @dragover.prevent="hovering = type.key"
          @dragleave="hovering = ''"
          @drop.prevent="handleDrop($event, type.key)">
          <span class="text-[10px] text-gray-400 w-3 flex-shrink-0">{{ expanded[type.key] ? '▼' : '▶' }}</span>
          <span class="text-sm">{{ type.icon }}</span>
          <span class="text-xs font-medium text-gray-700">{{ type.label }}</span>
          <span v-if="typePhotoCount(type.key)"
            class="text-[9px] min-w-[18px] h-[18px] px-1 rounded-full text-white leading-[18px] text-center font-bold" style="background:#c9a96e">
            {{ typePhotoCount(type.key) }}
          </span>
          <div class="ml-auto flex items-center gap-1.5" @click.stop>
            <button @click="openFolderForm(type.key)"
              class="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
              + 資料夾
            </button>
            <button @click="triggerUpload(type.key)"
              class="text-[10px] px-2.5 py-1 rounded-lg border transition-colors font-medium"
              :style="hovering === type.key ? 'border-color:#c9a96e;color:#c9a96e;background:rgba(201,169,110,0.08)' : 'border-color:#e5e7eb;color:#9ca3af'">
              + 上傳
            </button>
          </div>
        </div>

        <!-- Expanded content -->
        <div v-if="expanded[type.key]" class="bg-white rounded-b-xl pb-2">

          <!-- Case A: has folders → grouped display -->
          <template v-if="foldersForType(type.key).length">
            <div v-for="folder in foldersForType(type.key)" :key="folder.id"
              class="border-t border-gray-50">
              <!-- Folder header -->
              <div class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50/60 transition-colors"
                @click="toggleFolder(folder.id)">
                <span class="text-[10px] text-gray-300">{{ folderExpanded[folder.id] === true ? '▼' : '▶' }}</span>
                <span class="text-[11px] font-semibold text-gray-700">📁 {{ folder.label }}</span>
                <span v-if="photosInFolder(type.key, folder.id).length"
                  class="text-[9px] min-w-[16px] h-4 px-1 rounded-full bg-gray-100 text-gray-500 leading-4 text-center">
                  {{ photosInFolder(type.key, folder.id).length }}
                </span>
                <div class="ml-auto flex items-center gap-1" @click.stop>
                  <button @click="uploadToFolder(type.key, folder.id)"
                    class="text-[9px] px-1.5 py-0.5 border border-dashed border-gray-200 rounded text-gray-400 hover:border-amber-300 hover:text-amber-600 transition-colors">
                    + 上傳
                  </button>
                  <button @click="editFolder(folder)"
                    class="text-[9px] px-1.5 py-0.5 text-gray-400 hover:text-gray-700 transition-colors">編輯</button>
                  <button @click="deleteFolder(folder.id)"
                    class="text-[9px] px-1.5 py-0.5 text-red-300 hover:text-red-500 transition-colors">刪除</button>
                </div>
              </div>
              <!-- Folder description -->
              <div v-if="folder.description && folderExpanded[folder.id] === true"
                class="text-[10px] text-gray-400 px-9 pb-1">{{ folder.description }}</div>
              <!-- Folder photos -->
              <div v-if="folderExpanded[folder.id] === true" class="px-3 pb-2">
                <div v-if="!photosInFolder(type.key, folder.id).length" class="text-[10px] text-gray-300 py-1.5 text-center">此資料夾尚無照片</div>
                <div v-else class="flex gap-2 overflow-x-auto pb-1">
                  <div v-for="item in photosInFolder(type.key, folder.id)" :key="item.id"
                    class="flex-shrink-0 flex flex-col items-center gap-1 relative group">
                    <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                      class="w-20 h-20 rounded-xl bg-red-100 flex items-center justify-center text-xs text-red-600 font-bold hover:bg-red-200 transition-colors shadow-sm">PDF</a>
                    <img v-else :src="item.url"
                      class="w-20 h-20 rounded-xl object-cover cursor-pointer hover:opacity-90 shadow-sm hover:shadow-md transition-all"
                      @click="openPreview(type.key, item)">
                    <span class="text-[9px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                    <button @click="deletePhoto(type.key, item)"
                      class="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 text-white rounded-full text-[9px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10 shadow">✕</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Unfiled section -->
            <div class="border-t border-gray-50">
              <div class="flex items-center gap-2 px-3 py-1.5">
                <span class="text-[11px] text-gray-400 font-medium">未分類</span>
                <span v-if="photosInFolder(type.key, null).length"
                  class="text-[9px] min-w-[16px] h-4 px-1 rounded-full bg-gray-100 text-gray-400 leading-4 text-center">
                  {{ photosInFolder(type.key, null).length }}
                </span>
              </div>
              <div class="px-3 pb-2">
                <div v-if="!photosInFolder(type.key, null).length" class="text-[10px] text-gray-300 py-1 text-center">—</div>
                <div v-else class="flex gap-2 overflow-x-auto pb-1">
                  <div v-for="item in photosInFolder(type.key, null)" :key="item.id"
                    class="flex-shrink-0 flex flex-col items-center gap-1 relative group">
                    <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                      class="w-20 h-20 rounded-xl bg-red-100 flex items-center justify-center text-xs text-red-600 font-bold hover:bg-red-200 transition-colors shadow-sm">PDF</a>
                    <img v-else :src="item.url"
                      class="w-20 h-20 rounded-xl object-cover cursor-pointer hover:opacity-90 shadow-sm hover:shadow-md transition-all"
                      @click="openPreview(type.key, item)">
                    <span class="text-[9px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                    <button @click="deletePhoto(type.key, item)"
                      class="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 text-white rounded-full text-[9px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10 shadow">✕</button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Case B: no folders → flat display (original behavior) -->
          <template v-else>
            <div class="px-3 pb-3 pt-1">
              <div v-if="!typePhotoCount(type.key)" class="text-[11px] text-gray-300 py-2 text-center">尚無檔案，拖曳或點擊上傳</div>
              <div v-else class="flex gap-2.5 overflow-x-auto pb-1">
                <div v-for="item in photos[type.key]" :key="item.id"
                  class="flex-shrink-0 flex flex-col items-center gap-1 relative group">
                  <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                    class="w-20 h-20 rounded-xl bg-red-100 flex items-center justify-center text-xs text-red-600 font-bold hover:bg-red-200 transition-colors shadow-sm">PDF</a>
                  <img v-else :src="item.url"
                    class="w-20 h-20 rounded-xl object-cover cursor-pointer hover:opacity-90 shadow-sm hover:shadow-md transition-all"
                    @click="openPreview(type.key, item)">
                  <span class="text-[9px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                  <button @click="deletePhoto(type.key, item)"
                    class="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 text-white rounded-full text-[9px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10 shadow">✕</button>
                </div>
              </div>
            </div>
          </template>

        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleFiles">

    <div v-if="uploadError" class="mt-2 text-xs text-red-500 flex items-center gap-1">
      <span>{{ uploadError }}</span>
      <button @click="uploadError = ''" class="ml-1 text-red-400 hover:text-red-600">✕</button>
    </div>

    <!-- Folder picker modal -->
    <div v-if="showFolderPicker" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl p-5 w-72 mx-4 border-t-4" style="border-top-color:#c9a96e">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-gray-800">選擇上傳位置</h3>
          <button @click="showFolderPicker = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="radio" v-model="pendingFolderId" :value="null" class="accent-amber-600">
            <span class="text-sm text-gray-700">📂 不分類</span>
          </label>
          <label v-for="folder in foldersForType(pickerType)" :key="folder.id"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="radio" v-model="pendingFolderId" :value="folder.id" class="accent-amber-600">
            <div>
              <div class="text-sm text-gray-700">📁 {{ folder.label }}</div>
              <div v-if="folder.description" class="text-[10px] text-gray-400">{{ folder.description }}</div>
            </div>
          </label>
        </div>
        <button @click="openFolderFormFromPicker"
          class="mt-3 w-full text-[11px] border border-dashed border-gray-200 rounded-lg py-1.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
          + 新增資料夾
        </button>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showFolderPicker = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="confirmPicker" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">確認上傳</button>
        </div>
      </div>
    </div>

    <!-- Folder create/edit modal -->
    <div v-if="showFolderForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl p-5 w-80 mx-4 border-t-4" style="border-top-color:#c9a96e">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-gray-800">{{ editingFolderId ? '編輯資料夾' : '新增資料夾' }}</h3>
          <button @click="closeFolderForm" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div class="flex flex-col gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">資料夾名稱 *</label>
            <input v-model="folderForm.label" type="text"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
              placeholder="例：客廳、主臥、浴室…">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">說明（選填）</label>
            <input v-model="folderForm.description" type="text"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
              placeholder="備註說明…">
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button @click="closeFolderForm" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="saveFolder" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">儲存</button>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <div v-if="previewUrl" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      @click.self="previewUrl = null">
      <button v-if="previewIndex > 0" @click="navigatePhoto(-1)"
        class="absolute left-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">‹</button>
      <img :src="previewUrl" class="max-h-[80vh] max-w-[80vw] rounded-xl cursor-default">
      <button v-if="previewIndex < previewList.length - 1" @click="navigatePhoto(1)"
        class="absolute right-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">›</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useCasesStore } from '@/stores/cases'
import { useNavStore } from '@/stores/nav'
import { useUsersStore } from '@/stores/users'

const props = defineProps({ caseId: String, caseName: String, companyId: { type: String, default: '' } })
const navStore = useNavStore()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const casesStore = useCasesStore()
const usersStore = useUsersStore()

const photoTypes = [
    { key: 'survey',     label: '場勘',     icon: '📷' },
    { key: 'contract',   label: '合約',     icon: '📄' },
    { key: '3d',         label: '3D 模擬',  icon: '🎨' },
    { key: 'floorplan',  label: '平面圖',   icon: '📐' },
    { key: 'blueprint',  label: '施工圖',   icon: '📋' },
    { key: 'completion', label: '驗收檢查', icon: '✅' },
    { key: 'commercial', label: '商業攝影', icon: '🌟' },
]

const allKeys = photoTypes.map(t => t.key)
const photos = reactive(Object.fromEntries(allKeys.map(k => [k, []])))
const expanded = reactive(Object.fromEntries(allKeys.map(k => [k, false])))
const folderExpanded = reactive({})

const fileInput = ref(null)
const activeType = ref('')
const activeFolderId = ref(null)
const hovering = ref('')
const uploadError = ref('')

// Lightbox
const previewUrl = ref(null)
const previewType = ref('')
const previewIndex = ref(-1)
const previewList = computed(() => (photos[previewType.value] || []).filter(p => !p.isPdf))

// Folders (stored in case document)
const caseData = computed(() => casesStore.cases.find(c => c.id === props.caseId))
const photoFolders = computed(() => caseData.value?.photoFolders ?? [])

const showFolderForm = ref(false)
const folderFormType = ref('')
const editingFolderId = ref(null)
const folderForm = ref({ label: '', description: '' })
const fromPicker = ref(false)

const showFolderPicker = ref(false)
const pickerType = ref('')
const pendingFolderId = ref(null)

function foldersForType(typeKey) {
    return photoFolders.value.filter(f => f.type === typeKey)
}

function photosInFolder(typeKey, folderId) {
    const validIds = new Set(photoFolders.value.map(f => f.id))
    return (photos[typeKey] || []).filter(p => {
        const eff = p.folderId && validIds.has(p.folderId) ? p.folderId : null
        return folderId === null ? eff === null : eff === folderId
    })
}

function typePhotoCount(typeKey) {
    return (photos[typeKey] || []).length
}

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function uploaderName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? '未知'
}

function toggle(key) { expanded[key] = !expanded[key] }

function toggleFolder(folderId) {
    folderExpanded[folderId] = folderExpanded[folderId] === false ? true : false
}

function openPreview(typeKey, item) {
    const list = (photos[typeKey] || []).filter(p => !p.isPdf)
    previewType.value = typeKey
    previewIndex.value = list.findIndex(p => p === item)
    previewUrl.value = item.url
}

function navigatePhoto(dir) {
    const next = previewIndex.value + dir
    if (next >= 0 && next < previewList.value.length) {
        previewIndex.value = next
        previewUrl.value = previewList.value[next].url
    }
}

function handleKeydown(e) {
    if (!previewUrl.value) return
    if (e.key === 'Escape') { previewUrl.value = null; return }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); navigatePhoto(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navigatePhoto(-1) }
}

onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

onMounted(async () => {
    window.addEventListener('keydown', handleKeydown)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, folderId, createdAt, uploadedBy } = d.data()
        const resolvedType = type === 'construction' ? 'survey' : type
        if (photos[resolvedType] !== undefined) {
            const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
            const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            photos[resolvedType].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, folderId: folderId ?? null, createdAt, uploadedBy })
        }
    })
    const jumpType = navStore.pendingPhotoType
    if (jumpType && photos[jumpType] !== undefined) {
        expanded[jumpType] = true
        navStore.clearPhotoType()
        nextTick(() => {
            document.getElementById('photo-type-' + jumpType)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
    }
})

// Folder CRUD
function openFolderForm(typeKey) {
    folderFormType.value = typeKey
    editingFolderId.value = null
    folderForm.value = { label: '', description: '' }
    fromPicker.value = false
    showFolderForm.value = true
}

function openFolderFormFromPicker() {
    showFolderPicker.value = false
    folderFormType.value = pickerType.value
    editingFolderId.value = null
    folderForm.value = { label: '', description: '' }
    fromPicker.value = true
    showFolderForm.value = true
}

function editFolder(folder) {
    folderFormType.value = folder.type
    editingFolderId.value = folder.id
    folderForm.value = { label: folder.label, description: folder.description || '' }
    fromPicker.value = false
    showFolderForm.value = true
}

function closeFolderForm() {
    showFolderForm.value = false
    if (fromPicker.value) { fromPicker.value = false; showFolderPicker.value = true }
}

async function saveFolder() {
    if (!folderForm.value.label.trim()) return
    const folders = [...photoFolders.value]
    let newId = null
    if (editingFolderId.value) {
        const idx = folders.findIndex(f => f.id === editingFolderId.value)
        if (idx >= 0) folders[idx] = { ...folders[idx], label: folderForm.value.label.trim(), description: folderForm.value.description.trim() }
    } else {
        newId = `pf_${Date.now()}`
        folders.push({ id: newId, type: folderFormType.value, label: folderForm.value.label.trim(), description: folderForm.value.description.trim() })
    }
    await casesStore.updateCase(props.caseId, { photoFolders: folders })
    showFolderForm.value = false
    if (fromPicker.value) {
        fromPicker.value = false
        if (newId) pendingFolderId.value = newId
        showFolderPicker.value = true
    }
}

async function deleteFolder(folderId) {
    if (!confirm('確定刪除此資料夾？照片將移至未分類。')) return
    const folders = photoFolders.value.filter(f => f.id !== folderId)
    await casesStore.updateCase(props.caseId, { photoFolders: folders })
}

// Upload flow
function triggerUpload(typeKey) {
    activeType.value = typeKey
    if (foldersForType(typeKey).length > 0) {
        pickerType.value = typeKey
        pendingFolderId.value = null
        showFolderPicker.value = true
    } else {
        activeFolderId.value = null
        fileInput.value.click()
    }
}

function uploadToFolder(typeKey, folderId) {
    activeType.value = typeKey
    activeFolderId.value = folderId
    fileInput.value.click()
}

function confirmPicker() {
    activeFolderId.value = pendingFolderId.value
    showFolderPicker.value = false
    fileInput.value.click()
}

async function uploadFiles(files, typeKey, folderId) {
    uploadError.value = ''
    let uploaded = 0
    for (const file of files) {
        const err = validateUploadFile(file)
        if (err) { uploadError.value = err; continue }
        try {
            const url = await uploadPhoto(file, typeKey)
            const isPdf = file.name.toLowerCase().endsWith('.pdf')
            const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            const docData = {
                type: typeKey, url, isPdf,
                folderId: folderId ?? null,
                uploadedBy: authStore.user?.uid ?? 'unknown',
                createdAt: serverTimestamp(),
            }
            if (props.caseId) {
                const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), docData)
                photos[typeKey].push({ id: docRef.id, url, isPdf, pdfUrl, folderId: folderId ?? null, createdAt: { toDate: () => new Date() }, uploadedBy: docData.uploadedBy })
            } else {
                photos[typeKey].push({ id: null, url, isPdf, pdfUrl, folderId: folderId ?? null, createdAt: { toDate: () => new Date() }, uploadedBy: docData.uploadedBy })
            }
            expanded[typeKey] = true
            uploaded++
        } catch (err) {
            uploadError.value = `「${file.name}」上傳失敗：${err.message}`
        }
    }
    if (uploaded > 0) {
        const typeLabel = photoTypes.find(t => t.key === typeKey)?.label ?? typeKey
        const folder = folderId ? foldersForType(typeKey).find(f => f.id === folderId) : null
        const path = folder ? `${typeLabel} › ${folder.label}` : typeLabel
        const msg = `在「${props.caseName}」檔案管理 › ${path} 上傳了 ${uploaded} 個檔案`
        notifStore.notifyAll(authStore.name ?? '', msg, props.caseId, props.caseName, props.companyId, '', 'photo', '', false, typeKey)
    }
}

async function handleFiles(e) {
    await uploadFiles(Array.from(e.target.files), activeType.value, activeFolderId.value)
    e.target.value = ''
}

async function handleDrop(e, typeKey) {
    hovering.value = ''
    await uploadFiles(Array.from(e.dataTransfer.files), typeKey, null)
}

async function deletePhoto(typeKey, item) {
    if (item.id && props.caseId) {
        await deleteDoc(doc(db, 'cases', props.caseId, 'photos', item.id))
    }
    photos[typeKey] = photos[typeKey].filter(p => p !== item)
}
</script>
