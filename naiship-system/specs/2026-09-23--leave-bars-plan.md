# 行事曆跨天事件長條顯示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把有結束日期的事件（請假／重要記事／場勘施工）從「每天各自重複顯示一個色塊」改成「一條橫跨多天的長條，遇假日自動斷開」，維持既有拖曳/點擊/新增/刪除互動邏輯完全不變。

**Architecture:** 新增純函式 `src/utils/calendarEventBars.js` 算「這一週要畫哪些長條段、佔第幾欄、佔第幾列」；`CalendarTab.vue` 新增三個 computed 把跨天事件從逐日 `events` 列表抽出、依週分組算長條、產生已過濾的週格資料；樣板把原本「一個大 grid 塞 42 格」改成「6 個獨立的週列容器，每個週列疊放絕對定位的長條」。

**Tech Stack:** Vue 3（`<script setup>`）、Vitest、Tailwind（inline style 為主，沿用既有慣例）

**對應 spec：** `specs/2026-09-23--leave-bars-design.md`

---

### Task 1: 建立 `src/utils/calendarEventBars.js` 長條排版演算法

**Files:**
- Create: `src/utils/calendarEventBars.js`
- Test: `tests/utils/calendarEventBars.test.js`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/utils/calendarEventBars.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { buildWeekEventBars } from '@/utils/calendarEventBars'

// 一般的一週：週一到週日，週六日不上班，其餘都是上班日
const NORMAL_WEEK = [
    { date: '2026-10-05', isNonWorking: false }, // 一
    { date: '2026-10-06', isNonWorking: false }, // 二
    { date: '2026-10-07', isNonWorking: false }, // 三
    { date: '2026-10-08', isNonWorking: false }, // 四
    { date: '2026-10-09', isNonWorking: false }, // 五
    { date: '2026-10-10', isNonWorking: true },  // 六
    { date: '2026-10-11', isNonWorking: true },  // 日
]

// 週三是國定假日的一週
const HOLIDAY_MID_WEEK = [
    { date: '2026-10-05', isNonWorking: false },
    { date: '2026-10-06', isNonWorking: false },
    { date: '2026-10-07', isNonWorking: true },  // 週三國定假日
    { date: '2026-10-08', isNonWorking: false },
    { date: '2026-10-09', isNonWorking: false },
    { date: '2026-10-10', isNonWorking: true },
    { date: '2026-10-11', isNonWorking: true },
]

