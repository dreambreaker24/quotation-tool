<template>
  <CompensatoryPanel />
  <div class="bg-white rounded-2xl shadow-md overflow-hidden">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gray-100">
      <div class="flex items-center gap-3">
        <button @click="prevMonth" class="text-gray-400 hover:text-gray-700 px-2">◀</button>
        <span class="font-semibold text-gray-800">{{ displayMonth }}</span>
        <button @click="nextMonth" class="text-gray-400 hover:text-gray-700 px-2">▶</button>
        <button @click="goToToday"
          class="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors ml-1">今天</button>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px]">
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background:#ffe4e6;border:1px solid #fda4af"></span>假日</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-red-400"></span>重要記事</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background:#0d9488"></span>場勘/施工</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-blue-400"></span>員工請假</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background:#a855f7"></span>客戶跟進</div>
        <button @click="showAddEvent = true" class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:border-gray-400">+ 新增</button>
      </div>
    </div>

    <!-- Status counters -->
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 p-3 sm:p-4 border-b border-gray-100 bg-gray-50/50">
      <div v-for="s in statuses" :key="s.key"
        class="bg-white rounded-xl px-3 py-3 shadow-sm text-center border-t-2"
        :style="`border-top-color:${s.border}`">
        <div class="text-2xl font-bold" :class="s.color">{{ counts[s.key] }}</div>
        <div class="text-[10px] text-gray-400 mt-0.5">{{ s.label }}</div>
      </div>
    </div>

    <!-- Day headers -->
    <div class="grid grid-cols-7 border-b border-gray-100">
      <div v-for="(d, i) in weekDays" :key="d"
        class="text-center text-[11px] font-semibold py-2"
        :class="i===5?'text-blue-400':i===6?'text-red-400':'text-gray-500'">
        {{ d }}
      </div>
    </div>

    <!-- 移動/複製：選目標日期橫幅 -->
    <div v-if="pendingAction" class="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
      <span>{{ pendingActionLabel }}</span>
      <button @click="cancelPendingAction" class="text-xs border border-amber-300 rounded-lg px-3 py-1 hover:bg-amber-100 flex-shrink-0">取消</button>
    </div>

    <!-- Calendar grid -->
    <div class="grid grid-cols-7">
      <div v-for="(cell, i) in calendarCells" :key="i"
        class="border-r border-b border-gray-100 p-1 sm:p-2 min-h-[70px] sm:min-h-[90px]"
        :class="[
          !cell.currentMonth && 'opacity-40',
          cell.isToday ? 'bg-amber-50' : cell.isNonWorking ? 'bg-rose-100' : '',
          cell.currentMonth && 'cursor-pointer hover:bg-gray-50/50 transition-colors',
          cell.dateStr === highlightDate && cell.currentMonth ? 'ring-2 ring-inset ring-amber-400' : '',
          pendingAction ? 'hover:ring-2 hover:ring-inset hover:ring-amber-400 cursor-pointer' : ''
        ]"
        @click="onCellClick(cell)">
        <span v-if="cell.isToday"
          class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
          style="background:#c9a96e">
          {{ cell.day }}
        </span>
        <span v-else-if="cell.dateStr === highlightDate && cell.currentMonth"
          class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
          style="background:#f59e0b">
          {{ cell.day }}
        </span>
        <span v-else class="text-xs"
          :class="cell.dayOfWeek===6?'text-blue-500':cell.dayOfWeek===0?'text-red-500':'text-gray-600'">
          {{ cell.day }}
        </span>
        <div v-if="cell.holidayName && cell.currentMonth"
          class="text-[9px] text-rose-400 font-medium truncate leading-none mt-0.5">
          {{ cell.holidayName }}
        </div>
        <div v-for="event in cell.events.slice(0, 4)" :key="event.id"
          @click.stop="onEventTap(event, cell.dateStr)"
          class="mt-1 text-[10px] rounded px-1.5 py-0.5 truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
          :class="event.type === 'leave' ? 'bg-blue-400' : event.type === 'note' ? 'bg-red-400' : ''"
          :style="event.type === 'milestone' ? 'background:#0d9488' : event.type === 'followup' ? 'background:#a855f7' : ''">
          {{ event.startTime ? `${event.startTime}${event.endTime ? '-' + event.endTime : ''} ` : '' }}{{ event.label }}
        </div>
        <div v-if="cell.events.length > 4" class="mt-1 text-[9px] text-gray-400 truncate">
          還有 {{ cell.events.length - 4 }} 則
        </div>
      </div>
    </div>
  </div>

  <!-- 新增事件 Modal -->
  <div v-if="showAddEvent" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">新增行事曆事件</h3>
        <button @click="showAddEvent = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">事件類型</label>
          <div class="flex gap-2">
            <button v-for="t in eventTypes" :key="t.key"
              @click="eventForm.type = t.key"
              class="flex-1 text-xs py-2 rounded-lg border transition-colors"
              :class="eventForm.type === t.key ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 hover:border-gray-300'"
              :style="eventForm.type === t.key ? `background:${t.color}` : ''">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">日期 *</label>
            <input v-model="eventForm.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div v-if="eventForm.type !== 'followup'">
            <label class="text-xs text-gray-500 mb-1 block">結束日期（選填）</label>
            <input v-model="eventForm.endDate" type="date" :min="eventForm.date"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">時間{{ TIME_REQUIRED_TYPES.includes(eventForm.type) ? ' *' : '（選填）' }}</label>
          <div class="flex items-center gap-2">
            <select v-model="eventForm.startTime" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="">不設定</option>
              <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
            </select>
            <span class="text-xs text-gray-400 flex-shrink-0">至</span>
            <select v-model="eventForm.endTime" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="">不設定</option>
              <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>
        <template v-if="eventForm.type === 'leave'">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">請假人員 *</label>
            <select v-model="eventForm.personName" :disabled="!authStore.isManager"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500">
              <option value="">— 請選擇 —</option>
              <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">
              請假時數 *
              <span v-if="eventForm.startTime && eventForm.endTime" class="ml-1 text-[10px] text-amber-500">（已自動計算）</span>
            </label>
            <input v-model.number="eventForm.hours" type="number" min="0" step="0.5"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">假別</label>
            <select v-model="eventForm.leaveType" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="">— 請選擇 —</option>
              <option v-for="t in LEAVE_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">事由（選填）</label>
            <input v-model="eventForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：個人事假、病假">
          </div>
        </template>
        <template v-else-if="eventForm.type === 'milestone'">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-gray-500">案件（可多筆）</label>
              <button @click="eventForm.caseIds.push('')" class="text-[11px]" style="color:#c9a96e">+ 新增</button>
            </div>
            <div v-for="(_, i) in eventForm.caseIds" :key="i" class="flex gap-2 mb-1.5">
              <select v-model="eventForm.caseIds[i]" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option value="">— 選擇案件 —</option>
                <option v-for="c in activeCases" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <button @click="eventForm.caseIds.splice(i,1)" class="text-red-400 text-xs">✕</button>
            </div>
            <div v-if="!eventForm.caseIds.length" class="text-[11px] text-gray-300">點右上新增案件</div>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">說明</label>
            <input v-model="eventForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：場勘、開工、驗收…">
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-gray-500">人員（可多筆）</label>
              <button @click="eventForm.personNames.push('')" class="text-[11px]" style="color:#c9a96e">+ 新增</button>
            </div>
            <div v-for="(_, i) in eventForm.personNames" :key="i" class="flex gap-2 mb-1.5">
              <select v-model="eventForm.personNames[i]" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option value="">— 選擇人員 —</option>
                <option value="全員">全員</option>
                <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
              </select>
              <button @click="eventForm.personNames.splice(i,1)" class="text-red-400 text-xs">✕</button>
            </div>
            <div v-if="!eventForm.personNames.length" class="text-[11px] text-gray-300">點右上新增人員</div>
          </div>
        </template>
        <template v-else>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">說明 *</label>
            <input v-model="eventForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：年度品質回顧">
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-gray-500">人員（可多筆）</label>
              <button @click="eventForm.personNames.push('')" class="text-[11px]" style="color:#c9a96e">+ 新增</button>
            </div>
            <div v-for="(_, i) in eventForm.personNames" :key="i" class="flex gap-2 mb-1.5">
              <select v-model="eventForm.personNames[i]" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option value="">— 選擇人員 —</option>
                <option value="全員">全員</option>
                <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
              </select>
              <button @click="eventForm.personNames.splice(i,1)" class="text-red-400 text-xs">✕</button>
            </div>
            <div v-if="!eventForm.personNames.length" class="text-[11px] text-gray-300">點右上新增人員</div>
          </div>
        </template>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showAddEvent = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitEvent" :disabled="!canSubmitAddEvent || submitting"
          class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed" style="background:#1e2533">新增</button>
      </div>
    </div>
  </div>

  <!-- 編輯 / 刪除事件 Modal -->
  <div v-if="showEditEvent" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-base font-bold text-gray-800">編輯事件</h3>
        <button @click="showEditEvent = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">事件類型</label>
          <div class="flex gap-2">
            <button v-for="t in eventTypes" :key="t.key"
              @click="editForm.type = t.key"
              class="flex-1 text-xs py-2 rounded-lg border transition-colors"
              :class="editForm.type === t.key ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 hover:border-gray-300'"
              :style="editForm.type === t.key ? `background:${t.color}` : ''">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">日期</label>
            <input v-model="editForm.date" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div v-if="editForm.type !== 'followup'">
            <label class="text-xs text-gray-500 mb-1 block">結束日期（選填）</label>
            <input v-model="editForm.endDate" type="date" :min="editForm.date"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">時間{{ TIME_REQUIRED_TYPES.includes(editForm.type) ? ' *' : '（選填）' }}</label>
          <div class="flex items-center gap-2">
            <select v-model="editForm.startTime" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="">不設定</option>
              <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
            </select>
            <span class="text-xs text-gray-400 flex-shrink-0">至</span>
            <select v-model="editForm.endTime" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
              <option value="">不設定</option>
              <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>
        <template v-if="editForm.type === 'leave'">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">
              請假人員
              <span v-if="editForm._leaveTypeLocked" class="ml-1 text-[10px] text-red-400">（已透過薪資單折抵補休，請至薪資單取消折抵後再編輯）</span>
            </label>
            <select v-model="editForm.personName" :disabled="!authStore.isManager || editForm._leaveTypeLocked"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500">
              <option value="">— 請選擇 —</option>
              <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">
              請假時數
              <span v-if="editForm.startTime && editForm.endTime" class="ml-1 text-[10px] text-amber-500">（已自動計算）</span>
            </label>
            <input v-model.number="editForm.hours" type="number" min="0" step="0.5"
              :disabled="editForm._leaveTypeLocked"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">
              假別
              <span v-if="editForm._origDate < todayStr" class="ml-1 text-[10px] text-red-400">（過去日期不可變更）</span>
              <span v-else-if="editForm._leaveTypeLocked" class="ml-1 text-[10px] text-red-400">（已透過薪資單折抵補休，請至薪資單取消折抵後再編輯）</span>
            </label>
            <select v-model="editForm.leaveType"
              :disabled="editForm._origDate < todayStr || editForm._leaveTypeLocked"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">— 請選擇 —</option>
              <option v-for="t in LEAVE_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">事由</label>
            <input v-model="editForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </template>
        <template v-else-if="editForm.type === 'milestone'">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-gray-500">案件（可多筆）</label>
              <button @click="editForm.caseIds.push('')" class="text-[11px]" style="color:#c9a96e">+ 新增</button>
            </div>
            <div v-for="(_, i) in editForm.caseIds" :key="i" class="flex gap-2 mb-1.5">
              <select v-model="editForm.caseIds[i]" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option value="">— 選擇案件 —</option>
                <option v-for="c in activeCases" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <button @click="editForm.caseIds.splice(i,1)" class="text-red-400 text-xs">✕</button>
            </div>
            <div v-if="!editForm.caseIds.length" class="text-[11px] text-gray-300">點右上新增案件</div>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">說明</label>
            <input v-model="editForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：場勘、開工、驗收…">
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-gray-500">人員（可多筆）</label>
              <button @click="editForm.personNames.push('')" class="text-[11px]" style="color:#c9a96e">+ 新增</button>
            </div>
            <div v-for="(_, i) in editForm.personNames" :key="i" class="flex gap-2 mb-1.5">
              <select v-model="editForm.personNames[i]" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option value="">— 選擇人員 —</option>
                <option value="全員">全員</option>
                <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
              </select>
              <button @click="editForm.personNames.splice(i,1)" class="text-red-400 text-xs">✕</button>
            </div>
            <div v-if="!editForm.personNames.length" class="text-[11px] text-gray-300">點右上新增人員</div>
          </div>
        </template>
        <template v-else>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">說明</label>
            <input v-model="editForm.label" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-gray-500">人員（可多筆）</label>
              <button @click="editForm.personNames.push('')" class="text-[11px]" style="color:#c9a96e">+ 新增</button>
            </div>
            <div v-for="(_, i) in editForm.personNames" :key="i" class="flex gap-2 mb-1.5">
              <select v-model="editForm.personNames[i]" class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
                <option value="">— 選擇人員 —</option>
                <option value="全員">全員</option>
                <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
              </select>
              <button @click="editForm.personNames.splice(i,1)" class="text-red-400 text-xs">✕</button>
            </div>
            <div v-if="!editForm.personNames.length" class="text-[11px] text-gray-300">點右上新增人員</div>
          </div>
        </template>
      </div>
      <div class="flex justify-between mt-5">
        <button @click="removeEvent" :disabled="editForm._leaveTypeLocked"
          :title="editForm._leaveTypeLocked ? '已透過薪資單折抵補休，請至薪資單取消折抵後再刪除' : ''"
          class="text-sm text-red-400 hover:text-red-600 px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-400">刪除</button>
        <div class="flex gap-2">
          <button @click="showEditEvent = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="saveEditEvent" :disabled="!canSubmitEditEvent || submitting"
            class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed" style="background:#1e2533">儲存</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 請假衝突比對 Modal -->
  <div v-if="conflictModal" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.5)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4 border-amber-400">
      <h3 class="text-base font-bold text-gray-800 mb-1">偵測到請假重疊</h3>
      <p class="text-xs text-gray-400 mb-3">同一人同時段已經有其他請假紀錄，請選擇要怎麼處理：</p>
      <div class="bg-gray-50 rounded-lg p-3 mb-3">
        <div v-for="c in conflictModal.conflicts" :key="c.id" class="text-xs text-gray-600 mb-1 last:mb-0">
          現有：<span class="font-semibold">{{ c.leaveType }} {{ c.hours }}h</span>（{{ c.dateLabel }}）
          <span v-if="c.leaveTypeLocked" class="block text-[10px] text-red-400 mt-0.5">（已透過薪資單折抵，請先至薪資單取消折抵後再處理這筆衝突）</span>
        </div>
      </div>
      <div v-if="conflictModal.suggestion" class="text-xs text-amber-600 mb-3">
        ⭐ 補休餘額足夠，建議改用補休
      </div>
      <div class="flex flex-col gap-2">
        <button @click="resolveConflict('keep')" :disabled="resolvingConflict" class="text-sm border border-gray-200 rounded-lg py-2 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed">保留現有</button>
        <button @click="resolveConflict('comp')" :disabled="resolvingConflict || hasLockedConflict" class="text-sm rounded-lg py-2 text-white disabled:opacity-40 disabled:cursor-not-allowed" style="background:#1e2533">
          改用新增（補休）<span v-if="conflictModal.suggestion === '補休'">⭐</span>
        </button>
        <button @click="resolveConflict('personal')" :disabled="resolvingConflict || hasLockedConflict" class="text-sm border border-gray-200 rounded-lg py-2 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed">改用新增（事假）</button>
        <button @click="resolveConflict('cancel')" :disabled="resolvingConflict" class="text-sm text-gray-400 py-2 disabled:opacity-40 disabled:cursor-not-allowed">取消</button>
      </div>
    </div>
  </div>

  <!-- 事件操作小視窗（編輯 / 移動 / 複製） -->
  <div v-if="eventActionModal" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)" @click.self="eventActionModal = null">
    <div class="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="text-sm font-bold text-gray-800 mb-1 truncate">{{ eventActionModal.label }}</div>
      <div class="text-xs text-gray-400 mb-4">要對這個事件做什麼？</div>
      <div class="flex flex-col gap-2">
        <button @click="openEditEvent(eventActionModal); eventActionModal = null" class="text-sm border border-gray-200 rounded-lg py-2 hover:border-gray-400">✏️ 編輯</button>
        <button @click="startPendingAction('move', eventActionModal)" class="text-sm rounded-lg py-2 text-white" style="background:#1e2533">⟳ 移動到別天</button>
        <button @click="startPendingAction('copy', eventActionModal)" class="text-sm border border-gray-200 rounded-lg py-2 hover:border-gray-400">⧉ 複製到別天</button>
        <button @click="eventActionModal = null" class="text-sm text-gray-400 py-2">取消</button>
      </div>
    </div>
  </div>

  <!-- 當天詳情 Modal -->
  <div v-if="showDayDetail" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4 max-h-[80vh] flex flex-col" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-base font-bold text-gray-800">{{ dayDetailLabel }}</h3>
        <button @click="showDayDetail = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div v-if="dayDetailHoliday" class="text-xs text-rose-400 font-medium mb-3">{{ dayDetailHoliday }}</div>
      <div v-else class="mb-3"></div>
      <div class="flex flex-col gap-2 overflow-y-auto flex-1">
        <div v-for="event in dayDetailEvents" :key="event.id"
          @click="onEventTap(event, dayDetailDate)"
          class="flex items-center gap-2 rounded-lg px-3 py-2 border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :class="event.type === 'leave' ? 'bg-blue-400' : event.type === 'note' ? 'bg-red-400' : ''"
            :style="event.type === 'milestone' ? 'background:#0d9488' : event.type === 'followup' ? 'background:#a855f7' : ''"></span>
          <span class="text-xs text-gray-700 flex-1 min-w-0 truncate">
            {{ event.startTime ? `${event.startTime}${event.endTime ? '-' + event.endTime : ''} ` : '' }}{{ event.label }}
          </span>
        </div>
        <div v-if="dayDetailEvents.length === 0" class="text-xs text-gray-300 py-4 text-center">尚無安排</div>
      </div>
      <button @click="addEventFromDayDetail" class="text-sm text-white px-5 py-2 rounded-xl mt-4" style="background:#1e2533">+ 新增事件</button>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Timestamp } from 'firebase/firestore'
