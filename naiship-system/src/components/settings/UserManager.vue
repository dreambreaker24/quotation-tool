<template>
  <div class="bg-white rounded-2xl shadow-md p-6">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#c9a96e">帳號管理</h2>
      <button @click="showForm = !showForm" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">+ 新增帳號</button>
    </div>

    <!-- Add account form -->
    <div v-if="showForm" class="bg-gray-50 rounded-xl p-4 mb-5">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">姓名</label>
          <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">Google Email</label>
          <input v-model="form.email" type="email" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">角色</label>
          <select v-model="form.role" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 bg-white">
            <option value="admin">管理者</option>
            <option value="manager">區域主管</option>
            <option value="employee">員工</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">所屬分區</label>
          <select v-model="form.companyId" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 bg-white">
            <option value="south">奈拾南區</option>
            <option value="north">奈拾北區</option>
            <option value="central">奈拾中區</option>
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-3">
        <button @click="showForm = false" class="text-xs text-gray-400 px-3 py-1">取消</button>
        <button @click="createUser" class="text-xs text-white px-3 py-1.5 rounded-lg" style="background:#1e2533">建立帳號</button>
      </div>
    </div>

    <!-- Users table -->
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-gray-100">
          <th class="text-left px-4 py-2.5 text-gray-600 font-semibold text-xs">姓名</th>
          <th class="text-left px-4 py-2.5 text-gray-600 font-semibold text-xs">Email</th>
          <th class="text-left px-4 py-2.5 text-gray-600 font-semibold text-xs">角色</th>
          <th class="text-left px-4 py-2.5 text-gray-600 font-semibold text-xs">分區</th>
          <th class="px-4 py-2.5"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id" class="border-t border-gray-100 hover:bg-amber-50/40 transition-colors">
          <td class="px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                :style="`background:${empColor(u.name)}`">{{ u.name?.[0] ?? '?' }}</span>
              <span class="font-medium text-gray-800">{{ u.name }}</span>
            </div>
          </td>
          <td class="px-4 py-2.5 text-gray-500 text-xs">{{ u.email }}</td>
          <td class="px-4 py-2.5">
            <span class="text-xs px-2 py-0.5 rounded-full" :class="roleClass(u.role)" :style="roleStyle(u.role)">{{ roleLabel(u.role) }}</span>
          </td>
          <td class="px-4 py-2.5 text-gray-500 text-xs">{{ regionLabel(u.companyId) }}</td>
          <td class="px-4 py-2.5 text-right flex items-center justify-end gap-3">
            <button @click="removeUser(u.id)" class="text-xs text-gray-400 hover:text-gray-600">停用</button>
            <button @click="deleteUser(u.id)" class="text-xs text-red-400 hover:text-red-600">刪除</button>
          </td>
        </tr>
        <tr v-if="users.length === 0">
          <td colspan="5" class="px-4 py-6 text-center text-gray-400 text-xs">尚無帳號資料</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const users = ref([])
const showForm = ref(false)
const form = ref({ name: '', email: '', role: 'employee', companyId: 'south' })

const roleMap = { admin: '管理者', manager: '區域主管', employee: '員工' }
const roleClassMap = {
    admin: 'text-white',
    manager: 'bg-amber-100 text-amber-700',
    employee: 'bg-gray-100 text-gray-600'
}
const roleStyleMap = {
    admin: 'background:#1e2533',
    manager: '',
    employee: ''
}
function roleStyle(r) { return roleStyleMap[r] ?? '' }
const regionMap = { south: '奈拾南區', north: '奈拾北區', central: '奈拾中區' }

function roleLabel(r) { return roleMap[r] ?? r }
function roleClass(r) { return roleClassMap[r] ?? '' }
function regionLabel(c) { return regionMap[c] ?? c }

const MEMBER_COLORS = { '柏': '#c9a96e', '其宏': '#1f2937', '阿蚌': '#ef4444' }
function empColor(name) {
    if (!name) return '#9ca3af'
    if (MEMBER_COLORS[name]) return MEMBER_COLORS[name]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
    const fallback = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#14b8a6', '#f97316']
    return fallback[hash % fallback.length]
}

async function loadUsers() {
    const snap = await getDocs(collection(db, 'users'))
    users.value = snap.docs.filter(d => !d.data().disabled).map(d => ({ id: d.id, ...d.data() }))
}

async function createUser() {
    if (!form.value.name || !form.value.email) return
    await addDoc(collection(db, 'users'), { ...form.value, createdAt: serverTimestamp() })
    form.value = { name: '', email: '', role: 'employee', companyId: 'south' }
    showForm.value = false
    await loadUsers()
}

async function removeUser(id) {
    const u = users.value.find(u => u.id === id)
    if (!confirm(`確定要停用「${u?.name ?? '此帳號'}」？`)) return
    await updateDoc(doc(db, 'users', id), { disabled: true })
    await loadUsers()
}

async function deleteUser(id) {
    const u = users.value.find(u => u.id === id)
    if (!confirm(`確定要永久刪除「${u?.name ?? '此帳號'}」？此操作無法復原。`)) return
    await deleteDoc(doc(db, 'users', id))
    await loadUsers()
}

onMounted(loadUsers)
</script>