describe('buildWeekEventBars', () => {
    it('事件橫跨整週，週六日自動斷開，只剩週一到週五一段', () => {
        const events = [{ id: 'e1', date: '2026-10-05', endDate: '2026-10-11' }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([{ id: 'e1', colStart: 0, colSpan: 5, row: 0 }])
    })

    it('事件在週中間開始、週中間結束', () => {
        const events = [{ id: 'e1', date: '2026-10-07', endDate: '2026-10-09' }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([{ id: 'e1', colStart: 2, colSpan: 3, row: 0 }])
    })

    it('事件被週三的國定假日截斷成兩段', () => {
        const events = [{ id: 'e1', date: '2026-10-05', endDate: '2026-10-09' }]
        const bars = buildWeekEventBars(HOLIDAY_MID_WEEK, events)
        expect(bars).toEqual([
            { id: 'e1', colStart: 0, colSpan: 2, row: 0 }, // 週一、週二
            { id: 'e1', colStart: 3, colSpan: 2, row: 0 }, // 週四、週五
        ])
    })

    it('事件跨到下一週：這一週只算屬於這一週的部分', () => {
        const events = [{ id: 'e1', date: '2026-10-08', endDate: '2026-10-14' }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([{ id: 'e1', colStart: 3, colSpan: 2, row: 0 }]) // 只到週五
    })

    it('同一週兩條跨天事件欄位重疊，分別排到第 0 列、第 1 列', () => {
        const events = [
            { id: 'e1', date: '2026-10-05', endDate: '2026-10-07' },
            { id: 'e2', date: '2026-10-06', endDate: '2026-10-09' },
        ]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([
            { id: 'e1', colStart: 0, colSpan: 3, row: 0 },
            { id: 'e2', colStart: 1, colSpan: 4, row: 1 },
        ])
    })

    it('同一週欄位不重疊的兩條事件可以共用第 0 列（不用各佔一列）', () => {
        const events = [
            { id: 'e1', date: '2026-10-05', endDate: '2026-10-06' },
            { id: 'e2', date: '2026-10-08', endDate: '2026-10-09' },
        ]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([
            { id: 'e1', colStart: 0, colSpan: 2, row: 0 },
            { id: 'e2', colStart: 3, colSpan: 2, row: 0 },
        ])
    })

    it('同一週三條事件欄位互相重疊，第三條排不進兩列，不出現在結果裡', () => {
        const events = [
            { id: 'e1', date: '2026-10-05', endDate: '2026-10-09' },
            { id: 'e2', date: '2026-10-05', endDate: '2026-10-09' },
            { id: 'e3', date: '2026-10-05', endDate: '2026-10-09' },
        ]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toHaveLength(2)
        expect(bars.map(b => b.id).sort()).toEqual(['e1', 'e2'])
    })

    it('事件完全不重疊這一週，回傳空陣列', () => {
        const events = [{ id: 'e1', date: '2026-09-01', endDate: '2026-09-05' }]
        const bars = buildWeekEventBars(NORMAL_WEEK, events)
        expect(bars).toEqual([])
    })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- --run tests/utils/calendarEventBars.test.js`
Expected: FAIL，找不到 `src/utils/calendarEventBars.js`

- [ ] **Step 3: 建立 `src/utils/calendarEventBars.js`**

```js
// 算「一週」裡跨天事件要畫成哪些長條段：橫跨哪幾欄（0-6，週一到週日）、佔第幾列（0 或 1）。
// 純函式，不認識 Vue/Firestore，只吃 { date, endDate } 這種 'YYYY-MM-DD' 字串比較的最小資料形狀。
// 遇到非上班日會把同一個事件切成不連續的段；同一週最多容納 2 列，
// 欄位互相重疊、兩列都放不下的段直接不出現在回傳結果裡，呼叫端要自己判斷
// 「這個事件在這一天有沒有被排進長條」，沒有的話維持原本逐日顯示，不會拋錯。

function segmentsForEvent(event, weekDays) {
    const segments = []
    let start = -1
    for (let col = 0; col < weekDays.length; col++) {
        const day = weekDays[col]
        const covered = day.date >= event.date && day.date <= event.endDate
        const usable = covered && !day.isNonWorking
        if (usable) {
            if (start === -1) start = col
        } else if (start !== -1) {
            segments.push({ id: event.id, colStart: start, colSpan: col - start })
            start = -1
        }
    }
    if (start !== -1) segments.push({ id: event.id, colStart: start, colSpan: weekDays.length - start })
    return segments
}

/**
 * @param {Array<{date: string, isNonWorking: boolean}>} weekDays 這一週 7 天（週一到週日），date 為 'YYYY-MM-DD'
 * @param {Array<{id: string, date: string, endDate: string}>} events 可能跨這一週的事件，date/endDate 為 'YYYY-MM-DD'
 * @returns {Array<{id: string, colStart: number, colSpan: number, row: number}>} 排進長條的段落
 */
export function buildWeekEventBars(weekDays, events) {
    const allSegments = events.flatMap(event => segmentsForEvent(event, weekDays))
    allSegments.sort((a, b) => a.colStart - b.colStart || String(a.id).localeCompare(String(b.id)))

    const rows = [[], []]
    const placed = []
    for (const seg of allSegments) {
        const colEnd = seg.colStart + seg.colSpan
        const rowIndex = rows.findIndex(row =>
            row.every(other => colEnd <= other.colStart || seg.colStart >= other.colStart + other.colSpan)
        )
        if (rowIndex === -1) continue
        rows[rowIndex].push(seg)
        placed.push({ ...seg, row: rowIndex })
    }
    return placed
}
```

- [ ] **Step 4: 執行測試確認全部通過**

Run: `npm test -- --run tests/utils/calendarEventBars.test.js`
Expected: PASS，8 項測試全過

- [ ] **Step 5: Commit**

```bash
git add src/utils/calendarEventBars.js tests/utils/calendarEventBars.test.js
git commit -m "feat(naiship): 新增 calendarEventBars 跨天事件長條排版演算法

純函式算每週跨天事件的長條段落，遇非上班日自動斷開，
同一週最多 2 列，欄位不重疊的事件可共用同一列。"
```

---

### Task 2: `CalendarTab.vue` 加上長條資料的 computed（先不動樣板）

**Files:**
- Modify: `src/components/cases/CalendarTab.vue:501`（import 區）
- Modify: `src/components/cases/CalendarTab.vue`（`calendarCells` computed 後面新增三個 computed）

這個 Task 只加資料層的 computed，不動 `<template>`，確保加完之後跑既有測試還是全過（因為樣板還沒改，畫面行為完全沒變）。

- [ ] **Step 1: 加 import**

在 `src/components/cases/CalendarTab.vue` 第 501 行 `import { getLunarLabel } from '@/utils/lunarCalendar'` 這行下面新增一行：

```js
import { buildWeekEventBars } from '@/utils/calendarEventBars'
```

- [ ] **Step 2: 在 `calendarCells` computed 後面新增三個 computed**

找到 `calendarCells` computed 結尾的 `return cells` 跟它後面的 `})`（這個 computed 目前在檔案裡，結尾長這樣）：

```js
  return cells
})
```

在這個 `calendarCells` computed 的 `})` 後面（也就是整個 `calendarCells` computed 結束之後）新增：

```js