import { useCasesStore } from '@/stores/cases'
import { useCalendarEventsStore } from '@/stores/calendarEvents'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useNotificationsStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'
import { hoursToDays } from '@/utils/leaveConversion'
import { consumeFIFO, refundConsumption, sumRemainingHours } from '@/utils/compLedger'
import { findOverlappingLeave } from '@/utils/leaveConflict'
import CompensatoryPanel from './CompensatoryPanel.vue'
import { TAIWAN_HOLIDAY_NAMES } from '@/constants/holidays'
import { getBusinessDays } from '@/utils/businessDays'
import { leaveDedupeId } from '@/utils/leaveDedupeId'
import { shiftedRange, buildCopyDraft } from '@/utils/eventDateShift'

const props = defineProps({ region: String, jumpEventDate: String })
const emit = defineEmits(['jumped-date'])
const casesStore = useCasesStore()
const eventsStore = useCalendarEventsStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const notifStore = useNotificationsStore()
const { toast } = useToast()
const weekDays = ['一', '二', '三', '四', '五', '六', '日']
const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

function findUserByName(name) {
    return usersStore.users.find(u => u.name === name)
}

// 補休核銷/歸還走 compLedger：deltaHours>=0 是歸還（consumption 必須提供，指定歸還哪些分錄，
// 呼叫端從行事曆事件的 compConsumption 欄位取得）；deltaHours<0 是核銷（回傳這次核銷動用到的分錄
// 清單 [{id,hours}]，呼叫端要把這個清單存進行事曆事件的 compConsumption 欄位，供之後編輯/刪除精確歸還）
async function applyLeaveDelta(leaveType, name, deltaHours, consumption = null) {
    const user = findUserByName(name)
    if (!user) return null
    if (leaveType === '補休') {
        if (deltaHours >= 0) {
            if (consumption?.length) {
                const entries = await usersStore.fetchCompLedger(user.id)
                const refunded = refundConsumption(entries, consumption)
                const before = new Map(entries.map(e => [e.id, e.remainingHours]))
                const changed = refunded.filter(e => before.get(e.id) !== e.remainingHours)
                await usersStore.applyLedgerConsumption(user.id, changed)
            }
            return null
        }
        const entries = await usersStore.fetchCompLedger(user.id)
        entries.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
        const needed = -deltaHours
        const weekday = consumeFIFO(entries, '平日', needed)
        const holiday = weekday.shortfall > 0
            ? consumeFIFO(weekday.updatedEntries, '休息日', weekday.shortfall)
            : { consumptions: [], updatedEntries: weekday.updatedEntries }
        const allConsumptions = [...weekday.consumptions, ...holiday.consumptions]
        const touchedIds = new Set(allConsumptions.map(c => c.id))
        await usersStore.applyLedgerConsumption(user.id, holiday.updatedEntries.filter(e => touchedIds.has(e.id)))
        return allConsumptions
    } else if (leaveType === '特休') {
        await usersStore.adjustAnnualLeaveHours(user.id, hoursToDays(deltaHours))
    }
    return null
}

