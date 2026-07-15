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
        <div class="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] ml-1">
          <button @click="showAllRegions = false"
            class="px-2.5 py-1 transition-colors"
            :class="!showAllRegions ? 'text-white' : 'text-gray-500 hover:bg-gray-50'"
            :style="!showAllRegions ? 'background:#1e2533' : ''">本區</button>
          <button @click="showAllRegions = true"
            class="px-2.5 py-1 transition-colors border-l border-gray-200"
            :class="showAllRegions ? 'text-white' : 'text-gray-500 hover:bg-gray-50'"
            :style="showAllRegions ? 'background:#c9a96e' : ''">全區</button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px]">
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background:#fecdd3;border:1px solid #f9a8d4"></span>假日</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-red-400"></span>重要記事</div>
        <div class="hidden sm:flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-orange-400"></span>場勘/施工</div>
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

    <!-- Calendar grid -->
    <div class="grid grid-cols-7">
      <div v-for="(cell, i) in calendarCells" :key="i"
        class="border-r border-b border-gray-100 p-1 sm:p-2 min-h-[70px] sm:min-h-[90px]"
        :class="[
          !cell.currentMonth && 'opacity-40',
          cell.isToday ? 'bg-amber-50' : cell.isNonWorking ? 'bg-rose-50/60' : '',
          cell.currentMonth && 'cursor-pointer hover:bg-gray-50/50 transition-colors',
          cell.dateStr === highlightDate && cell.currentMonth ? 'ring-2 ring-inset ring-amber-400' : ''
        ]"
        @click="cell.currentMonth && openDayDetail(cell.dateStr)">
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
        <div v-for="event in cell.events.slice(0, 2)" :key="event.id"
          @click.stop="openEditEvent(event)"
          class="mt-1 text-[10px] rounded px-1.5 py-0.5 truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
          :class="event.type === 'leave' ? 'bg-blue-400' : event.type === 'note' ? 'bg-red-400' : ''"
          :style="event.type === 'milestone' ? 'background:#fb923c' : event.type === 'followup' ? 'background:#a855f7' : ''">
          {{ event.startTime ? `${event.startTime}${event.endTime ? '-' + event.endTime : ''} ` : '' }}{{ event.label }}
        </div>
        <div v-if="cell.events.length > 2" class="mt-1 text-[9px] text-gray-400 truncate">
          還有 {{ cell.events.length - 2 }} 則
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
        <div class="grid grid-cols-2 gap-3">
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
          <label class="text-xs text-gray-500 mb-1 block">時間（選填）</label>
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
            <select v-model="eventForm.personName" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
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
        <button @click="submitEvent" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">新增</button>
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
        <div class="grid grid-cols-2 gap-3">
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
          <label class="text-xs text-gray-500 mb-1 block">時間（選填）</label>
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
            <label class="text-xs text-gray-500 mb-1 block">請假人員</label>
            <select v-model="editForm.personName" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
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
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">
              假別
              <span v-if="editForm._origDate < todayStr" class="ml-1 text-[10px] text-red-400">（過去日期不可變更）</span>
            </label>
            <select v-model="editForm.leaveType"
              :disabled="editForm._origDate < todayStr"
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
        <button @click="removeEvent" class="text-sm text-red-400 hover:text-red-600 px-3 py-2">刪除</button>
        <div class="flex gap-2">
          <button @click="showEditEvent = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="saveEditEvent" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">儲存</button>
        </div>
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
          @click="openEventFromDayDetail(event)"
          class="flex items-center gap-2 rounded-lg px-3 py-2 border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :class="event.type === 'leave' ? 'bg-blue-400' : event.type === 'note' ? 'bg-red-400' : ''"
            :style="event.type === 'milestone' ? 'background:#fb923c' : event.type === 'followup' ? 'background:#a855f7' : ''"></span>
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
import { ref, computed, watch, onUnmounted } from 'vue'
import { Timestamp } from 'firebase/firestore'
import { useCasesStore } from '@/stores/cases'
import { useCalendarEventsStore } from '@/stores/calendarEvents'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useNotificationsStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'
import { hoursToDays } from '@/utils/leaveConversion'
import CompensatoryPanel from './CompensatoryPanel.vue'
import { TAIWAN_HOLIDAY_NAMES } from '@/constants/holidays'

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