// 有 endDate 的事件才會被拿去排長條；已經被 mergeMilestonesByCase() 合併成 _merged
// 的場勘/施工事件不套用長條顯示，維持原本逐日顯示的行為（合併只在「同一天同案場
// 多筆場勘」才會發生，機率很低，不強求這個情況也做成長條）
const multiDayEventLookup = computed(() => {
  const map = new Map()
  for (const e of eventsStore.events) {
    if (e.endDate && !e._merged) map.set(e.id, e)
  }
  return map
})

// 依週分組（每 7 格一組），每週各自算長條，回傳長度 6 的陣列，每項是這一週要畫的長條清單
const weekEventBars = computed(() => {
  const cells = calendarCells.value
  const weeks = []
  for (let wi = 0; wi * 7 < cells.length; wi++) {
    const week = cells.slice(wi * 7, wi * 7 + 7)
    const weekDays = week.map(c => ({ date: c.dateStr, isNonWorking: c.isNonWorking }))
    const weekStart = week[0].dateStr
    const weekEnd = week[6].dateStr
    const events = []
    for (const e of multiDayEventLookup.value.values()) {
      const start = tsToDateStr(e.date)
      const end = tsToDateStr(e.endDate)
      if (end >= weekStart && start <= weekEnd) events.push({ id: e.id, date: start, endDate: end })
    }
    const bars = buildWeekEventBars(weekDays, events).map(seg => ({
      event: multiDayEventLookup.value.get(seg.id),
      colStart: seg.colStart,
      colSpan: seg.colSpan,
      row: seg.row,
    }))
    weeks.push(bars)
  }
  return weeks
})

// 依週分組的最終格子資料，events 已經把「這一天被長條蓋到的跨天事件」濾掉，
// 樣板的逐日事件迴圈（slice(0,4)）改吃這份資料，不會跟長條重複顯示
const weekGroups = computed(() => {
  const cells = calendarCells.value
  const bars = weekEventBars.value
  const weeks = []
  for (let wi = 0; wi * 7 < cells.length; wi++) {
    const week = cells.slice(wi * 7, wi * 7 + 7)
    const barsThisWeek = bars[wi]
    const week7 = week.map((cell, col) => {
      const barsHere = barsThisWeek.filter(b => col >= b.colStart && col < b.colStart + b.colSpan)
      return {
        ...cell,
        barRows: barsHere.length,
        events: cell.events.filter(e => !(e.endDate && !e._merged && barsHere.some(b => b.event.id === e.id)))
      }
    })
    weeks.push(week7)
  }
  return weeks
})
```

- [ ] **Step 3: 執行既有測試確認沒壞**

Run: `npm test -- --run tests/components/CalendarTab.test.js`
Expected: PASS，53 項全過（這步只是多加三個 computed，樣板沒動，畫面渲染邏輯完全沒變）

- [ ] **Step 4: Commit**

```bash
git add src/components/cases/CalendarTab.vue
git commit -m "feat(naiship): 加上跨天事件長條的資料層 computed

