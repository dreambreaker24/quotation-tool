<template>
  <div class="ps-app">

    <!-- 左側表單 -->
    <div class="ps-form-panel">
      <div class="ps-app-header">
        <div class="ps-app-title">薪資單產生器</div>
        <div class="ps-app-sub">奈拾室內裝修設計有限公司</div>
      </div>

      <!-- 員工 -->
      <div class="ps-section">
        <div class="ps-section-label">員工</div>
        <div class="ps-field">
          <label>選擇員工</label>
          <select @change="selectEmployee($event.target.value)">
            <option value="">── 選擇員工 ──</option>
            <option v-for="u in usersStore.users" :key="u.id" :value="u.id">
              {{ u.name }} — {{ u.job || '未設定職稱' }}
            </option>
          </select>
        </div>
        <div class="ps-row2">
          <div class="ps-field">
            <label>發薪月份</label>
            <input type="month" v-model="form.payMonth" @input="compute">
          </div>
          <div class="ps-field">
            <label>發薪日</label>
            <input type="text" v-model="form.payDate" placeholder="例：7 月 5 日" @input="compute">
          </div>
        </div>
        <div class="ps-row2">
          <div class="ps-field">
            <label>員工姓名</label>
            <div style="display:flex;align-items:center;gap:8px">
              <span v-if="form.empName"
                style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700"
                :style="`background:${memberColor(form.empName)}`">{{ form.empName[0] }}</span>
              <input type="text" v-model="form.empName" @input="compute" style="flex:1">
            </div>
          </div>
          <div class="ps-field">
            <label>職稱</label>
            <input type="text" v-model="form.empJob" @input="compute" placeholder="自動帶入">
          </div>
        </div>
        <div class="ps-field">
          <label>全名（薪資單列印用）</label>
          <input type="text" v-model="form.empFullName" @input="compute" placeholder="自動帶入">
        </div>
        <button v-if="form.empName" @click="fetchPayrollData" :disabled="bridgeLoading"
          class="ps-record-btn" style="margin-top:8px">
          {{ bridgeLoading ? '帶入中…' : '📥 自動帶入加班/請假/油資' }}
        </button>
      </div>

      <!-- 應付 -->
      <div class="ps-section">
        <div class="ps-section-label">應付項目</div>
        <div class="ps-field">
          <label>薪水</label>
          <input type="number" v-model.number="form.base" min="0" @input="onBaseChange" placeholder="0">
          <span v-if="form.base > 0" class="ps-hint">{{ fmtNum(form.base) }}</span>
        </div>

        <!-- 加班費 -->
        <div class="ps-ot-header">
          <span></span><span class="ps-col-label">時數</span><span class="ps-col-label">金額</span>
        </div>
        <div class="ps-ot-row">
          <span class="ps-ot-label">平日加班費</span>
          <input type="number" v-model.number="form.otWeekdayHours" min="0" step="0.5"
            @input="calcOTFromHours('weekday')" placeholder="0">
          <input type="number" v-model.number="form.otWeekday" min="0" @input="compute" placeholder="0">
        </div>
        <div class="ps-ot-row">
          <span class="ps-ot-label">休息日加班費</span>
          <input type="number" v-model.number="form.otHolidayHours" min="0" step="0.5"
            @input="calcOTFromHours('restday')" placeholder="0">
          <input type="number" v-model.number="form.otHoliday" min="0" @input="compute" placeholder="0">
        </div>

        <!-- 油資 -->
        <div class="ps-ot-header" style="margin-top:6px">
          <span></span><span class="ps-col-label">公里數</span><span class="ps-col-label">金額</span>
        </div>
        <div class="ps-ot-row">
          <span class="ps-ot-label">油資補助</span>
          <input type="number" v-model.number="form.fuelKm" min="0" step="1"
            @input="calcFuel" placeholder="0">
          <input type="number" v-model.number="form.fuel" min="0" @input="compute" placeholder="0">
        </div>

        <div class="ps-field">
          <label>全勤獎金</label>
          <input type="number" v-model.number="form.attend" min="0" @input="compute" placeholder="0">
          <span v-if="form.attend > 0" class="ps-hint">{{ fmtNum(form.attend) }}</span>
        </div>
        <div class="ps-field">
          <label><input type="text" v-model="form.addName1" placeholder="其他加項名稱" @input="compute" class="ps-name-input"></label>
          <input type="number" v-model.number="form.addAmt1" min="0" @input="compute" placeholder="0">
          <span v-if="form.addAmt1 > 0" class="ps-hint">{{ fmtNum(form.addAmt1) }}</span>
        </div>
        <div class="ps-field">
          <label><input type="text" v-model="form.addName2" placeholder="其他加項名稱" @input="compute" class="ps-name-input"></label>
          <input type="number" v-model.number="form.addAmt2" min="0" @input="compute" placeholder="0">
          <span v-if="form.addAmt2 > 0" class="ps-hint">{{ fmtNum(form.addAmt2) }}</span>
        </div>
        <div class="ps-subtotal">應付合計 <strong>{{ fmt(totalAdd) }}</strong></div>
      </div>

      <!-- 扣除 -->
      <div class="ps-section">
        <div class="ps-section-label" style="display:flex;justify-content:space-between;align-items:center">
          扣除項目
          <label class="ps-toggle-wrap">
            <input type="checkbox" v-model="autoIns" @change="onAutoInsChange" class="ps-toggle-check">
            <span class="ps-toggle-track"><span class="ps-toggle-thumb"></span></span>
            <span class="ps-toggle-label">勞健保自動試算</span>
          </label>
        </div>
        <div v-if="autoIns" class="ps-ins-hint">
          勞保投保薪資：<strong>NT$ {{ laborGrade.toLocaleString('zh-TW') }}</strong>（費率 13.5%，員工負擔 20%）<br>
          健保投保金額：<strong>NT$ {{ healthGrade.toLocaleString('zh-TW') }}</strong>（費率 5.17%，員工負擔 30%）
        </div>
        <div class="ps-field">
          <label>勞保（員工負擔）</label>
          <input type="number" v-model.number="form.labor" min="0" @input="compute" placeholder="0">
          <span v-if="form.labor > 0" class="ps-hint">{{ fmtNum(form.labor) }}</span>
        </div>
        <div class="ps-field">
          <label>健保（員工負擔）</label>
          <input type="number" v-model.number="form.health" min="0" @input="compute" placeholder="0">
          <span v-if="form.health > 0" class="ps-hint">{{ fmtNum(form.health) }}</span>
        </div>

        <!-- 請假試算 -->
        <div class="ps-leave-block">
          <div class="ps-leave-title">📅 請假扣款（勞基法）</div>
          <div class="ps-leave-row">
            <span>事假（全薪扣）</span>
            <input type="number" v-model.number="form.personalDays" min="0" step="0.5" @input="calcLeave" placeholder="0">
            <span class="ps-leave-unit">天</span>
            <span class="ps-leave-result">{{ personalDeductPreview }}</span>
          </div>
          <div v-if="ytdTotal && auth.isAdmin" class="ps-leave-ytd" :class="{ 'ps-leave-ytd-over': ytdTotal.personalDays > 14 }">
            本年累計 {{ ytdTotal.personalDays }} / 14 天<span v-if="ytdTotal.personalDays > 14"> ⚠ 超出上限</span>
          </div>
          <div class="ps-leave-row">
            <span>病假（半薪扣）</span>
            <input type="number" v-model.number="form.sickDays" min="0" step="0.5" @input="calcLeave" placeholder="0">
            <span class="ps-leave-unit">天</span>
            <span class="ps-leave-result">{{ sickDeductPreview }}</span>
          </div>
          <div v-if="ytdTotal && auth.isAdmin" class="ps-leave-ytd" :class="{ 'ps-leave-ytd-over': ytdTotal.sickDays > 30 }">
            本年累計 {{ ytdTotal.sickDays }} / 30 天<span v-if="ytdTotal.sickDays > 30"> ⚠ 超出上限</span>
          </div>
          <div class="ps-leave-row">
            <span>颱風假（全薪扣）</span>
            <input type="number" v-model.number="form.typhoonDays" min="0" step="0.5" @input="calcLeave" placeholder="0">
            <span class="ps-leave-unit">天</span>
            <span class="ps-leave-result">{{ typhoonDeductPreview }}</span>
          </div>
          <div class="ps-leave-total">{{ leaveTotalText }}</div>
          <button v-if="auth.isAdmin && form.empName && hasLeave" @click="openConfirmRecord" class="ps-record-btn">
            📋 確認並記錄請假
          </button>
        </div>

        <div class="ps-field">
          <label><input type="text" v-model="form.deductName1" placeholder="其他扣除名稱" @input="compute" class="ps-name-input"></label>
          <input type="number" v-model.number="form.deductAmt1" min="0" @input="compute" placeholder="0">
          <span v-if="form.deductAmt1 > 0" class="ps-hint">{{ fmtNum(form.deductAmt1) }}</span>
        </div>
        <div class="ps-field">
          <label><input type="text" v-model="form.deductName2" placeholder="其他扣除名稱" @input="compute" class="ps-name-input"></label>
          <input type="number" v-model.number="form.deductAmt2" min="0" @input="compute" placeholder="0">
          <span v-if="form.deductAmt2 > 0" class="ps-hint">{{ fmtNum(form.deductAmt2) }}</span>
        </div>
        <div class="ps-subtotal" style="color:#ef4444">扣除合計 <strong>－ {{ fmt(totalDeduct) }}</strong></div>
      </div>

      <!-- 備註 -->
      <div class="ps-section">
        <div class="ps-section-label">備註（選填）</div>
        <textarea v-model="form.remark" @input="compute" placeholder="例：含業績獎金，請妥善保存" class="ps-textarea"></textarea>
      </div>

      <!-- 按鈕 -->
      <div class="ps-btn-row">
        <button class="ps-btn-primary" :disabled="downloading" @click="downloadJpg">
          {{ downloading ? '生成中…' : '↓ 下載 JPG' }}
        </button>
        <button class="ps-btn-ghost" @click="resetForm">清空</button>
      </div>
      <div class="ps-btn-note">下載格式：1/3 A4 橫向（1169 × 2480px）</div>

      <!-- 年度請假記錄 -->
      <div v-if="auth.isAdmin" class="ps-section">
        <div class="ps-section-label">年度請假記錄</div>
        <div class="ps-row2" style="margin-bottom:10px">
          <div class="ps-field">
            <label>員工</label>
            <select v-model="histEmp" @change="loadHistory">
              <option value="">選擇員工</option>
              <option v-for="u in usersStore.users" :key="u.id" :value="u.name">{{ u.name }}</option>
            </select>
          </div>
          <div class="ps-field">
            <label>年度</label>
            <div style="display:flex;gap:6px;align-items:center">
              <select v-model="histYear" @change="loadHistory" style="flex:1">
                <option v-for="y in histYearOptions" :key="y" :value="y">{{ y }}</option>
              </select>
              <button @click="loadHistory" :disabled="!histEmp || histLoading" class="ps-hist-refresh">↻</button>
            </div>
          </div>
        </div>
        <template v-if="histEmp && histRecord !== null">
          <template v-if="sortedHistRecords.length">
            <div v-if="histSummary.personalDays > 0" class="ps-hist-bar-row">
              <span class="ps-hist-label">事假</span>
              <div class="ps-hist-track">
                <div class="ps-hist-fill" :style="`width:${Math.min(histSummary.personalDays/14*100,100)}%;background:#f59e0b`"></div>
              </div>
              <span class="ps-hist-count" :class="{ 'ps-hist-over': histSummary.personalDays > 14 }">{{ histSummary.personalDays }} / 14 天</span>
            </div>
            <div v-if="histSummary.sickDays > 0" class="ps-hist-bar-row">
              <span class="ps-hist-label">病假</span>
              <div class="ps-hist-track">
                <div class="ps-hist-fill" :style="`width:${Math.min(histSummary.sickDays/30*100,100)}%;background:#3b82f6`"></div>
              </div>
              <span class="ps-hist-count" :class="{ 'ps-hist-over': histSummary.sickDays > 30 }">{{ histSummary.sickDays }} / 30 天</span>
            </div>
            <div v-if="histSummary.typhoonDays > 0" class="ps-hist-bar-row">
              <span class="ps-hist-label">颱風假</span>
              <div class="ps-hist-track">
                <div class="ps-hist-fill" :style="`width:100%;background:#8b5cf6`"></div>
              </div>
              <span class="ps-hist-count">{{ histSummary.typhoonDays }} 天</span>
            </div>
            <table class="ps-hist-table">
              <thead><tr><th>月份</th><th>事假</th><th>病假</th><th>颱風假</th><th></th></tr></thead>
              <tbody>
                <tr v-for="r in sortedHistRecords" :key="r.month">
                  <td>{{ r.month }}</td>
                  <td>{{ r.personalDays || '—' }}</td>
                  <td>{{ r.sickDays || '—' }}</td>
                  <td>{{ r.typhoonDays || '—' }}</td>
                  <td><button @click="deleteHistRecord(r.month)" class="ps-hist-del">刪除</button></td>
                </tr>
              </tbody>
            </table>
          </template>
          <div v-else class="ps-hist-empty">{{ histYear }} 年無請假記錄</div>
        </template>
        <div v-else-if="histLoading" class="ps-hist-empty">載入中…</div>
      </div>
    </div>

    <!-- 右側預覽 -->
    <div class="ps-preview-panel">
      <div class="ps-preview-hint">即時預覽 ── 填寫左側後自動更新</div>

      <div id="ps-payslip" ref="slipEl">

        <!-- Header -->
        <div class="sl-header">
          <img class="sl-logo" src="/logo-crop.png" alt="奈拾設計">
          <div class="sl-co-zh">奈拾室內裝修設計有限公司</div>
          <div class="sl-co-en">NEXT PLUS DESIGN CO., LTD.</div>
          <div class="sl-header-bottom">
            <div class="sl-title">薪資明細</div>
            <div class="sl-period">{{ periodText }}<br>發薪日：{{ form.payDate || '—' }}</div>
          </div>
        </div>

        <!-- 員工資訊帶 -->
        <div class="sl-employee">
          <div>
            <div class="sl-job">{{ form.empJob || '職稱' }}</div>
            <div class="sl-name">{{ form.empFullName || form.empName || '員工姓名' }}</div>
          </div>
          <div class="sl-paydate">{{ form.payDate ? `發薪日\n${form.payDate}` : '' }}</div>
        </div>

        <!-- 明細 body -->
        <div class="sl-body">

          <div class="sl-sec-title">應 付 項 目</div>

          <div class="sl-row">
            <span class="sl-row-name">薪水</span>
            <span class="sl-row-amt">{{ fmt(form.base) }}</span>
          </div>
          <div v-if="form.otWeekday > 0" class="sl-row">
            <span class="sl-row-name">{{ form.otWeekdayHours > 0 ? `平日加班費（${form.otWeekdayHours} 小時）` : '平日加班費' }}</span>
            <span class="sl-row-amt">{{ fmt(form.otWeekday) }}</span>
          </div>
          <div v-if="form.otHoliday > 0" class="sl-row">
            <span class="sl-row-name">{{ form.otHolidayHours > 0 ? `休息日加班費（${form.otHolidayHours} 小時）` : '休息日加班費' }}</span>
            <span class="sl-row-amt">{{ fmt(form.otHoliday) }}</span>
          </div>
          <div v-if="form.otWeekday > 0 && form.otHoliday > 0" class="sl-row sl-row-total">
            <span class="sl-row-name">加班費合計</span>
            <span class="sl-row-amt">{{ fmt(form.otWeekday + form.otHoliday) }}</span>
          </div>
          <div v-if="form.fuel > 0" class="sl-row">
            <span class="sl-row-name">{{ form.fuelKm > 0 ? `油資補助（${form.fuelKm} 公里）` : '油資補助' }}</span>
            <span class="sl-row-amt">{{ fmt(form.fuel) }}</span>
          </div>
          <div v-if="form.attend > 0" class="sl-row">
            <span class="sl-row-name">全勤獎金</span>
            <span class="sl-row-amt">{{ fmt(form.attend) }}</span>
          </div>
          <div v-if="form.addAmt1 > 0" class="sl-row">
            <span class="sl-row-name">{{ form.addName1 || '其他加項' }}</span>
            <span class="sl-row-amt">{{ fmt(form.addAmt1) }}</span>
          </div>
          <div v-if="form.addAmt2 > 0" class="sl-row">
            <span class="sl-row-name">{{ form.addName2 || '其他加項' }}</span>
            <span class="sl-row-amt">{{ fmt(form.addAmt2) }}</span>
          </div>

          <div class="sl-subtotal">
            <span>應付小計</span><span>{{ fmt(totalAdd) }}</span>
          </div>

          <div class="sl-sec-title">扣 除 項 目</div>

          <template v-if="totalDeduct === 0">
            <div class="sl-no-deduct">（本月無扣除項目）</div>
          </template>
          <template v-else>
            <div v-if="form.labor > 0" class="sl-row">
              <span class="sl-row-name">勞保（員工負擔）</span>
              <span class="sl-row-amt neg">{{ fmtNeg(form.labor) }}</span>
            </div>
            <div v-if="form.health > 0" class="sl-row">
              <span class="sl-row-name">健保（員工負擔）</span>
              <span class="sl-row-amt neg">{{ fmtNeg(form.health) }}</span>
            </div>
            <div v-if="pDeduct > 0" class="sl-row">
              <span class="sl-row-name">事假（{{ form.personalDays }} 天）</span>
              <span class="sl-row-amt neg">{{ fmtNeg(pDeduct) }}</span>
            </div>
            <div v-if="sDeduct > 0" class="sl-row">
              <span class="sl-row-name">病假（{{ form.sickDays }} 天）</span>
              <span class="sl-row-amt neg">{{ fmtNeg(sDeduct) }}</span>
            </div>
            <div v-if="tDeduct > 0" class="sl-row">
              <span class="sl-row-name">颱風假（{{ form.typhoonDays }} 天）</span>
              <span class="sl-row-amt neg">{{ fmtNeg(tDeduct) }}</span>
            </div>
            <div v-if="[pDeduct, sDeduct, tDeduct].filter(v => v > 0).length >= 2" class="sl-row sl-row-total">
              <span class="sl-row-name">請假扣款合計</span>
              <span class="sl-row-amt neg">{{ fmtNeg(pDeduct + sDeduct + tDeduct) }}</span>
            </div>
            <div v-if="form.deductAmt1 > 0" class="sl-row">
              <span class="sl-row-name">{{ form.deductName1 || '其他扣除' }}</span>
              <span class="sl-row-amt neg">{{ fmtNeg(form.deductAmt1) }}</span>
            </div>
            <div v-if="form.deductAmt2 > 0" class="sl-row">
              <span class="sl-row-name">{{ form.deductName2 || '其他扣除' }}</span>
              <span class="sl-row-amt neg">{{ fmtNeg(form.deductAmt2) }}</span>
            </div>
            <div class="sl-subtotal" style="color:#ef4444">
              <span>扣除小計</span><span>－ {{ fmt(totalDeduct) }}</span>
            </div>
          </template>

        </div>

        <!-- 實發 -->
        <div class="sl-net-block">
          <div class="sl-net-label">本月實發金額</div>
          <div class="sl-net-amount">{{ fmt(Math.ceil(totalAdd - totalDeduct)) }}</div>
        </div>

        <!-- 雇主提撥 -->
        <div v-if="form.base > 0" class="sl-contrib">
          <span class="sl-contrib-label">公司提撥勞退（供員工參考）</span>
          <div class="sl-contrib-right">
            <div class="sl-contrib-amt">{{ fmt(Math.round(form.base * 0.06)) }}</div>
            <div class="sl-contrib-note">月薪 × 6%</div>
          </div>
        </div>

        <!-- 備註 -->
        <div v-if="form.remark" class="sl-remark">
          <div class="sl-remark-title">備 註</div>
          <div class="sl-remark-body">{{ form.remark }}</div>
        </div>

        <!-- Footer -->
        <div class="sl-footer">
          <div class="sl-seal">奈拾</div>
          <div class="sl-footer-note">本薪資單由系統自動生成<br>如有疑問請洽公司財務</div>
        </div>

      </div>
    </div>

    <!-- 確認記錄請假彈窗 -->
    <div v-if="showConfirmRecord" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
        <h3 class="text-sm font-bold text-gray-800 mb-4">確認請假記錄 — {{ form.empName }}（{{ form.payMonth }}）</h3>
        <div class="text-xs text-gray-600 space-y-1 mb-4">
          <div>事假：{{ form.personalDays }} 天</div>
          <div>病假：{{ form.sickDays }} 天</div>
          <div>颱風假：{{ form.typhoonDays }} 天</div>
        </div>
        <div v-if="otSnapshotMonth !== form.payMonth" class="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
          ⚠ 這個月的加班尚未結算（月結機制要等到下個月才會產生快照），加班費可能不完整
        </div>
        <div v-if="alreadyRecordedThisMonth" class="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">
          ⚠ 這個月已經記錄過，確認會覆蓋原本的記錄
        </div>
        <div class="flex justify-end gap-2">
          <button @click="showConfirmRecord = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
          <button @click="confirmRecordLeave" :disabled="recording" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">
            {{ recording ? '儲存中…' : '確認記錄' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import html2canvas from 'html2canvas'
import { useLeaveRecordsStore } from '@/stores/leaveRecords'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useWorkLogsStore } from '@/stores/workLogs'
import { useCalendarEventsStore } from '@/stores/calendarEvents'
import { useToast } from '@/composables/useToast'
import { memberColor } from '@/utils/memberColor'
import { hoursToDays } from '@/utils/leaveConversion'

const slipEl = ref(null)
const downloading = ref(false)
const autoIns = ref(false)
const auth = useAuthStore()
const leaveStore = useLeaveRecordsStore()
const usersStore = useUsersStore()
const workLogsStore = useWorkLogsStore()
const calendarEventsStore = useCalendarEventsStore()
const { toast } = useToast()
const ytdRecord = ref(null)
const ytdLoading = ref(false)
const recording = ref(false)
const histEmp = ref('')
const histYear = ref(new Date().getFullYear())
const histRecord = ref(null)
const histLoading = ref(false)
const bridgeLoading = ref(false)
const pendingLeaveEntries = ref([])
const otSnapshotMonth = ref(null)
const showConfirmRecord = ref(false)
const alreadyRecordedThisMonth = ref(false)

onMounted(() => {
    usersStore.subscribe()
    loadForm()
    compute()
})

function selectEmployee(uid) {
    if (!uid) return
    const u = usersStore.users.find(u => u.id === uid)
    if (!u) return
    form.value.empName = u.name
    form.value.empFullName = u.fullName || u.name
    form.value.empJob  = u.job || ''
    form.value.base    = u.salary || 0
    autoIns.value = true
    onBaseChange()
}

/* ── 表單狀態 ── */
const INIT_FORM = () => ({
    payMonth: new Date().toISOString().slice(0, 7),
    payDate: '', empName: '', empFullName: '', empJob: '', base: 0,
    otWeekdayHours: 0, otWeekday: 0,
    otHolidayHours: 0, otHoliday: 0,
    fuelKm: 0, fuel: 0, attend: 0,
    addName1: '', addAmt1: 0, addName2: '', addAmt2: 0,
    labor: 0, health: 0,
    personalDays: 0, sickDays: 0, typhoonDays: 0,
    deductName1: '', deductAmt1: 0, deductName2: '', deductAmt2: 0,
    remark: ''
})
const form = ref(INIT_FORM())

function saveForm() {
    localStorage.setItem('ps_form_v1', JSON.stringify(form.value))
}
function loadForm() {
    const saved = JSON.parse(localStorage.getItem('ps_form_v1') || 'null')
    if (saved) Object.assign(form.value, saved)
}
function resetForm() {
    if (!confirm('確定要清空所有欄位？')) return
    form.value = INIT_FORM()
    autoIns.value = false
    saveForm()
}

/* ── 勞健保級距 ── */
const LABOR_GRADES  = [27470,28800,30300,31800,33300,34800,36300,38200,40100,42000,43900,45800]
const HEALTH_GRADES = [27470,28800,30300,31800,33300,34800,36300,38200,40100,42000,43900,45800,
    48200,50600,53000,55400,57800,60800,63800,66800,72800,83300,104500,131700,157000,219500]

function getGrade(salary, table) {
    const max = table[table.length - 1]
    if (salary >= max) return max
    return table.find(g => g >= salary) ?? max
}

const laborGrade  = computed(() => getGrade(form.value.base, LABOR_GRADES))
const healthGrade = computed(() => getGrade(form.value.base, HEALTH_GRADES))

function calcAutoIns() {
    form.value.labor  = Math.round(laborGrade.value  * 0.135 * 0.2) || 0
    form.value.health = Math.round(healthGrade.value * 0.0517 * 0.3) || 0
}

function onAutoInsChange() {
    if (autoIns.value) calcAutoIns()
    compute()
}

function onBaseChange() {
    if (autoIns.value) calcAutoIns()
    calcOTFromHours('weekday')
    calcOTFromHours('restday')
    calcLeave()
    compute()
}

/* ── 加班費 ── */
function calcOTFromHours(type) {
    const base = form.value.base
    const hours = type === 'weekday' ? (form.value.otWeekdayHours || 0) : (form.value.otHolidayHours || 0)
    if (hours === 0) {
        if (type === 'weekday') form.value.otWeekday = 0
        else                    form.value.otHoliday = 0
    } else if (base > 0) {
        const hourly = base / 240
        let pay = 0
        if (type === 'weekday') {
            pay = Math.min(hours, 2) * hourly * (4/3) + Math.max(hours - 2, 0) * hourly * (5/3)
        } else {
            pay = Math.min(hours, 2) * hourly * (4/3)
                + Math.min(Math.max(hours - 2, 0), 6) * hourly * (5/3)
                + Math.max(hours - 8, 0) * hourly * (8/3)
        }
        if (type === 'weekday') form.value.otWeekday = Math.round(pay)
        else                    form.value.otHoliday = Math.round(pay)
    }
    compute()
}

/* ── 油資 ── */
function calcFuel() {
    const km = form.value.fuelKm || 0
    form.value.fuel = km > 0 ? km * 6 : 0
    compute()
}

/* ── 請假 ── */
const pDeduct = computed(() => {
    const base = form.value.base
    return base > 0 ? Math.round((form.value.personalDays || 0) * base / 30) : 0
})
const sDeduct = computed(() => {
    const base = form.value.base
    return base > 0 ? Math.round((form.value.sickDays || 0) * base / 30 * 0.5) : 0
})
const tDeduct = computed(() => {
    const base = form.value.base
    return base > 0 ? Math.round((form.value.typhoonDays || 0) * base / 30) : 0
})
const personalDeductPreview = computed(() =>
    pDeduct.value > 0 ? `扣 NT$ ${pDeduct.value.toLocaleString('zh-TW')}` : ''
)
const sickDeductPreview = computed(() =>
    sDeduct.value > 0 ? `扣 NT$ ${sDeduct.value.toLocaleString('zh-TW')}` : ''
)
const typhoonDeductPreview = computed(() =>
    tDeduct.value > 0 ? `扣 NT$ ${tDeduct.value.toLocaleString('zh-TW')}` : ''
)
const leaveTotalText = computed(() => {
    const t = pDeduct.value + sDeduct.value + tDeduct.value
    return t > 0 ? `合計扣 NT$ ${t.toLocaleString('zh-TW')}` : (form.value.base > 0 ? '無扣款' : '請先填薪水')
})

function calcLeave() { compute() }

/* ── 自動帶入加班/請假/油資 ── */
const REMARK_MARKER_START = '=== 加班/請假明細（自動產生）==='
const REMARK_MARKER_END = '=== 明細結束 ==='

function fmtMD(date) {
    if (!date) return ''
    return `${date.getMonth() + 1}/${date.getDate()}`
}

function buildAutoRemark(entries, otWeekdayHrs, otHolidayHrs) {
    const lines = entries.map(e => `${fmtMD(e.date)} ${e.leaveType} ${e.hours}h`)
    if (otWeekdayHrs > 0) lines.push(`平日補休 ${otWeekdayHrs}h 已轉入加班費`)
    if (otHolidayHrs > 0) lines.push(`休息日補休 ${otHolidayHrs}h 已轉入加班費`)
    const block = lines.length ? `${REMARK_MARKER_START}\n${lines.join('\n')}\n${REMARK_MARKER_END}` : ''
    const startIdx = form.value.remark.indexOf(REMARK_MARKER_START)
    const manualPart = startIdx === -1 ? form.value.remark : form.value.remark.slice(0, startIdx).trimEnd()
    form.value.remark = block ? `${manualPart ? manualPart + '\n\n' : ''}${block}` : manualPart
}

async function fetchPayrollData() {
    if (!form.value.empName || !form.value.payMonth) { toast('請先選擇員工', 'error'); return }
    const targetName = form.value.empName
    const targetMonth = form.value.payMonth
    const [y, m] = form.value.payMonth.split('-').map(Number)
    const monthIdx = m - 1
    bridgeLoading.value = true
    try {
        const uid = usersStore.users.find(u => u.name === form.value.empName)?.id
        if (!uid) { toast('找不到對應的員工帳號', 'error'); return }
        await usersStore.ensureMonthClosed(uid)
        const [closing, kmMap, leaveEntries] = await Promise.all([
            usersStore.getClosingBalance(uid, form.value.payMonth),
            workLogsStore.fetchMonthlyKm(y, monthIdx),
            calendarEventsStore.fetchMonthlyLeaveDetail(y, monthIdx, form.value.empName),
        ])
        if (form.value.empName !== targetName || form.value.payMonth !== targetMonth) return
        otSnapshotMonth.value = closing ? form.value.payMonth : null
        form.value.otWeekdayHours = closing?.weekdayHours || 0
        form.value.otHolidayHours = closing?.holidayHours || 0
        calcOTFromHours('weekday')
        calcOTFromHours('restday')
        form.value.fuelKm = kmMap[form.value.empName] || 0
        calcFuel()
        const personalHours = leaveEntries.filter(e => ['事假', '臨請'].includes(e.leaveType)).reduce((s, e) => s + e.hours, 0)
        const sickHours = leaveEntries.filter(e => e.leaveType === '病假').reduce((s, e) => s + e.hours, 0)
        form.value.personalDays = hoursToDays(personalHours)
        form.value.sickDays = hoursToDays(sickHours)
        calcLeave()
        pendingLeaveEntries.value = leaveEntries
        buildAutoRemark(leaveEntries, form.value.otWeekdayHours, form.value.otHolidayHours)
        compute()
        toast(closing ? '已自動帶入加班/請假/油資資料' : '已帶入請假/油資，該月加班尚未結算（下個月才會有數字）')
    } catch {
        toast('自動帶入失敗，請重試', 'error')
    } finally {
        bridgeLoading.value = false
    }
}

/* ── 年度累積請假 ── */
const currentYear = computed(() => {
    const [y] = (form.value.payMonth || '').split('-')
    return y ? parseInt(y) : new Date().getFullYear()
})

const ytdSummaryExcludingMonth = computed(() => {
    if (!ytdRecord.value || !form.value.empName) return null
    const month = form.value.payMonth
    const recs = (ytdRecord.value.records ?? []).filter(r => r.month !== month)
    return {
        sickDays: recs.reduce((s, r) => s + (r.sickDays || 0), 0),
        personalDays: recs.reduce((s, r) => s + (r.personalDays || 0), 0),
        typhoonDays: recs.reduce((s, r) => s + (r.typhoonDays || 0), 0),
    }
})

const ytdTotal = computed(() => {
    if (!ytdSummaryExcludingMonth.value) return null
    return {
        sickDays: ytdSummaryExcludingMonth.value.sickDays + (form.value.sickDays || 0),
        personalDays: ytdSummaryExcludingMonth.value.personalDays + (form.value.personalDays || 0),
        typhoonDays: ytdSummaryExcludingMonth.value.typhoonDays + (form.value.typhoonDays || 0),
    }
})

const hasLeave = computed(() =>
    (form.value.personalDays || 0) > 0 || (form.value.sickDays || 0) > 0 || (form.value.typhoonDays || 0) > 0
)

async function fetchYtd() {
    if (!form.value.empName) { ytdRecord.value = null; return }
    ytdLoading.value = true
    ytdRecord.value = await leaveStore.fetchRecord(currentYear.value, form.value.empName)
    ytdLoading.value = false
}

watch(() => [form.value.empName, currentYear.value], fetchYtd, { immediate: true })

async function recordLeave() {
    if (!form.value.empName || !hasLeave.value) return
    recording.value = true
    try {
        await leaveStore.saveRecord(
            currentYear.value,
            form.value.empName,
            form.value.payMonth,
            { sickDays: form.value.sickDays || 0, personalDays: form.value.personalDays || 0, typhoonDays: form.value.typhoonDays || 0 },
            auth.name
        )
        await fetchYtd()
        if (histEmp.value === form.value.empName && histYear.value === currentYear.value) {
            await loadHistory()
        }
        toast('請假記錄已儲存')
    } catch {
        toast('儲存失敗', 'error')
    }
    recording.value = false
}

async function openConfirmRecord() {
    if (!form.value.empName || !hasLeave.value) { toast('沒有請假資料可以記錄', 'error'); return }
    const existing = await leaveStore.fetchRecord(currentYear.value, form.value.empName)
    alreadyRecordedThisMonth.value = (existing.records ?? []).some(r => r.month === form.value.payMonth)
    showConfirmRecord.value = true
}

async function confirmRecordLeave() {
    await recordLeave()
    showConfirmRecord.value = false
}

const histYearOptions = computed(() => { const y = new Date().getFullYear(); return [y, y - 1, y - 2] })
const histSummary = computed(() => leaveStore.summarize(histRecord.value))
const sortedHistRecords = computed(() =>
    [...(histRecord.value?.records ?? [])].sort((a, b) => a.month.localeCompare(b.month))
)

async function loadHistory() {
    if (!histEmp.value) { histRecord.value = null; return }
    histLoading.value = true
    histRecord.value = await leaveStore.fetchRecord(histYear.value, histEmp.value)
    histLoading.value = false
}

async function deleteHistRecord(month) {
    if (!confirm(`確定刪除 ${month} 的請假記錄？`)) return
    await leaveStore.deleteMonthRecord(histYear.value, histEmp.value, month)
    await loadHistory()
    toast('已刪除')
}

/* ── 合計 ── */
const totalAdd = computed(() =>
    (form.value.base || 0) + (form.value.otWeekday || 0) + (form.value.otHoliday || 0)
    + (form.value.fuel || 0) + (form.value.attend || 0)
    + (form.value.addAmt1 || 0) + (form.value.addAmt2 || 0)
)
const totalDeduct = computed(() =>
    (form.value.labor || 0) + (form.value.health || 0)
    + pDeduct.value + sDeduct.value + tDeduct.value
    + (form.value.deductAmt1 || 0) + (form.value.deductAmt2 || 0)
)

/* ── 月份文字 ── */
const periodText = computed(() => {
    const v = form.value.payMonth
    if (!v) return '— 年 — 月份'
    const [y, m] = v.split('-')
    return `${y} 年 ${parseInt(m)} 月份`
})

/* ── 工具 ── */
function fmt(n)    { return 'NT$ ' + (n || 0).toLocaleString('zh-TW') }
function fmtNeg(n) { return '－ NT$ ' + (n || 0).toLocaleString('zh-TW') }
function fmtNum(n) { return 'NT$ ' + (n || 0).toLocaleString('zh-TW') }

function compute() {
    saveForm()
}

/* ── 下載 ── */
async function downloadJpg() {
    if (!slipEl.value) return
    downloading.value = true
    try {
        const outW = 1169, outH = 2480
        const renderScale = outW / slipEl.value.offsetWidth

        // onclone 裡烘焙光暈：在截圖前替換 logo img，讓 html2canvas 直接截到含光暈的版本
        // 用大 canvas（加 padding）+ negative margin，讓光暈有空間展開且不影響佈局
        const slipCanvas = await html2canvas(slipEl.value, {
            scale: renderScale, useCORS: true, backgroundColor: '#ffffff', logging: false,
            onclone: (cloneDoc, cloneEl) => {
                const cloneLogo = cloneEl.querySelector('.sl-logo')
                if (!cloneLogo) return
                const dw = cloneLogo.offsetWidth
                const dh = cloneLogo.offsetHeight
                if (!dw || !dh) return

                const pad = 100  // 大於最大 shadowBlur(100)，讓光暈不被 canvas 截斷
                const c = cloneDoc.createElement('canvas')
                c.width  = (dw + pad * 2) * renderScale
                c.height = (dh + pad * 2) * renderScale
                const cctx = c.getContext('2d')
                cctx.scale(renderScale, renderScale)
                cctx.shadowColor = 'rgba(201,169,110,0.5)'; cctx.shadowBlur = 100; cctx.drawImage(cloneLogo, pad, pad, dw, dh)
                cctx.shadowColor = 'rgba(201,169,110,0.9)'; cctx.shadowBlur = 55;  cctx.drawImage(cloneLogo, pad, pad, dw, dh)
                cctx.shadowColor = 'rgba(255,220,150,1)';   cctx.shadowBlur = 22;  cctx.drawImage(cloneLogo, pad, pad, dw, dh)
                cctx.shadowColor = 'rgba(255,255,255,1)';   cctx.shadowBlur = 6;   cctx.drawImage(cloneLogo, pad, pad, dw, dh)
                cctx.shadowBlur = 0; cctx.drawImage(cloneLogo, pad, pad, dw, dh)

                cloneLogo.src          = c.toDataURL('image/png')
                cloneLogo.style.filter = 'none'
                cloneLogo.style.width  = `${dw + pad * 2}px`
                cloneLogo.style.height = `${dh + pad * 2}px`
                cloneLogo.style.margin = `-${pad}px`
            }
        })

        // 輸出 canvas 1169 × 2480
        const outCanvas = document.createElement('canvas')
        outCanvas.width  = outW
        outCanvas.height = outH
        const ctx = outCanvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, outW, outH)

        const fitScale = Math.min(outW / slipCanvas.width, outH / slipCanvas.height)
        const drawW = Math.round(slipCanvas.width  * fitScale)
        const drawH = Math.round(slipCanvas.height * fitScale)
        const offX  = Math.round((outW - drawW) / 2)
        ctx.drawImage(slipCanvas, offX, 0, drawW, drawH)

        // 浮水印：中央 LOGO 10% 透明度疊加（同報價單做法）
        const wmImg = new Image()
        wmImg.src = '/logo-wm.png'
        await new Promise(r => { if (wmImg.complete && wmImg.naturalWidth) r(); else { wmImg.onload = r; wmImg.onerror = r } })
        if (wmImg.naturalWidth) {
            const wmW = drawW * 0.62
            const wmH = wmW * wmImg.naturalHeight / wmImg.naturalWidth
            ctx.save()
            ctx.globalAlpha = 0.10
            ctx.drawImage(wmImg, offX + (drawW - wmW) / 2, (drawH - wmH) / 2, wmW, wmH)
            ctx.restore()
        }

        // 日期浮水印（右下角）
        const ts = new Date().toLocaleString('zh-TW', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        })
        const fs = Math.round(outW * 0.03)
        ctx.font = `${fs}px "Microsoft JhengHei", sans-serif`
        ctx.textAlign = 'right'
        ctx.fillStyle = 'rgba(160,154,144,0.5)'
        ctx.fillText(`產生於 ${ts}`, outW - fs * 0.5, outH - fs * 0.8)

        const [y, m]   = (form.value.payMonth || '').split('-')
        const filename = `薪資單_${form.value.empName || '員工'}_${(y||'')+(m||'')}.jpg`
        const blob = await new Promise(r => outCanvas.toBlob(r, 'image/jpeg', 0.95))

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    startIn: 'desktop',
                    types: [{ description: 'JPEG 圖片', accept: { 'image/jpeg': ['.jpg'] } }]
                })
                const writable = await handle.createWritable()
                await writable.write(blob)
                await writable.close()
            } catch (err) {
                if (err.name !== 'AbortError') throw err
            }
        } else {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.download = filename; a.href = url; a.click()
            URL.revokeObjectURL(url)
        }
    } catch (e) {
        alert('生成失敗：' + e.message)
    }
    downloading.value = false
}
</script>