async function getLeaveBalance(leaveType, name) {
    const user = findUserByName(name)
    if (!user) return 0
    if (leaveType === '補休') {
        const entries = await usersStore.fetchCompLedger(user.id)
        return sumRemainingHours(entries, '平日') + sumRemainingHours(entries, '休息日')
    }
    if (leaveType === '特休') return user.annualLeaveHours ?? 0
    return 0
}

function leaveNeeded(leaveType, hours) {
    return leaveType === '特休' ? hoursToDays(hours) : hours
}

function leaveInsufficientMsg(leaveType) {
    return leaveType === '特休' ? '特休天數不足' : '補休時數不足'
}

const TRACKED_LEAVE_TYPES = ['補休', '特休']

async function checkLeaveConflict(personName, dateStr, endDateStr, excludeId) {
    if (!personName || !dateStr) return []
    const raw = await eventsStore.fetchLeaveEventsByPerson(personName)
    const normalized = raw.map(e => ({
        id: e.id,
        personName: e.personName,
        date: tsToDateStr(e.date),
        endDate: e.endDate ? tsToDateStr(e.endDate) : '',
        leaveType: e.leaveType || '',
        hours: e.hours || 0,
        compConsumption: e.compConsumption || [],
        leaveTypeLocked: e.leaveTypeLocked || false,
    }))
    return findOverlappingLeave(normalized, { personName, date: dateStr, endDate: endDateStr, excludeId })
}