multiDayEventLookup／weekEventBars／weekGroups 三個 computed，
先不動樣板，確保純資料層改動不影響既有畫面行為。"
```

---

### Task 3: 樣板改成週列容器 + 疊放長條

**Files:**
- Modify: `src/components/cases/CalendarTab.vue:50-100`（行事曆格子樣板）

- [ ] **Step 1: 修改樣板**

找到目前這段（第 50-100 行，一個大 `grid grid-cols-7` 裝全部 42 格）：

```html
    <!-- Calendar grid -->
    <div class="grid grid-cols-7">
      <div v-for="(cell, i) in calendarCells" :key="i"
        class="border-r border-b border-gray-100 p-1 sm:p-2 min-h-[70px] sm:min-h-[90px]"
        :class="[
          !cell.currentMonth && 'opacity-40',
          cell.isToday && 'bg-amber-50',
          cell.currentMonth && 'cursor-pointer hover:bg-gray-50/50 transition-colors',
          (cell.dateStr === highlightDate && cell.currentMonth) || (dragState && dragOverDateStr === cell.dateStr) ? 'ring-2 ring-inset ring-amber-400' : '',
          pendingAction ? 'hover:ring-2 hover:ring-inset hover:ring-amber-400 cursor-pointer' : ''
        ]"
        :style="!cell.isToday && cell.isNonWorking ? 'background:#F4DCDC' : ''"
        @click="onCellClick(cell)"
        @dragover.prevent="onCellDragOver(cell, $event)"
        @drop.prevent="onCellDrop(cell)">
        <div class="flex items-center gap-1.5">
          <span v-if="cell.isToday"
            class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white flex-shrink-0"
            style="background:#c9a96e">
            {{ cell.day }}
          </span>
          <span v-else-if="cell.dateStr === highlightDate && cell.currentMonth"
            class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white flex-shrink-0"
            style="background:#f59e0b">
            {{ cell.day }}
          </span>
          <span v-else class="text-xs flex-shrink-0"
            :class="cell.isNonWorking ? 'font-bold' : 'text-gray-600'"
            :style="cell.isNonWorking ? 'color:#A34848' : ''">
            {{ cell.day }}
          </span>
          <span v-if="cell.lunarLabel" class="text-[9px] font-medium truncate flex-1 min-w-0"
            :style="cell.isNonWorking ? 'color:#A34848' : 'color:#9ca3af'">
            {{ cell.holidayName ? `${cell.lunarLabel}・${cell.holidayName}` : cell.lunarLabel }}
          </span>
        </div>
        <div v-for="event in cell.events.slice(0, 4)" :key="event.id"
          @click.stop="onEventTap(event, cell.dateStr)"
          :draggable="canDragEvent(event, cell.dateStr)"
          @dragstart="onEventDragStart(event, cell.dateStr, $event)"
          @dragend="onEventDragEnd"
          class="mt-1 h-5 leading-5 text-[11px] rounded-md px-2 truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
          :class="dragState && dragState.event.id === event.id ? 'opacity-50' : ''"
          :style="`background:${eventColor(event.type)}`">
          {{ event.startTime ? `${event.startTime}${event.endTime ? '-' + event.endTime : ''} ` : '' }}{{ event.label }}
        </div>
        <div v-if="cell.events.length > 4" class="mt-1 text-[9px] text-gray-400 truncate">
          還有 {{ cell.events.length - 4 }} 則
        </div>
      </div>
    </div>