<style scoped>
/* ── 整體佈局 ── */
.ps-app { display:flex; gap:0; min-height:calc(100vh - 56px); background:#f4f3ef; }
.ps-form-panel {
    width:440px; flex-shrink:0; background:#fff;
    border-right:1px solid #ebe9e3;
    overflow-y:auto; padding:0 0 32px; position:sticky; top:56px; max-height:calc(100vh - 56px);
}
.ps-preview-panel { flex:1; padding:24px 32px; display:flex; flex-direction:column; align-items:center; gap:16px; }

/* ── 表單 header ── */
.ps-app-header { background:#1e2533; padding:20px 24px 16px; }
.ps-app-title  { font-size:16px; font-weight:700; color:#c9a96e; }
.ps-app-sub    { font-size:11px; color:rgba(255,255,255,0.45); margin-top:3px; }

/* ── Section ── */
.ps-section { padding:16px 20px; border-bottom:1px solid #ebe9e3; }
.ps-section-label { font-size:10px; font-weight:700; color:#c9a96e; letter-spacing:1.5px; margin-bottom:10px; }

/* ── Fields ── */
.ps-field { display:flex; flex-direction:column; gap:3px; margin-bottom:8px; }
.ps-field label { font-size:11px; color:#6b7280; }
.ps-field input, .ps-field select, .ps-field textarea {
    padding:7px 10px; border:1px solid #e5e7eb; border-radius:6px;
    font-size:13px; font-family:inherit; background:#fafaf8; outline:none;
}
.ps-field input:focus, .ps-field select:focus { border-color:#c9a96e; }
.ps-hint { font-size:10px; color:#c9a96e; text-align:right; }
.ps-row2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }

/* ── 加班費三欄 ── */
.ps-ot-header { display:grid; grid-template-columns:1fr 62px 110px; gap:6px; margin-bottom:3px; }
.ps-col-label  { font-size:10px; color:#9ca3af; text-align:right; }
.ps-ot-row    { display:grid; grid-template-columns:1fr 62px 110px; gap:6px; margin-bottom:6px; align-items:center; }
.ps-ot-label  { font-size:12px; color:#4b5563; }
.ps-ot-row input {
    padding:6px 8px; border:1px solid #e5e7eb; border-radius:6px;
    font-size:12px; font-family:inherit; text-align:right;
}
.ps-ot-row input:focus { border-color:#c9a96e; outline:none; }

/* ── 請假試算 ── */
.ps-leave-ytd { font-size:10px; color:#9ca3af; padding:0 0 5px 96px; margin-top:-3px; }
.ps-leave-ytd-over { color:#ef4444; font-weight:600; }
.ps-record-btn {
    display:block; width:100%; margin-top:8px;
    background:linear-gradient(135deg,#c9a96e,#b8955a); color:#fff;
    border:none; border-radius:8px; padding:7px 0; font-size:11px; font-weight:600;
    cursor:pointer; letter-spacing:0.5px;
}
.ps-record-btn:disabled { opacity:0.5; cursor:not-allowed; }
.ps-hist-bar-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.ps-hist-label { font-size:10px; color:#6b7280; width:36px; flex-shrink:0; }
.ps-hist-track { flex:1; height:6px; background:#f3f4f6; border-radius:3px; overflow:hidden; }
.ps-hist-fill { height:100%; border-radius:3px; transition:width 0.3s; }
.ps-hist-count { font-size:10px; color:#374151; width:52px; text-align:right; flex-shrink:0; }
.ps-hist-over { color:#ef4444; font-weight:700; }
.ps-hist-table { width:100%; font-size:11px; border-collapse:collapse; margin-top:10px; }
.ps-hist-table th { text-align:center; color:#9ca3af; padding:4px 6px; border-bottom:1px solid #ebe9e3; font-weight:600; }
.ps-hist-table td { text-align:center; color:#374151; padding:5px 6px; border-bottom:1px solid #f3f4f6; }
.ps-hist-table td:first-child { text-align:left; color:#6b7280; }
.ps-hist-del { font-size:10px; color:#ef4444; background:none; border:1px solid #fecaca; border-radius:4px; padding:2px 6px; cursor:pointer; }
.ps-hist-del:hover { background:#fef2f2; }
.ps-hist-empty { font-size:11px; color:#9ca3af; text-align:center; padding:16px 0; }
.ps-hist-refresh { font-size:13px; color:#9ca3af; background:none; border:1px solid #e5e7eb; border-radius:6px; padding:3px 8px; cursor:pointer; flex-shrink:0; }
.ps-hist-refresh:hover:not(:disabled) { border-color:#c9a96e; color:#c9a96e; }
.ps-hist-refresh:disabled { opacity:0.4; cursor:not-allowed; }
.ps-leave-block {
    background:#f8f7f4; border:1px solid #eeebe4; border-radius:7px;
    padding:10px 12px; margin-bottom:8px;
}
.ps-leave-title { font-size:10px; font-weight:700; color:#c9a96e; letter-spacing:1px; margin-bottom:8px; }
.ps-leave-row   { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
.ps-leave-row span:first-child { font-size:11px; color:#6b7280; width:90px; flex-shrink:0; }
.ps-leave-row input {
    width:60px; padding:5px 7px; border:1px solid #e5e7eb; border-radius:5px;
    font-size:12px; text-align:right; font-family:inherit;
}
.ps-leave-row input:focus { border-color:#c9a96e; outline:none; }
.ps-leave-unit   { font-size:11px; color:#9ca3af; }
.ps-leave-result { font-size:11px; color:#c9a96e; flex:1; text-align:right; }
.ps-leave-total  { font-size:12px; color:#c9a96e; font-weight:600; text-align:right; margin-top:6px; padding-top:6px; border-top:1px dashed #eeebe4; }

/* ── 名稱 input（inline label） ── */
.ps-name-input {
    width:100%; padding:5px 8px; border:1px solid #e5e7eb; border-radius:5px;
    font-size:12px; font-family:inherit;
}
.ps-name-input:focus { border-color:#c9a96e; outline:none; }

/* ── 小計 ── */
.ps-subtotal { text-align:right; font-size:12px; color:#6b7280; padding-top:6px; border-top:1px solid #ebe9e3; margin-top:4px; }
.ps-subtotal strong { color:#1e2533; font-size:13px; margin-left:8px; }

/* ── 勞健保 toggle ── */
.ps-toggle-wrap  { display:flex; align-items:center; gap:6px; cursor:pointer; }
.ps-toggle-check { display:none; }
.ps-toggle-track {
    width:32px; height:18px; border-radius:9px; background:#e5e7eb;
    position:relative; transition:background 0.2s;
}
.ps-toggle-check:checked + .ps-toggle-track { background:#c9a96e; }
.ps-toggle-thumb {
    width:14px; height:14px; border-radius:50%; background:#fff;
    position:absolute; top:2px; left:2px; transition:left 0.2s;
}
.ps-toggle-check:checked + .ps-toggle-track .ps-toggle-thumb { left:16px; }
.ps-toggle-label { font-size:11px; color:#6b7280; }
.ps-ins-hint {
    font-size:11px; color:#6b7280; background:#f8f7f4;
    border:1px solid #eeebe4; border-radius:6px; padding:8px 10px;
    margin-bottom:10px; line-height:1.6;
}

/* ── Textarea ── */
.ps-textarea { width:100%; resize:vertical; min-height:60px; font-size:13px; font-family:inherit; }

/* ── 按鈕 ── */
.ps-btn-row { display:flex; gap:8px; padding:16px 20px 4px; }
.ps-btn-primary {
    flex:1; padding:10px; border:none; border-radius:8px;
    background:#1e2533; color:#c9a96e; font-size:13px; font-weight:700;
    cursor:pointer; font-family:inherit; transition:opacity 0.15s;
}
.ps-btn-primary:hover { opacity:0.85; }
.ps-btn-primary:disabled { opacity:0.5; cursor:default; }
.ps-btn-ghost {
    padding:10px 16px; border:1px solid #e5e7eb; border-radius:8px;
    background:#fff; color:#6b7280; font-size:13px; cursor:pointer; font-family:inherit;
}
.ps-btn-ghost:hover { border-color:#c9a96e; color:#c9a96e; }
.ps-btn-note { font-size:10px; color:#b0a99a; text-align:center; padding:0 20px 8px; }

/* ── 預覽提示 ── */
.ps-preview-hint { font-size:11px; color:#b0a99a; }

/* ════════════════════════════
   薪 資 單 本 體
════════════════════════════ */
#ps-payslip {
    width:560px; background:white; border-radius:10px;
    overflow:hidden; box-shadow:0 8px 36px rgba(30,37,51,0.2);
    font-family:'Microsoft JhengHei','PingFang TC','Noto Sans TC',sans-serif;
}

/* Header */
.sl-header {
    background:#1e2533; padding:20px 24px 14px;
    display:flex; flex-direction:column; align-items:center;
}
.sl-logo {
    width:300px; height:auto; object-fit:contain; display:block;
    filter:
        drop-shadow(0 0 6px rgba(255,255,255,1))
        drop-shadow(0 0 22px rgba(255,220,150,1))
        drop-shadow(0 0 55px rgba(201,169,110,0.9))
        drop-shadow(0 0 100px rgba(201,169,110,0.5));
    margin-bottom:10px;
}
.sl-co-zh { font-size:13px; font-weight:700; color:#fff; letter-spacing:1px; margin-bottom:3px; }
.sl-co-en { font-size:9px; color:rgba(255,255,255,0.45); letter-spacing:2px; margin-bottom:10px; }
.sl-header-bottom { display:flex; justify-content:space-between; align-items:center; width:100%; }
.sl-title  { font-size:18px; font-weight:900; color:#c9a96e; letter-spacing:4px; }
.sl-period { font-size:10px; color:rgba(255,255,255,0.5); text-align:right; line-height:1.6; }

/* 員工帶 */
.sl-employee {
    background:#f8f7f4; padding:12px 24px;
    display:flex; justify-content:space-between; align-items:center;
    border-bottom:2px solid #e8e4dc;
}
.sl-job  { font-size:13px; font-weight:600; color:#c9a96e; margin-bottom:3px; }
.sl-name { font-size:22px; font-weight:800; color:#1e2533; }
.sl-paydate { font-size:11px; color:#b5afa6; text-align:right; white-space:pre-line; line-height:1.5; }

/* Body */
.sl-body { padding:15px 24px 4px; }
.sl-sec-title {
    font-size:20px; font-weight:800; color:#c9a96e;
    letter-spacing:2px; margin-bottom:8px;
    display:flex; align-items:center; gap:6px;
}
.sl-sec-title::before {
    content:''; display:inline-block;
    width:3px; height:16px; border-radius:2px; background:#c9a96e;
}
.sl-row { display:flex; justify-content:space-between; padding:5px 0; font-size:14px; }
.sl-row-name { color:#4b5563; }
.sl-row-amt  { color:#1e2533; font-weight:600; }
.sl-row-amt.neg { color:#ef4444; }
.sl-row-total {
    border-top:1px dashed rgba(30,37,51,0.12);
    margin-top:3px; padding-top:5px; font-weight:600;
}
.sl-subtotal {
    display:flex; justify-content:space-between;
    font-size:12px; color:#6b7280; font-weight:600;
    padding:8px 0; margin:4px 0 12px;
    border-top:1px solid #e8e4dc; border-bottom:1px solid #e8e4dc;
}
.sl-no-deduct { font-size:12px; color:#9ca3af; padding:8px 0 16px; text-align:center; }

/* 實發 */
.sl-net-block {
    background:linear-gradient(135deg,#1e2533 0%,#2c3649 100%);
    padding:20px 24px; text-align:center;
}
.sl-net-label  { font-size:12px; color:rgba(255,255,255,0.5); margin-bottom:6px; }
.sl-net-amount {
    font-size:26px; font-weight:800; color:#c9a96e; letter-spacing:1px;
    font-variant-numeric:tabular-nums; font-feature-settings:"tnum";
}

/* 提撥 */
.sl-contrib {
    margin:0 24px 14px; padding:9px 16px;
    background:rgba(201,169,110,0.07);
    border:1px dashed rgba(201,169,110,0.3); border-radius:7px;
    display:flex; justify-content:space-between; align-items:center;
}
.sl-contrib-label { font-size:11px; color:#9ca3af; }
.sl-contrib-right { text-align:right; }
.sl-contrib-amt   { font-size:13px; color:#c9a96e; font-weight:700; }
.sl-contrib-note  { font-size:9px; color:#c9a96e; opacity:0.6; margin-top:1px; }

/* 備註 */
.sl-remark { margin:0 24px 14px; padding:10px 14px; background:#f8f7f4; border-radius:7px; }
.sl-remark-title { font-size:9px; font-weight:700; color:#c9a96e; letter-spacing:2px; margin-bottom:6px; }
.sl-remark-body  { font-size:12px; color:#4b5563; line-height:1.6; white-space:pre-wrap; }

/* Footer */
.sl-footer {
    background:#1e2533; padding:14px 24px;
    display:flex; justify-content:space-between; align-items:center;
}
.sl-seal {
    width:44px; height:44px; border-radius:50%; border:2px solid #c9a96e;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:800; color:#c9a96e; letter-spacing:1px;
}
.sl-footer-note { font-size:9px; color:rgba(255,255,255,0.3); text-align:right; line-height:1.6; }
</style>