async function openConflictModal(mode, conflicts) {
    const personName = mode === 'add' ? eventForm.value.personName : editForm.value.personName
    const newLeaveType = mode === 'add' ? eventForm.value.leaveType : editForm.value.leaveType
    const newHours = mode === 'add' ? eventForm.value.hours : editForm.value.hours
    let suggestion = null
    if (newLeaveType === '事假') {
        const balance = await getLeaveBalance('補休', personName)
        if (balance >= (newHours || 0)) suggestion = '補休'
    }
    conflictModal.value = {
        mode,
        suggestion,
        conflicts: conflicts.map(c => ({
            id: c.id,
            leaveType: c.leaveType,
            hours: c.hours,
            dateLabel: c.endDate && c.endDate !== c.date ? `${c.date} ~ ${c.endDate}` : c.date,
            date: c.date,
            endDate: c.endDate,
            compConsumption: c.compConsumption,
            leaveTypeLocked: c.leaveTypeLocked,
        })),
    }
}

function closeConflictModal() {
    conflictModal.value = null
}

// 比照 removeEvent()/finalizeEditEvent() 既有規則：只有今日（含）以後的紀錄才調整餘額，
// 過去日期的餘額不退回；但不管日期新舊，衝突紀錄本身都要刪除。
// personName 由呼叫端在 finalizeAddEvent/finalizeEditEvent 執行之前先取好傳進來——
// finalizeAddEvent 成功後會把 eventForm 重置為空白表單，這裡不能再從 eventForm 現讀取
async function removeConflictingEvents(conflicts, personName, writtenLeaveId = null) {
    for (const c of conflicts) {
        // 已透過薪資單折抵鎖定的事件不該被這裡刪除——正常操作應該已經在 resolveConflict()
        // 跟畫面 disabled 擋掉這條路徑，這裡是最後一道防線，不退款也不刪除
        if (c.leaveTypeLocked) continue
        if (TRACKED_LEAVE_TYPES.includes(c.leaveType) && c.date >= todayStr) {
            await applyLeaveDelta(c.leaveType, personName, c.hours, c.compConsumption)
        }
        if (c.id === writtenLeaveId) continue // 這筆衝突已被新紀錄用同一個固定 doc ID 覆蓋，別再刪掉
        await eventsStore.deleteEvent(c.id)
    }
}

async function resolveConflict(choice) {
    if (!conflictModal.value) return
    if (resolvingConflict.value) return
    resolvingConflict.value = true
    try {
        const { mode, conflicts } = conflictModal.value
        if (choice === 'cancel') { closeConflictModal(); return }
        if (choice === 'keep') {
            closeConflictModal()
            if (mode === 'add') { eventForm.value = blankEvent(); showAddEvent.value = false }
            else { showEditEvent.value = false }
            return
        }
        // 函式層面再擋一次「改用新增」對已鎖定衝突事件的操作，不只靠畫面 disabled——
        // 這條路徑最終會刪除鎖定事件，繞過薪資單的取消折抵正規流程
        if ((choice === 'comp' || choice === 'personal') && conflicts.some(c => c.leaveTypeLocked)) {
            toast('這筆衝突紀錄已透過薪資單折抵，請先至薪資單取消折抵後再處理', 'error')
            return
        }
        // personName 要在呼叫 finalizeAddEvent/finalizeEditEvent 之前先取好：
        // finalizeAddEvent 成功後會把 eventForm 重置成空白表單，之後才讀會拿到空字串
        const personName = mode === 'add' ? eventForm.value.personName : editForm.value.personName
        const newLeaveType = choice === 'comp' ? '補休' : '事假'
        if (mode === 'add') eventForm.value.leaveType = newLeaveType
        else editForm.value.leaveType = newLeaveType
        // 先確保新紀錄寫入成功，才刪除舊的衝突紀錄，避免「舊的刪了、新的沒寫成功」造成資料遺失
        const success = mode === 'add' ? await finalizeAddEvent() : await finalizeEditEvent()
        if (!success) {
            toast('新申請未成功，原本的請假紀錄未變動', 'error')
            return
        }
        // 新紀錄已經寫入成功（success === true），不能再讓任何路徑重新呼叫 finalizeAddEvent/
        // finalizeEditEvent（add 模式表單已被清空、edit 模式重打會重複扣一次餘額）。所以這裡失敗
        // 一律視為「新紀錄已生效，舊紀錄清理留給使用者手動處理」，直接關閉視窗，不保留給使用者重試整個流程
        try {
            await removeConflictingEvents(conflicts, personName, mode === 'add' ? lastLeaveWriteId.value : null)
        } catch {
            toast('新的請假紀錄已建立，但舊紀錄清理失敗，請至行事曆手動確認並刪除重複的舊紀錄', 'error')
            closeConflictModal()
            return
        }
        closeConflictModal()
    } finally {
        resolvingConflict.value = false
    }
}
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())
const highlightDate = ref(null)

const REGION_LABELS = { south: '南區', north: '北區', central: '中區' }