```

改成：

```html
    <!-- Calendar grid -->
    <div class="flex flex-col">
      <div v-for="(week, wi) in weekGroups" :key="wi" class="relative grid grid-cols-7">
        <div v-for="cell in week" :key="cell.dateStr"
          class="border-r border-b border-gray-100 p-1 sm:p-2 min-h-[70px] sm:min-h-[90px]"
          :class="[
            !cell.currentMonth && 'opacity-40',
            cell.isToday && 'bg-amber-50',
            cell.currentMonth && 'cursor-pointer hover:bg-gray-50/50 transition-colors',
            (cell.dateStr === highlightDate && cell.currentMonth) || (dragState && dragOverDateStr === cell.dateStr) ? 'ring-2 ring-inset ring-amber-400' : '',
            pendingAction ? 'hover:ring-2 hover:ring-inset hover:ring-amber-400 cursor-pointer' : ''
          ]"
          :style="!cell.isToday && cell.isNonWorking ? 'background:#F4DCDC' : ''"
          @click="onCellClick(cell)"
          @dragover.prevent="onCellDragOver(cell, $event)"
          @drop.prevent="onCellDrop(cell)">
          <div class="flex items-center gap-1.5">
            <span v-if="cell.isToday"
              class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white flex-shrink-0"
              style="background:#c9a96e">
              {{ cell.day }}
            </span>
            <span v-else-if="cell.dateStr === highlightDate && cell.currentMonth"
              class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white flex-shrink-0"
              style="background:#f59e0b">
              {{ cell.day }}
            </span>
            <span v-else class="text-xs flex-shrink-0"
              :class="cell.isNonWorking ? 'font-bold' : 'text-gray-600'"
              :style="cell.isNonWorking ? 'color:#A34848' : ''">
              {{ cell.day }}
            </span>
            <span v-if="cell.lunarLabel" class="text-[9px] font-medium truncate flex-1 min-w-0"
              :style="cell.isNonWorking ? 'color:#A34848' : 'color:#9ca3af'">
              {{ cell.holidayName ? `${cell.lunarLabel}・${cell.holidayName}` : cell.lunarLabel }}
            </span>
          </div>
          <div v-if="cell.barRows" :style="`height:${cell.barRows * 24}px`" class="flex-shrink-0"></div>
          <div v-for="event in cell.events.slice(0, 4)" :key="event.id"
            @click.stop="onEventTap(event, cell.dateStr)"
            :draggable="canDragEvent(event, cell.dateStr)"
            @dragstart="onEventDragStart(event, cell.dateStr, $event)"
            @dragend="onEventDragEnd"
            class="mt-1 h-5 leading-5 text-[11px] rounded-md px-2 truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
            :class="dragState && dragState.event.id === event.id ? 'opacity-50' : ''"
            :style="`background:${eventColor(event.type)}`">
            {{ event.startTime ? `${event.startTime}${event.endTime ? '-' + event.endTime : ''} ` : '' }}{{ event.label }}
          </div>
          <div v-if="cell.events.length > 4" class="mt-1 text-[9px] text-gray-400 truncate">
            還有 {{ cell.events.length - 4 }} 則
          </div>
        </div>
        <div v-for="bar in weekEventBars[wi]" :key="`${wi}-${bar.event.id}-${bar.colStart}`"
          class="absolute h-5 leading-5 text-[11px] rounded-md px-2 truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
          :class="dragState && dragState.event.id === bar.event.id ? 'opacity-50' : ''"
          :style="`top:${36 + bar.row * 24}px; left:calc(${bar.colStart / 7 * 100}% + 8px); width:calc(${bar.colSpan / 7 * 100}% - 16px); background:${eventColor(bar.event.type)}`"
          :draggable="canDragEvent(bar.event, tsToDateStr(bar.event.date))"
          @dragstart="onEventDragStart(bar.event, tsToDateStr(bar.event.date), $event)"
          @dragend="onEventDragEnd"
          @click.stop="onEventTap(bar.event, tsToDateStr(bar.event.date))">
          {{ bar.event.label }}
        </div>
      </div>
    </div>