async function applyLeaveDelta(leaveType, name, deltaHours) {
    const user = findUserByName(name)
    if (!user) return
    if (leaveType === '補休') {
        await usersStore.ensureMonthClosed(user.id)
        if (deltaHours >= 0) {
            // 還回補休（移除請假）：還入平日補休
            await usersStore.adjustCompensatoryHours(user.id, deltaHours)
        } else {
            // 扣除補休：先扣平日，不夠再扣休息日。用月結後的最新餘額算，
            // 不能用函式一開始拿到的 user 物件（可能是月結歸零前的舊快照）
            const fresh = await usersStore.getUser(user.id)
            const weekday = fresh?.compensatoryHours ?? 0
            const fromWeekday = Math.max(deltaHours, -weekday)
            const fromHoliday = deltaHours - fromWeekday
            if (fromWeekday !== 0) await usersStore.adjustCompensatoryHours(user.id, fromWeekday)
            if (fromHoliday !== 0) await usersStore.adjustCompensatoryHolidayHours(user.id, fromHoliday)
        }
    } else if (leaveType === '特休') await usersStore.adjustAnnualLeaveHours(user.id, hoursToDays(deltaHours))
}

async function getLeaveBalance(leaveType, name) {
    const user = findUserByName(name)
    if (!user) return 0
    if (leaveType === '補休') {
        await usersStore.ensureMonthClosed(user.id)
        const fresh = await usersStore.getUser(user.id)
        return (fresh?.compensatoryHours ?? 0) + (fresh?.compensatoryHolidayHours ?? 0)
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
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())
const highlightDate = ref(null)

watch(() => props.jumpEventDate, (dateStr) => {
    if (!dateStr) return
    const d = new Date(dateStr)
    if (isNaN(d)) return
    currentYear.value = d.getFullYear()
    currentMonth.value = d.getMonth()
    highlightDate.value = dateStr
    emit('jumped-date')
}, { immediate: true })
const showAddEvent = ref(false)
const showAllRegions = ref(false)
const showDayDetail = ref(false)
const dayDetailDate = ref('')
const ALL_REGIONS = ['south', 'north', 'central']

const eventTypes = [
  { key: 'note',      label: '重要記事',   color: '#f87171' },
  { key: 'milestone', label: '場勘/施工',   color: '#fb923c' },
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

const activeCases = computed(() =>
    casesStore.cases.filter(c => !['completed', 'lost'].includes(c.status))
)

function tsToDateStr(ts) {
  const d = ts?.toDate?.() ?? new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function openEditEvent(event) {
  editingEventId.value = event.id
  editForm.value = {
    type: event.type, date: tsToDateStr(event.date), label: event.label || '',
    personName: event.personName || '', hours: event.hours || 0, leaveType: event.leaveType || '',
    caseIds: event.caseIds ?? (event.caseId ? [event.caseId] : []),
    personNames: event.personNames ?? (event.type === 'milestone' && event.personName ? [event.personName] : []),
    startTime: event.startTime || '', endTime: event.endTime || '',
    endDate: event.endDate ? tsToDateStr(event.endDate) : '',
    _origLeaveType: event.leaveType || '',
    _origHours: event.hours || 0,
    _origPersonName: event.personName || '',
    _origDate: tsToDateStr(event.date),
  }
  showEditEvent.value = true
}

async function saveEditEvent() {
  if (!editForm.value.date) return
  const isLeave = editForm.value.type === 'leave'
  const isMilestone = editForm.value.type === 'milestone'
  if (isLeave && !editForm.value.personName) return
  if (!isLeave && !editForm.value.label && !isMilestone) return
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

    // 補休/特休時數：只對今日（含）以後的事件調整
    if (isLeave && editForm.value._origDate >= todayStr) {
      const wasTracked = TRACKED_LEAVE_TYPES.includes(editForm.value._origLeaveType)
      const isTracked = TRACKED_LEAVE_TYPES.includes(editForm.value.leaveType)
      if (wasTracked && editForm.value._origPersonName)
        await applyLeaveDelta(editForm.value._origLeaveType, editForm.value._origPersonName, editForm.value._origHours)
      if (isTracked && editForm.value.personName) {
        const hours = editForm.value.hours || 0
        const balance = await getLeaveBalance(editForm.value.leaveType, editForm.value.personName)
        if (balance < leaveNeeded(editForm.value.leaveType, hours)) { toast(leaveInsufficientMsg(editForm.value.leaveType), 'error'); return }
        await applyLeaveDelta(editForm.value.leaveType, editForm.value.personName, -hours)
      }
    }

    await eventsStore.updateEvent(editingEventId.value, payload)
    const editEvtDate = editForm.value.date
    notifStore.notifyAll(authStore.name ?? '', `修改了行程「${payload.label}」（${fmtNotifDate(editEvtDate)}）`, '', '', props.region ?? '', '', 'cal', editEvtDate, false)
    showEditEvent.value = false
  } catch {
    toast('儲存失敗，請重試', 'error')
  }
}

async function removeEvent() {
  try {
    const delEvtDate = editForm.value.date
    const delLabel = editForm.value.type === 'leave'
        ? `${editForm.value.personName} ${editForm.value.leaveType || '請假'}${editForm.value.hours ? ` ${editForm.value.hours}h` : ''}`
        : editForm.value.label
    if (TRACKED_LEAVE_TYPES.includes(editForm.value._origLeaveType) && editForm.value._origPersonName && editForm.value._origDate >= todayStr) {
      await applyLeaveDelta(editForm.value._origLeaveType, editForm.value._origPersonName, editForm.value._origHours)
    }
    await eventsStore.deleteEvent(editingEventId.value)
    notifStore.notifyAll(authStore.name ?? '', `刪除了行程「${delLabel}」（${fmtNotifDate(delEvtDate)}）`, '', '', props.region ?? '', '', 'cal', delEvtDate, true)
    showEditEvent.value = false
  } catch {
    toast('刪除失敗，請重試', 'error')
  }
}

function calcHours(start, end) {
    if (!start || !end) return null
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const diff = (eh * 60 + em - sh * 60 - sm) / 60
    return diff > 0 ? diff : null
}

function calcBusinessDays(dateStr, endDateStr) {
    if (!dateStr) return 0
    const start = new Date(dateStr)
    const end = endDateStr && endDateStr > dateStr ? new Date(endDateStr) : new Date(dateStr)
    let days = 0
    const cur = new Date(start)
    while (cur <= end) {
        const dow = cur.getDay()
        const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`
        if (dow !== 0 && dow !== 6 && !TAIWAN_HOLIDAY_NAMES[ds]) days++
        cur.setDate(cur.getDate() + 1)
    }
    return days
}

watch([() => eventForm.value.startTime, () => eventForm.value.endTime], ([start, end]) => {
    if (eventForm.value.type !== 'leave') return
    const h = calcHours(start, end)
    if (h !== null) eventForm.value.hours = h
})

watch([() => editForm.value.startTime, () => editForm.value.endTime], ([start, end]) => {
    if (editForm.value.type !== 'leave') return
    const h = calcHours(start, end)
    if (h !== null) editForm.value.hours = h
})

watch(
    [() => eventForm.value.date, () => eventForm.value.endDate, () => eventForm.value.leaveType],
    ([date, endDate, leaveType]) => {
        if (eventForm.value.type !== 'leave') return
        if (!TRACKED_LEAVE_TYPES.includes(leaveType)) return
        if (eventForm.value.startTime && eventForm.value.endTime) return
        eventForm.value.hours = calcBusinessDays(date, endDate) * 8
    }
)

watch(
    [() => editForm.value.date, () => editForm.value.endDate, () => editForm.value.leaveType],
    ([date, endDate, leaveType]) => {
        if (editForm.value.type !== 'leave') return
        if (!TRACKED_LEAVE_TYPES.includes(leaveType)) return
        if (editForm.value.startTime && editForm.value.endTime) return
        editForm.value.hours = calcBusinessDays(date, endDate) * 8
    }
)

watch([() => props.region, currentYear, currentMonth, showAllRegions], ([region]) => {
  if (region) eventsStore.subscribe(
    showAllRegions.value ? ALL_REGIONS : region,
    currentYear.value, currentMonth.value
  )
}, { immediate: true })

onUnmounted(() => eventsStore.cleanup())

const displayMonth = computed(() => `${currentYear.value}年 ${currentMonth.value + 1}月`)

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
    cells.push({ day: prevMonthDays - i, currentMonth: false, dateStr: toDateStr(date), events: eventsForDate(date), dayOfWeek: dow, isNonWorking: dow === 0 || dow === 6 })
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
      events: eventsForDate(date)
    })
  }

  let nextDay = 1
  while (cells.length % 7 !== 0) {
    const date = new Date(currentYear.value, currentMonth.value + 1, nextDay)
    const dow = date.getDay()
    cells.push({ day: nextDay, currentMonth: false, dateStr: toDateStr(date), events: eventsForDate(date), dayOfWeek: dow, isNonWorking: dow === 0 || dow === 6 })
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
  if (!eventForm.value.date) return
  const isLeave = eventForm.value.type === 'leave'
  const isMilestone = eventForm.value.type === 'milestone'
  if (isLeave && !eventForm.value.personName) return
  if (!isLeave && !eventForm.value.label && !isMilestone) return
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
      if (balance < leaveNeeded(eventForm.value.leaveType, hours)) { toast(leaveInsufficientMsg(eventForm.value.leaveType), 'error'); return }
      await eventsStore.addEvent(payload)
      await applyLeaveDelta(eventForm.value.leaveType, eventForm.value.personName, -hours)
    } else {
      await eventsStore.addEvent(payload)
    }
    const newEvtDate = eventForm.value.date
    notifStore.notifyAll(authStore.name ?? '', `新增了行程「${payload.label}」（${fmtNotifDate(newEvtDate)}）`, '', '', payload.companyId, '', 'cal', newEvtDate, false)
    eventForm.value = blankEvent()
    showAddEvent.value = false
  } catch {
    toast('新增失敗，請重試', 'error')
  }
}
</script>