watch(() => props.jumpEventDate, (dateStr) => {
    if (!dateStr) return
    const d = new Date(dateStr)
    if (isNaN(d)) return
    currentYear.value = d.getFullYear()
    currentMonth.value = d.getMonth()
    highlightDate.value = dateStr
    emit('jumped-date')
    toast(`已跳轉至 ${d.getFullYear()}年${d.getMonth() + 1}月・${REGION_LABELS[props.region] ?? props.region}`)
}, { immediate: true })
const showAddEvent = ref(false)
const showDayDetail = ref(false)
const dayDetailDate = ref('')
const ALL_REGIONS = ['south', 'north', 'central']

const eventTypes = [
  { key: 'note',      label: '重要記事',   color: '#f87171' },
  { key: 'milestone', label: '場勘/施工',   color: '#0d9488' },
  { key: 'leave',     label: '員工請假',   color: '#60a5fa' },
  { key: 'followup',  label: '客戶跟進',   color: '#a855f7' },
]
const LEAVE_TYPES = ['特休', '病假', '事假', '臨請', '婚假', '喪假', '產假', '陪產假', '公假', '補休', '其他']

const TIME_OPTIONS = (() => {
    const opts = []
    for (let h = 7; h <= 21; h++) {
        opts.push(`${String(h).padStart(2, '0')}:00`)
        if (h < 21) opts.push(`${String(h).padStart(2, '0')}:30`)
    }
    return opts
})()

const blankEvent = () => ({ type: 'note', date: '', endDate: '', label: '', personName: '', hours: 0, leaveType: '', caseIds: [], personNames: [], startTime: '', endTime: '' })
const eventForm = ref(blankEvent())
const showEditEvent = ref(false)
const editingEventId = ref(null)
const editForm = ref({ type: 'note', date: '', endDate: '', label: '', personName: '', hours: 0, leaveType: '', caseIds: [], personNames: [], startTime: '', endTime: '' })

const conflictModal = ref(null)
// conflictModal 結構：{ mode: 'add' | 'edit', conflicts: [{id, leaveType, hours, dateLabel, date, endDate, compConsumption, leaveTypeLocked}], suggestion: '補休' | null }
const resolvingConflict = ref(false)
const submitting = ref(false)
const lastLeaveWriteId = ref(null)
const eventActionModal = ref(null)
const pendingAction = ref(null)

function startPendingAction(mode, event) {
  pendingAction.value = { mode, event }
  eventActionModal.value = null
  showDayDetail.value = false
  showEditEvent.value = false
}

function cancelPendingAction() {
  pendingAction.value = null
}

async function pickTargetDate(dateStr) {
  const action = pendingAction.value
  if (!action) return
  pendingAction.value = null
  if (action.mode === 'move') await moveEvent(action.event, dateStr)
  else await copyEvent(action.event, dateStr)
}

function onCellClick(cell) {
  if (pendingAction.value) { pickTargetDate(cell.dateStr); return }
  if (cell.currentMonth) openDayDetail(cell.dateStr)
}

function onEventTap(event, dateStr) {
  if (pendingAction.value) { pickTargetDate(dateStr); return }
  showDayDetail.value = false
  if (event._merged) { openDayDetail(dateStr); return }
  if (event.type === 'leave') { openEditEvent(event); return }
  eventActionModal.value = event
}

function onCalendarKeydown(e) {
  if (e.key === 'Escape' && pendingAction.value) cancelPendingAction()
}

// 衝突紀錄裡只要有一筆已經透過薪資單折抵鎖定，「改用新增」就要整組擋掉——
// 那條路徑最終會刪除鎖定事件，繞過薪資單的取消折抵正規流程
const hasLockedConflict = computed(() =>
    (conflictModal.value?.conflicts ?? []).some(c => c.leaveTypeLocked)
)

// 非管理者（蚌/其宏/柏以外）新增請假時，只能填自己的名字，選單直接鎖定
watch(() => eventForm.value.type, (t) => {
  if (t === 'leave' && !authStore.isManager) eventForm.value.personName = authStore.name ?? ''
})

// 重要記事/場勘施工/客戶跟進要求日期跟開始/結束時間都填才能送出；請假維持原樣（常見整天假不填時間）
const TIME_REQUIRED_TYPES = ['note', 'milestone', 'followup']

function hasRequiredDateTime(form) {
  if (!TIME_REQUIRED_TYPES.includes(form.type)) return true
  return !!(form.date && form.startTime && form.endTime)
}

const canSubmitAddEvent = computed(() => hasRequiredDateTime(eventForm.value))
const canSubmitEditEvent = computed(() => hasRequiredDateTime(editForm.value))

const activeCases = computed(() =>
    casesStore.cases.filter(c => !['completed', 'lost'].includes(c.status))
)