```

重點說明：
- 外層從「一個 42 格的大 grid」改成「6 個週列」，每個週列自己是 `relative grid grid-cols-7`，長條用 `position:absolute` 疊在這個週列容器裡（不是疊在單一格子裡），`left`/`width` 用百分比對齊到第幾欄
- 每個格子如果這一週有長條經過它（`cell.barRows > 0`），日期數字那一行下面插一個對應高度的空白（`cell.barRows * 24px`），單日事件才會往下接著排，不會被長條蓋住——只有真的被長條蓋到的格子才留白，不是整週統一留白（這是先前農曆功能上線時已經踩過、修過的同一個坑，這次直接照正確的邏輯做，不要重蹈覆轍）
- 長條的點擊/拖曳直接綁 `bar.event`（原始事件物件）跟它自己的起始日期字串，沿用 `onEventTap`／`canDragEvent`／`onEventDragStart` 這幾個既有函式，不用改函式本身
- 單日事件迴圈（`cell.events.slice(0,4)`）跟溢出提示（`還有 N 則`）維持原本寫法，只是資料來源換成 `weekGroups`（已經把長條蓋到的跨天事件濾掉）

- [ ] **Step 2: 執行完整測試套件確認沒有回歸**

Run: `npm test -- --run`
Expected: PASS，全部測試都過，尤其 `tests/components/CalendarTab.test.js` 的 53 項

- [ ] **Step 3: Commit**

```bash
git add src/components/cases/CalendarTab.vue
git commit -m "feat(naiship): 行事曆跨天事件改成長條橫跨多天顯示

有結束日期的事件不再逐日重複顯示，改成長條疊在週列上方，
遇假日/週末自動斷開，點擊/拖曳沿用既有事件互動邏輯。"
```

---

### Task 4: 視覺與互動驗證、build、部署

**Files:** 無新增/修改檔案，純驗證與部署步驟

- [ ] **Step 1: 啟動開發伺服器，Playwright 截圖 + 實際操作驗證**

Run: `npm run dev`（背景執行，記下實際使用的 port，例如 5173）

用 Playwright 對本機開發伺服器（`http://localhost:<port>/cases`）驗證以下項目，逐一截圖：
1. 找一個有跨天請假/重要記事/場勘事件的月份，確認長條橫跨多天顯示、遇假日正確斷開
2. 點擊長條，確認能正常開啟編輯視窗（請假事件開編輯表單、場勘事件開場勘預覽視窗）
3. 拖曳長條到別的日期，確認事件真的被搬移（比照 `naiship-system/tests/e2e/verify-calendar-*.mjs` 既有腳本的測試手法；如果要在正式資料上測拖曳，先用「+新增」建一筆 `ZZTEST-` 開頭的測試事件操作，測完刪乾淨，不要動到真實案場排程）
4. 確認單日事件（沒有結束日期的）還是正常逐格顯示，沒有被誤判成跨天事件

確認排版沒有跑版、長條沒有蓋住日期數字或造成文字重疊後，關閉開發伺服器。

- [ ] **Step 2: 確認 build 成功**

Run: `npm run build`
Expected: 成功產出 `dist/`，無錯誤

- [ ] **Step 3: 等柏確認後部署**

**不要自動執行這步** —— 跟柏確認要部署之後，才執行：

```bash
npm run deploy
```

- [ ] **Step 4: 部署後驗證正式站**

```bash
curl -s https://quotation-system-ddc5c.web.app/ -4 --max-time 10 | grep -o 'assets/index-[^"]*\.js'
```

確認抓到的檔名跟剛才 `npm run build` 產出的 `dist/assets/index-*.js` 檔名一致，再用 Playwright 對正式站截圖確認畫面正確（比照 Task 4 Step 1 的檢查項目），才算完成。

---

## 自我檢查

- **spec 對應**：spec 的每一條要求（跨天事件改長條、遇假日斷開、樣式沿用既有規格、同週最多 2 列、長條可點擊/拖曳、單日事件不受影響）在 Task 1-3 都有對應實作跟測試；「拖放邊緣情況不處理」「超過 2 條退回逐日顯示」在 Task 1 的演算法測試跟 Task 3 的說明裡都有明確體現，不是遺漏
- **無佔位符**：每個 step 都有完整可執行的程式碼或指令
- **型別/命名一致性**：`buildWeekEventBars` 函式簽名、`weekEventBars`／`weekGroups`／`multiDayEventLookup` 這幾個 computed 的命名跟回傳形狀，從 Task 1 到 Task 3 全部一致；`bar.event`／`cell.barRows` 這兩個新欄位名稱在資料層（Task 2）跟樣板（Task 3）用法一致