function tsToDateStr(ts) {
  const d = ts?.toDate?.() ?? new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function openEditEvent(event) {
  if (event.type === 'leave' && !authStore.isManager && event.personName !== authStore.name) {
    toast('只有蚌、其宏、柏可以編輯別人的請假紀錄', 'error')
    return
  }
  editingEventId.value = event.id
  const casePrefix = event.type === 'milestone' ? (event.caseNames || []).join(' ') : ''
  let label = event.label || ''
  if (casePrefix) {
    while (label.startsWith(casePrefix)) label = label.slice(casePrefix.length).trimStart()
  }
  editForm.value = {
    type: event.type, date: tsToDateStr(event.date), label,
    personName: event.personName || '', hours: event.hours || 0, leaveType: event.leaveType || '',
    caseIds: event.caseIds ?? (event.caseId ? [event.caseId] : []),
    personNames: event.personNames ?? (event.type === 'milestone' && event.personName ? [event.personName] : []),
    startTime: event.startTime || '', endTime: event.endTime || '',
    endDate: event.endDate ? tsToDateStr(event.endDate) : '',
    _origLeaveType: event.leaveType || '',
    _origHours: event.hours || 0,
    _origPersonName: event.personName || '',
    _origDate: tsToDateStr(event.date),
    _origCompConsumption: event.compConsumption || [],
    _leaveTypeLocked: event.leaveTypeLocked || false,
  }
  showEditEvent.value = true
}

async function saveEditEvent() {
  if (submitting.value) return
  if (!editForm.value.date) return
  if (!hasRequiredDateTime(editForm.value)) {
    toast('請填寫日期與開始/結束時間', 'error')
    return
  }
  const isLeave = editForm.value.type === 'leave'
  const isMilestone = editForm.value.type === 'milestone'
  if (isLeave && !editForm.value.personName) return
  if (!isLeave && !editForm.value.label && !isMilestone) return
  if (isLeave && !authStore.isManager &&
      (editForm.value._origPersonName !== authStore.name || editForm.value.personName !== authStore.name)) {
    toast('只有蚌、其宏、柏可以修改別人的請假紀錄', 'error')
    return
  }
  // 已透過薪資單折抵補休的事件（leaveTypeLocked）：假別/時數/人員欄位在畫面上已 disable，
  // 這裡再擋一層，避免使用者繞過 disabled 屬性直接改 v-model 值
  if (editForm.value._leaveTypeLocked) {
    editForm.value.leaveType = editForm.value._origLeaveType
    editForm.value.hours = editForm.value._origHours
    editForm.value.personName = editForm.value._origPersonName
  }
  if (isLeave && getBusinessDays(editForm.value.date, editForm.value.endDate).length === 0) {
    const hol = TAIWAN_HOLIDAY_NAMES[editForm.value.date]
    toast(hol ? `${editForm.value.date} 是國定假日（${hol}），不用請假` : '週末不用請假', 'error')
    return
  }
  submitting.value = true
  try {
    if (isLeave) {
      const conflicts = await checkLeaveConflict(editForm.value.personName, editForm.value.date, editForm.value.endDate, editingEventId.value)
      if (conflicts.length) {
        await openConflictModal('edit', conflicts)
        return
      }
    }
    await finalizeEditEvent()
  } finally {
    submitting.value = false
  }
}

async function finalizeEditEvent() {
  const isLeave = editForm.value.type === 'leave'
  const isMilestone = editForm.value.type === 'milestone'
  try {
    const caseNames = isMilestone
      ? editForm.value.caseIds.map(id => activeCases.value.find(c => c.id === id)?.name).filter(Boolean)
      : []
    const payload = {
      type: editForm.value.type,
      date: Timestamp.fromDate(new Date(editForm.value.date)),
      label: isLeave
        ? `${editForm.value.personName} ${editForm.value.leaveType || '請假'}${editForm.value.hours ? ` ${editForm.value.hours}h` : ''}`
        : isMilestone
          ? [...caseNames, editForm.value.label].filter(Boolean).join(' ')
          : editForm.value.label,
    }
    if (isLeave) {
      payload.personName = editForm.value.personName
      payload.hours = editForm.value.hours || 0
      payload.leaveType = editForm.value.leaveType || ''
    }
    if (isMilestone) {
      payload.caseIds = editForm.value.caseIds
      payload.caseNames = caseNames
      payload.personNames = editForm.value.personNames.filter(Boolean)
    }
    if (['note', 'followup'].includes(editForm.value.type)) {
      payload.personNames = editForm.value.personNames.filter(Boolean)
    }
    if (editForm.value.startTime) {
      payload.startTime = editForm.value.startTime
      payload.endTime = editForm.value.endTime || ''
    } else {
      payload.startTime = ''
      payload.endTime = ''
    }
    if (['note', 'milestone', 'leave'].includes(editForm.value.type) &&
        editForm.value.endDate && editForm.value.endDate > editForm.value.date) {
      payload.endDate = Timestamp.fromDate(new Date(editForm.value.endDate))
    } else {
      payload.endDate = null
    }

    // 補休/特休時數：只對今日（含）以後的事件調整；假別/時數/人員三者都沒變時整段跳過，
    // 避免不必要的「退回再重新核銷」把 compConsumption 換成不同分錄組合（總時數不變但分錄id可能不同），
    // 影響後續取消折抵功能需要精確反向操作 compConsumption 的能力。updateEvent 底層是 Firestore
    // 的 updateDoc（部分合併），沒設定的欄位不會被動到，原本存的 compConsumption 會維持不變
    if (isLeave && editForm.value._origDate >= todayStr) {
      const noChange = editForm.value.leaveType === editForm.value._origLeaveType &&
        editForm.value.hours === editForm.value._origHours &&
        editForm.value.personName === editForm.value._origPersonName
      if (!noChange) {
        const wasTracked = TRACKED_LEAVE_TYPES.includes(editForm.value._origLeaveType)
        const isTracked = TRACKED_LEAVE_TYPES.includes(editForm.value.leaveType)
        if (wasTracked && editForm.value._origPersonName)
          await applyLeaveDelta(editForm.value._origLeaveType, editForm.value._origPersonName, editForm.value._origHours, editForm.value._origCompConsumption)
        if (isTracked && editForm.value.personName) {
          const hours = editForm.value.hours || 0
          const balance = await getLeaveBalance(editForm.value.leaveType, editForm.value.personName)
          if (balance < leaveNeeded(editForm.value.leaveType, hours)) { toast(leaveInsufficientMsg(editForm.value.leaveType), 'error'); return false }
          const consumption = await applyLeaveDelta(editForm.value.leaveType, editForm.value.personName, -hours)
          if (editForm.value.leaveType === '補休') payload.compConsumption = consumption || []
        }
      }
    }

    await eventsStore.updateEvent(editingEventId.value, payload)
    const editEvtDate = editForm.value.date
    notifStore.notifyAll(authStore.name ?? '', `修改了行程「${payload.label}」（${fmtNotifDate(editEvtDate)}）`, '', '', props.region ?? '', '', 'cal', editEvtDate, false)
    showEditEvent.value = false
    return true
  } catch {
    toast('儲存失敗，請重試', 'error')
    return false
  }
}

async function removeEvent() {
  if (editForm.value._leaveTypeLocked) {
    toast('已透過薪資單折抵補休，請至薪資單取消折抵後再刪除', 'error')
    return
  }
  if (editForm.value.type === 'leave' && !authStore.isManager && editForm.value._origPersonName !== authStore.name) {
    toast('只有蚌、其宏、柏可以刪除別人的請假紀錄', 'error')
    return
  }
  try {
    const delEvtDate = editForm.value.date
    const delLabel = editForm.value.type === 'leave'
        ? `${editForm.value.personName} ${editForm.value.leaveType || '請假'}${editForm.value.hours ? ` ${editForm.value.hours}h` : ''}`
        : editForm.value.label
    if (TRACKED_LEAVE_TYPES.includes(editForm.value._origLeaveType) && editForm.value._origPersonName && editForm.value._origDate >= todayStr) {
      await applyLeaveDelta(editForm.value._origLeaveType, editForm.value._origPersonName, editForm.value._origHours, editForm.value._origCompConsumption)
    }
    await eventsStore.deleteEvent(editingEventId.value)
    notifStore.notifyAll(authStore.name ?? '', `刪除了行程「${delLabel}」（${fmtNotifDate(delEvtDate)}）`, '', '', props.region ?? '', '', 'cal', delEvtDate, true)
    showEditEvent.value = false
  } catch {
    toast('刪除失敗，請重試', 'error')
  }
}

const WORK_START = '09:00'
const WORK_END = '18:00'

function calcHours(start, end) {
    if (!start || !end) return null
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em
    let diff = (endMin - startMin) / 60
    if (startMin < 13 * 60 && endMin > 12 * 60) diff -= 1
    return diff > 0 ? diff : null
}

// 首尾兩天若有填時間，只算部分時數（用上下班時間09:00-18:00當滿天基準）；中間的平日一律算整天8小時
function calcLeaveHours(dateStr, endDateStr, startTime, endTime) {
    const days = getBusinessDays(dateStr, endDateStr)
    if (!days.length) return null
    let total = 0
    days.forEach((_, i) => {
        const isFirst = i === 0
        const isLast = i === days.length - 1
        if (isFirst && isLast) total += (startTime && endTime) ? (calcHours(startTime, endTime) ?? 0) : 8
        else if (isFirst) total += startTime ? (calcHours(startTime, WORK_END) ?? 0) : 8
        else if (isLast) total += endTime ? (calcHours(WORK_START, endTime) ?? 0) : 8
        else total += 8
    })
    return total
}

watch(
    [() => eventForm.value.date, () => eventForm.value.endDate, () => eventForm.value.startTime, () => eventForm.value.endTime, () => eventForm.value.leaveType],
    ([date, endDate, startTime, endTime, leaveType]) => {
        if (eventForm.value.type !== 'leave') return
        if (!leaveType) return
        const h = calcLeaveHours(date, endDate, startTime, endTime)
        if (h !== null) eventForm.value.hours = h
    }
)

watch(
    [() => editForm.value.date, () => editForm.value.endDate, () => editForm.value.startTime, () => editForm.value.endTime, () => editForm.value.leaveType],
    ([date, endDate, startTime, endTime, leaveType]) => {
        if (editForm.value.type !== 'leave') return
        if (!leaveType) return
        const h = calcLeaveHours(date, endDate, startTime, endTime)
        if (h !== null) editForm.value.hours = h
    }
)

// 行事曆不分區，永遠訂閱全部分區的事件（案件/客戶等其他功能仍照原樣分區，不受影響）
watch([currentYear, currentMonth], () => {
  eventsStore.subscribe(ALL_REGIONS, currentYear.value, currentMonth.value)
}, { immediate: true })

onMounted(() => window.addEventListener('keydown', onCalendarKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onCalendarKeydown)
  eventsStore.cleanup()
})

const displayMonth = computed(() => `${currentYear.value}年 ${currentMonth.value + 1}月`)
const pendingActionLabel = computed(() => {
  if (!pendingAction.value) return ''
  const verb = pendingAction.value.mode === 'move' ? '移到' : '複製到'
  return `請點選要把「${pendingAction.value.event.label}」${verb}哪一天`
})

function fmtNotifDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function prevMonth() {
  highlightDate.value = null
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- }
  else currentMonth.value--
}
function nextMonth() {
  highlightDate.value = null
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ }
  else currentMonth.value++
}
function goToToday() {
  highlightDate.value = null
  currentYear.value = today.getFullYear()
  currentMonth.value = today.getMonth()
}

const statuses = [
  { key: 'pending',            label: '待約客戶',  color: 'text-gray-700',       border: '#94a3b8' },
  { key: 'negotiating',        label: '洽談中',    color: 'text-[#c9a96e]',      border: '#c9a96e' },
  { key: 'drafting',           label: '製圖中',    color: 'text-[#f472b6]',      border: '#f472b6' },
  { key: 'construction',       label: '施工中',    color: 'text-blue-500',       border: '#3b82f6' },
  { key: 'pending_settlement', label: '待結算',    color: 'text-orange-500',     border: '#f97316' },
  { key: 'aftercare',          label: '售後/組裝', color: 'text-green-500',      border: '#22c55e' }
]

const counts = computed(() =>
  Object.fromEntries(statuses.map(s => [s.key, casesStore.statusCount(s.key, props.region)]))
)

function eventsForDate(date) {
  const cellTime = date.getTime()
  return eventsStore.events.filter(e => {
    const startTs = e.date?.toDate?.() ?? new Date(e.date)
    const start = new Date(startTs.getFullYear(), startTs.getMonth(), startTs.getDate()).getTime()
    if (!e.endDate) return cellTime === start
    const endTs = e.endDate?.toDate?.() ?? new Date(e.endDate)
    const end = new Date(endTs.getFullYear(), endTs.getMonth(), endTs.getDate()).getTime()
    return cellTime >= start && cellTime <= end
  }).sort((a, b) => {
    const aTime = a.startTime || ''
    const bTime = b.startTime || ''
    if (aTime !== bTime) return aTime.localeCompare(bTime)
    const aCreated = a.createdAt?.toMillis?.() ?? 0
    const bCreated = b.createdAt?.toMillis?.() ?? 0
    return aCreated - bCreated
  })
}

// 同一案場、同一天的多筆場勘/施工事項合併成一個色塊（只用於月曆格子的精簡顯示，
// 當天詳情視窗要看完整清單，所以不能動 eventsForDate() 本身）
function mergeMilestonesByCase(events) {
  const order = []
  const groups = new Map()
  for (const e of events) {
    if (e.type !== 'milestone' || !(e.caseNames && e.caseNames.length)) { order.push({ single: e }); continue }
    const caseKey = e.caseNames.join('、')
    const casePrefix = e.caseNames.join(' ')
    let item = e.label || ''
    if (casePrefix) while (item.startsWith(casePrefix)) item = item.slice(casePrefix.length).trimStart()
    if (!groups.has(caseKey)) {
      const bucket = { caseKey, first: e, items: [] }
      groups.set(caseKey, bucket)
      order.push({ group: bucket })
    }
    groups.get(caseKey).items.push(item || e.label || '')
  }
  return order.map(o => {
    if (o.single) return o.single
    const { caseKey, first, items } = o.group
    if (items.length === 1) return first
    return { ...first, id: `merged_${first.id}`, label: `${caseKey}：${items.join('、')}`, _merged: true }
  })
}

const calendarCells = computed(() => {
  const cells = []
  const first = new Date(currentYear.value, currentMonth.value, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
  const prevMonthDays = new Date(currentYear.value, currentMonth.value, 0).getDate()

  function toDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  }

  for (let i = startOffset - 1; i >= 0; i--) {
    const date = new Date(currentYear.value, currentMonth.value - 1, prevMonthDays - i)
    const dow = date.getDay()
    cells.push({ day: prevMonthDays - i, currentMonth: false, dateStr: toDateStr(date), events: mergeMilestonesByCase(eventsForDate(date)), dayOfWeek: dow, isNonWorking: dow === 0 || dow === 6 })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear.value, currentMonth.value, d)
    const dow = date.getDay()
    const dateStr = toDateStr(date)
    const isWeekend = dow === 0 || dow === 6
    const holidayName = TAIWAN_HOLIDAY_NAMES[dateStr] ?? null
    cells.push({
      day: d, currentMonth: true,
      isToday: date.toDateString() === today.toDateString(),
      dateStr,
      dayOfWeek: dow,
      isNonWorking: isWeekend || Boolean(holidayName),
      holidayName,
      events: mergeMilestonesByCase(eventsForDate(date))
    })
  }

  let nextDay = 1
  while (cells.length % 7 !== 0) {
    const date = new Date(currentYear.value, currentMonth.value + 1, nextDay)
    const dow = date.getDay()
    cells.push({ day: nextDay, currentMonth: false, dateStr: toDateStr(date), events: mergeMilestonesByCase(eventsForDate(date)), dayOfWeek: dow, isNonWorking: dow === 0 || dow === 6 })
    nextDay++
  }
  return cells
})

function openAddOnDate(dateStr) {
    eventForm.value = { ...blankEvent(), date: dateStr }
    showAddEvent.value = true
}

const WEEKDAYS_FULL = ['日', '一', '二', '三', '四', '五', '六']

function openDayDetail(dateStr) {
    dayDetailDate.value = dateStr
    showDayDetail.value = true
}

function openEventFromDayDetail(event) {
    showDayDetail.value = false
    openEditEvent(event)
}

function addEventFromDayDetail() {
    const dateStr = dayDetailDate.value
    showDayDetail.value = false
    openAddOnDate(dateStr)
}

const dayDetailEvents = computed(() => {
    if (!dayDetailDate.value) return []
    const [y, m, d] = dayDetailDate.value.split('-').map(Number)
    return eventsForDate(new Date(y, m - 1, d))
})

const dayDetailLabel = computed(() => {
    if (!dayDetailDate.value) return ''
    const [y, m, d] = dayDetailDate.value.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return `${y}年${m}月${d}日（週${WEEKDAYS_FULL[date.getDay()]}）`
})

const dayDetailHoliday = computed(() => TAIWAN_HOLIDAY_NAMES[dayDetailDate.value] ?? null)

async function submitEvent() {
  if (submitting.value) return
  if (!eventForm.value.date) return
  if (!hasRequiredDateTime(eventForm.value)) {
    toast('請填寫日期與開始/結束時間', 'error')
    return
  }
  const isLeave = eventForm.value.type === 'leave'
  const isMilestone = eventForm.value.type === 'milestone'
  if (isLeave && !eventForm.value.personName) return
  if (!isLeave && !eventForm.value.label && !isMilestone) return
  if (isLeave && !authStore.isManager && eventForm.value.personName !== authStore.name) {
    toast('只有蚌、其宏、柏可以新增別人的請假紀錄', 'error')
    return
  }
  if (isLeave && getBusinessDays(eventForm.value.date, eventForm.value.endDate).length === 0) {
    const hol = TAIWAN_HOLIDAY_NAMES[eventForm.value.date]
    toast(hol ? `${eventForm.value.date} 是國定假日（${hol}），不用請假` : '週末不用請假', 'error')
    return
  }
  submitting.value = true
  try {
    if (isLeave) {
      const conflicts = await checkLeaveConflict(eventForm.value.personName, eventForm.value.date, eventForm.value.endDate, null)
      if (conflicts.length) {
        await openConflictModal('add', conflicts)
        return
      }
    }
    await finalizeAddEvent()
  } finally {
    submitting.value = false
  }
}

async function finalizeAddEvent() {
  lastLeaveWriteId.value = null
  const isLeave = eventForm.value.type === 'leave'
  const isMilestone = eventForm.value.type === 'milestone'
  try {
    const caseNames = isMilestone
      ? eventForm.value.caseIds.map(id => activeCases.value.find(c => c.id === id)?.name).filter(Boolean)
      : []
    const payload = {
      companyId: props.region,
      type: eventForm.value.type,
      date: Timestamp.fromDate(new Date(eventForm.value.date)),
      label: isLeave
        ? `${eventForm.value.personName} ${eventForm.value.leaveType || '請假'}${eventForm.value.hours ? ` ${eventForm.value.hours}h` : ''}`
        : isMilestone
          ? [...caseNames, eventForm.value.label].filter(Boolean).join(' ')
          : eventForm.value.label,
      createdBy: authStore.user?.uid ?? '',
    }
    const dedupeId = isLeave
      ? leaveDedupeId({
          companyId: payload.companyId,
          personName: eventForm.value.personName,
          date: eventForm.value.date,
          endDate: eventForm.value.endDate,
          leaveType: eventForm.value.leaveType,
          startTime: eventForm.value.startTime,
        })
      : null
    if (isLeave) {
      payload.personName = eventForm.value.personName
      payload.hours = eventForm.value.hours || 0
      payload.leaveType = eventForm.value.leaveType || ''
    }
    if (isMilestone) {
      payload.caseIds = eventForm.value.caseIds
      payload.caseNames = caseNames
      payload.personNames = eventForm.value.personNames.filter(Boolean)
    }
    if (['note', 'followup'].includes(eventForm.value.type)) {
      payload.personNames = eventForm.value.personNames.filter(Boolean)
    }
    if (eventForm.value.startTime) {
      payload.startTime = eventForm.value.startTime
      payload.endTime = eventForm.value.endTime || ''
    }
    if (['note', 'milestone', 'leave'].includes(eventForm.value.type) &&
        eventForm.value.endDate && eventForm.value.endDate > eventForm.value.date) {
      payload.endDate = Timestamp.fromDate(new Date(eventForm.value.endDate))
    }
    if (isLeave && TRACKED_LEAVE_TYPES.includes(eventForm.value.leaveType) && eventForm.value.personName) {
      const hours = eventForm.value.hours || 0
      const balance = await getLeaveBalance(eventForm.value.leaveType, eventForm.value.personName)
      if (balance < leaveNeeded(eventForm.value.leaveType, hours)) { toast(leaveInsufficientMsg(eventForm.value.leaveType), 'error'); return false }
      const consumption = await applyLeaveDelta(eventForm.value.leaveType, eventForm.value.personName, -hours)
      if (eventForm.value.leaveType === '補休') payload.compConsumption = consumption || []
      await eventsStore.addEvent(payload, dedupeId)
    } else {
      await eventsStore.addEvent(payload, dedupeId)
    }
    const newEvtDate = eventForm.value.date
    notifStore.notifyAll(authStore.name ?? '', `新增了行程「${payload.label}」（${fmtNotifDate(newEvtDate)}）`, '', '', payload.companyId, '', 'cal', newEvtDate, false)
    eventForm.value = blankEvent()
    showAddEvent.value = false
    lastLeaveWriteId.value = dedupeId
    return true
  } catch {
    toast('新增失敗，請重試', 'error')
    return false
  }
}

async function moveEvent(event, targetDateStr) {
  const origDate = tsToDateStr(event.date)
  if (targetDateStr === origDate) return
  const origEnd = event.endDate ? tsToDateStr(event.endDate) : ''
  const { date, endDate } = shiftedRange(origDate, origEnd, targetDateStr)
  const payload = {
    date: Timestamp.fromDate(new Date(date)),
    endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
  }
  try {
    await eventsStore.updateEvent(event.id, payload)
    notifStore.notifyAll(authStore.name ?? '', `將行程「${event.label}」從 ${fmtNotifDate(origDate)} 移至 ${fmtNotifDate(date)}`, '', '', event.companyId ?? props.region ?? '', '', 'cal', date, false)
  } catch {
    toast('移動失敗，請重試', 'error')
  }
}

async function copyEvent(event, targetDateStr) {
  const origDate = tsToDateStr(event.date)
  const origEnd = event.endDate ? tsToDateStr(event.endDate) : ''
  const draft = buildCopyDraft(event, origDate, origEnd, targetDateStr, { region: props.region, uid: authStore.user?.uid })
  const payload = { ...draft, date: Timestamp.fromDate(new Date(draft.date)) }
  if (draft.endDate) payload.endDate = Timestamp.fromDate(new Date(draft.endDate))
  try {
    await eventsStore.addEvent(payload)
    notifStore.notifyAll(authStore.name ?? '', `複製行程「${event.label}」到 ${fmtNotifDate(draft.date)}`, '', '', payload.companyId, '', 'cal', draft.date, false)
  } catch {
    toast('複製失敗，請重試', 'error')
  }
}
</script>
