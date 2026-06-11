<template>
  <div class="border-t border-gray-200 bg-white px-5 py-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">工種安排</span>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="totalPayment > 0" class="text-xs font-medium" style="color:#c9a96e">合計 ${{ totalPayment.toLocaleString() }}</span>
        <span v-if="totalPayment > 0" class="text-xs font-medium" :class="totalProfit >= 0 ? 'text-green-600' : 'text-red-500'">
          毛利 ${{ totalProfit.toLocaleString() }}
        </span>
        <button @click="openAdd" class="text-xs px-3 py-1.5 rounded-lg text-white" style="background:#1e2533">+ 新增工種</button>
      </div>
    </div>

    <div v-if="workTypes.length === 0" class="text-xs text-gray-400 py-3 text-center">
      尚無工種資料，點擊右上新增
    </div>

    <div v-else class="flex flex-col gap-2">
      <div v-for="(wt, idx) in workTypes" :key="wt.id"
        class="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
        <!-- Main row -->
        <div class="overflow-x-auto -mx-1 px-1">
        <div class="flex items-center gap-3 min-w-[480px]">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="`background:${wt.color}`"></span>
          <div class="flex-1 grid grid-cols-7 gap-2 items-start">
            <div>
              <div class="text-[10px] text-gray-400 mb-0.5">工種</div>
              <div class="text-xs font-semibold text-gray-800">{{ wt.name }}</div>
            </div>
            <div>
              <div class="text-[10px] text-gray-400 mb-0.5">負責廠商</div>
              <div class="text-xs text-gray-600">{{ wt.vendorName || '—' }}</div>
            </div>
            <div class="col-span-2">
              <div class="text-[10px] text-gray-400 mb-0.5">進場期間</div>
              <div class="text-xs text-gray-600">
                <template v-if="wt.startDate">
                  {{ wt.startDate }}<template v-if="wt.endDate"><br>～ {{ wt.endDate }}</template>
                </template>
                <template v-else>—</template>
              </div>
              <span v-if="isWorkTypeOverdue(wt)"
                class="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold mt-0.5 inline-block">
                退場逾期
              </span>
              <span v-if="wt.done"
                class="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold mt-0.5 inline-block cursor-pointer"
                @click="unmarkDone(idx)" title="點擊取消完工">
                ✓ 已完工
              </span>
              <button v-else-if="wt.endDate" @click="markDone(idx)"
                class="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-600 font-medium mt-0.5 inline-block transition-colors">
                ✓ 完工
              </button>
            </div>
            <div>
              <div class="text-[10px] text-gray-400 mb-0.5">向業主收款</div>
              <div class="text-xs font-medium" style="color:#c9a96e">
                <template v-if="wt.paymentFree">
                  <span class="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px]">免費</span>
                </template>
                <template v-else>{{ wtPaymentTotal(wt) > 0 ? `$${wtPaymentTotal(wt).toLocaleString()}` : '—' }}</template>
              </div>
            </div>
            <div>
              <div class="text-[10px] text-gray-400 mb-0.5">廠商合約金額</div>
              <template v-if="wt.vendorCostFree">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">免費</span>
              </template>
              <template v-else>
                <div class="text-xs font-medium text-gray-700">
                  {{ wtVendorCostTotal(wt) > 0 ? `$${wtVendorCostTotal(wt).toLocaleString()}` : '—' }}
                </div>
                <span v-if="wtVendorCostTotal(wt) > 0" class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  :class="wt.costIncludesTax ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'">
                  {{ wt.costIncludesTax ? '含稅' : '未稅' }}
                </span>
                <template v-if="wtVendorCostTotal(wt) > 0">
                  <div class="text-[10px] mt-1"
                    :class="totalVendorPaid(wt) >= wtVendorCostTotal(wt) ? 'text-green-600'
                          : totalVendorPaid(wt) > 0 ? 'text-orange-500'
                          : 'text-gray-400'">
                    已付 ${{ totalVendorPaid(wt).toLocaleString() }}
                    <span v-if="totalVendorPaid(wt) >= wtVendorCostTotal(wt)" class="ml-0.5">✓</span>
                  </div>
                  <div class="w-full h-1 rounded-full bg-gray-100 mt-1 overflow-hidden">
                    <div class="h-full rounded-full transition-all"
                      :style="`width:${Math.min(100, Math.round(totalVendorPaid(wt) / wtVendorCostTotal(wt) * 100))}%`"
                      :class="totalVendorPaid(wt) >= wtVendorCostTotal(wt) ? 'bg-green-500'
                            : totalVendorPaid(wt) > 0 ? 'bg-orange-400'
                            : 'bg-gray-300'">
                    </div>
                  </div>
                </template>
                <span v-if="vendorInvoiceStatus(wt)" class="text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block"
                  :class="vendorInvoiceStatus(wt).cls">
                  {{ vendorInvoiceStatus(wt).label }}
                </span>
              </template>
            </div>
            <div>
              <div class="text-[10px] text-gray-400 mb-0.5">報價單</div>
              <span :class="wt.hasQuote ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'"
                class="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap block mb-1">
                {{ wt.hasQuote ? '已提供' : '未提供' }}
              </span>
              <div class="text-[10px] text-gray-400 mb-0.5">施工日期</div>
              <span :class="wt.hasSchedule ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'"
                class="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap block">
                {{ wt.hasSchedule ? '已提供' : '未提供' }}
              </span>
            </div>
          </div>
          <div class="flex gap-1.5 flex-shrink-0">
            <button @click="openVendorPay(idx)" class="text-[11px] px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">記錄付款</button>
            <button @click="openEdit(idx)" class="text-[11px] px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">編輯</button>
            <button @click="removeWorkType(idx)" class="text-[11px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors">刪除</button>
          </div>
        </div>
        </div>

        <!-- Vendor quotes section -->
        <div class="mt-2 pt-2 border-t border-gray-100">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] text-gray-400 font-medium">廠商報價單</span>
            <span v-if="vendorPhotos[wt.id]?.length"
              class="text-[9px] min-w-[16px] h-4 px-1 rounded-full bg-gray-400 text-white leading-4 text-center">
              {{ vendorPhotos[wt.id].length }}
            </span>
            <button @click="triggerVendorUpload(wt.id)"
              class="ml-auto text-[10px] border border-dashed border-gray-200 rounded px-2 py-0.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
              + 上傳
            </button>
          </div>
          <div v-if="vendorPhotos[wt.id]?.length" class="flex gap-2 overflow-x-auto pb-1">
            <div v-for="(item, idx) in vendorPhotos[wt.id]" :key="item.url"
              class="flex-shrink-0 flex flex-col items-center gap-0.5 relative group">
              <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                class="w-14 h-14 rounded bg-red-100 flex items-center justify-center text-[10px] text-red-600 font-bold hover:bg-red-200 transition-colors">PDF</a>
              <img v-else :src="item.url"
                class="w-14 h-14 rounded object-cover cursor-pointer hover:opacity-80"
                @click="openVendorPreview(wt.id, idx)">
              <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }}</span>
              <button @click="deleteVendorPhoto(wt.id, item)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10">✕</button>
            </div>
          </div>
          <div v-else class="text-[10px] text-gray-300">尚未上傳</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 新增/編輯工種 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] flex flex-col">
      <div class="px-6 pt-6 pb-0 flex-shrink-0">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-gray-800">{{ editingIdx !== null ? '編輯工種' : '新增工種' }}</h3>
          <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
      </div>
      <div class="flex flex-col gap-3 overflow-y-auto px-6 py-2 flex-1">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工種 *</label>
          <select v-model="selectedCategory" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 請選擇工種 —</option>
            <option v-for="cat in WORK_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
            <option value="__custom__">自訂…</option>
          </select>
        </div>
        <div v-if="selectedCategory === '__custom__'">
          <label class="text-xs text-gray-500 mb-1 block">自訂名稱 *</label>
          <input v-model="form.name" type="text" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="輸入工種名稱">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">負責廠商</label>
          <div class="relative">
            <input
              v-model="vendorSearch"
              @focus="showVendorDropdown = true"
              @blur="hideVendorDropdown"
              type="text"
              placeholder="搜尋廠商名稱…"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
            >
            <div v-if="showVendorDropdown"
              class="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-44 overflow-y-auto">
              <button type="button" @mousedown.prevent="selectVendor(null)"
                class="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50">— 尚未指定 —</button>
              <button v-for="v in filteredVendorList" :key="v.id" type="button"
                @mousedown.prevent="selectVendor(v)"
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                :class="form.vendorId === v.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'">
                {{ v.name }}<span class="text-gray-400 text-xs ml-1">{{ v.specialty }}</span>
              </button>
              <div v-if="filteredVendorList.length === 0" class="px-3 py-2 text-sm text-gray-300">找不到符合廠商</div>
            </div>
          </div>
          <p v-if="regionVendors.length === 0" class="text-[11px] text-gray-400 mt-1">
            {{ selectedCategory && selectedCategory !== '__custom__' ? `尚無「${selectedCategory}」廠商，請至設定新增` : '尚無廠商，請至設定 › 廠商管理新增' }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">進場日期</label>
            <input :value="form.startDate" type="date"
              @input="form.startDate = $event.target.value"
              @change="form.startDate = $event.target.value"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">退場日期</label>
            <input :value="form.endDate" type="date"
              @input="form.endDate = $event.target.value"
              @change="form.endDate = $event.target.value"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-gray-500 font-medium">向業主收取工程款</label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" v-model="form.paymentFree" class="rounded">
              <span class="text-xs text-gray-600">免費</span>
            </label>
          </div>
          <div v-if="!form.paymentFree" class="flex flex-col gap-1.5">
            <div v-for="(item, i) in form.paymentItems" :key="item.id"
              class="border border-gray-100 rounded-lg p-2 bg-gray-50/60">
              <div class="flex gap-1.5 mb-1.5">
                <input v-model="item.description" type="text" placeholder="說明"
                  class="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
                <input v-model.number="item.amount" type="number" min="0" placeholder="金額"
                  class="w-24 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
              </div>
              <div class="flex gap-1.5 items-center">
                <input v-model="item.note" type="text" placeholder="備註"
                  class="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
                <button v-if="editingIdx !== null" type="button" @click="sendReminder(item, 'owner')"
                  class="text-[10px] px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 whitespace-nowrap transition-colors">
                  提醒主管
                </button>
                <button type="button" @click="removePaymentItem(i)"
                  class="text-[10px] text-red-400 hover:text-red-600 px-1 flex-shrink-0">✕</button>
              </div>
            </div>
            <button type="button" @click="addPaymentItem"
              class="text-[11px] border border-dashed border-gray-200 rounded-lg py-1.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors w-full">
              + 新增一筆
            </button>
            <div v-if="formPaymentTotal > 0" class="text-right text-xs font-semibold mt-0.5" style="color:#c9a96e">
              合計 ${{ formPaymentTotal.toLocaleString() }}
            </div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-gray-500 font-medium">廠商合約金額</label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" v-model="form.vendorCostFree" class="rounded">
              <span class="text-xs text-gray-600">免費</span>
            </label>
          </div>
          <div v-if="!form.vendorCostFree" class="flex flex-col gap-1.5">
            <div v-for="(item, i) in form.vendorCostItems" :key="item.id"
              class="border border-gray-100 rounded-lg p-2 bg-gray-50/60">
              <div class="flex gap-1.5 mb-1.5">
                <input v-model="item.description" type="text" placeholder="說明"
                  class="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
                <input v-model.number="item.amount" type="number" min="0" placeholder="金額"
                  class="w-24 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
              </div>
              <div class="flex gap-1.5 items-center">
                <input v-model="item.note" type="text" placeholder="備註"
                  class="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
                <button v-if="editingIdx !== null" type="button" @click="sendReminder(item, 'vendor')"
                  class="text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 whitespace-nowrap transition-colors">
                  提醒主管
                </button>
                <button type="button" @click="removeVendorCostItem(i)"
                  class="text-[10px] text-red-400 hover:text-red-600 px-1 flex-shrink-0">✕</button>
              </div>
            </div>
            <button type="button" @click="addVendorCostItem"
              class="text-[11px] border border-dashed border-gray-200 rounded-lg py-1.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors w-full">
              + 新增一筆
            </button>
            <div v-if="formVendorCostTotal > 0" class="text-right text-xs font-semibold mt-0.5 text-gray-700">
              合計 ${{ formVendorCostTotal.toLocaleString() }}
            </div>
          </div>
        </div>
        <div class="border border-gray-100 rounded-xl p-3 bg-gray-50/50 flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="form.costIncludesTax" class="rounded">
            <span class="text-sm text-gray-700">含稅</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="form.hasQuote" class="rounded">
            <span class="text-sm text-gray-700">已提供報價單</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="form.hasSchedule" class="rounded">
            <span class="text-sm text-gray-700">已提供施工日期</span>
          </label>
        </div>
      </div>
      <div class="flex justify-end gap-2 px-6 py-4 flex-shrink-0 border-t border-gray-100">
        <button @click="showForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="submitForm" :disabled="saving" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ saving ? '儲存中…' : '儲存' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 廠商付款記錄 Modal -->
  <div v-if="showVendorPayForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-bold text-gray-800">廠商實付記錄</h3>
          <p v-if="vendorPayingIdx !== null" class="text-[11px] text-gray-400 mt-0.5">{{ workTypes[vendorPayingIdx]?.name }}</p>
        </div>
        <button @click="showVendorPayForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <div v-if="vendorPayingIdx !== null && workTypes[vendorPayingIdx]?.vendorPayments?.length" class="mb-4">
        <div class="text-[11px] text-gray-500 font-semibold mb-2">付款歷史</div>
        <div class="flex flex-col gap-1.5">
          <div v-for="vp in workTypes[vendorPayingIdx].vendorPayments" :key="vp.id"
            class="flex items-center gap-2 text-xs border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
            <span class="text-gray-600 flex-shrink-0">{{ vp.paidDate || '—' }}</span>
            <span class="font-medium text-gray-800 flex-shrink-0">${{ (vp.amount || 0).toLocaleString() }}</span>
            <span class="text-gray-400 truncate flex-1">{{ vp.note || '' }}</span>
            <button type="button" @click="toggleVendorInvoice(vp.id)"
              class="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 transition-colors"
              :class="vp.hasInvoice ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'">
              {{ vp.hasInvoice ? '有發票' : '無發票' }}
            </button>
            <button type="button" @click="deleteVendorPayment(vp.id)"
              class="text-[10px] text-red-400 hover:text-red-600 flex-shrink-0 px-1">✕</button>
          </div>
        </div>
        <div class="mt-2 text-right text-xs font-medium text-gray-600">
          已付合計 ${{ totalVendorPaid(workTypes[vendorPayingIdx]).toLocaleString() }}
        </div>
      </div>

      <div class="text-[11px] text-gray-500 font-semibold mb-2">新增付款</div>
      <div class="flex flex-col gap-3">
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-gray-500">付款金額（元）</label>
            <button v-if="remainingVendorAmount > 0" type="button"
              @click="vendorPayForm.amount = remainingVendorAmount"
              class="text-[11px] px-2 py-0.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">
              全付 ${{ remainingVendorAmount.toLocaleString() }}
            </button>
          </div>
          <input v-model.number="vendorPayForm.amount" type="number" min="0"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="0">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">付款日期</label>
          <input :value="vendorPayForm.paidDate" type="date"
            @input="vendorPayForm.paidDate = $event.target.value"
            @change="vendorPayForm.paidDate = $event.target.value"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">備註</label>
          <input v-model="vendorPayForm.note" type="text"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1" placeholder="例：第一期款">
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="showVendorPayForm = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="addVendorPayment" :disabled="savingVendorPay" class="text-sm text-white px-5 py-2 rounded-xl disabled:opacity-60" style="background:#1e2533">
          {{ savingVendorPay ? '儲存中…' : '記錄付款' }}
        </button>
      </div>
    </div>
  </div>

  <!-- vendor photo file input & lightbox -->
  <input ref="vendorFileInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleVendorFiles">
  <div v-if="previewVendorUrl" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    @click.self="previewVendorUrl = null">
    <button v-if="previewImgIdx > 0" @click="navigateVendorPhoto(-1)"
      class="absolute left-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">‹</button>
    <img :src="previewVendorUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl cursor-default">
    <button v-if="previewImgIdx < (vendorPhotos[previewWtId]?.length ?? 0) - 1" @click="navigateVendorPhoto(1)"
      class="absolute right-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">›</button>
  </div>
</template>
<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { useVendorsStore } from '@/stores/vendors'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'

function calcVendorDueDate(endDate) {
    const d = new Date(endDate + 'T00:00:00')
    const day = d.getDate()
    const nextMonthDate = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const year = nextMonthDate.getFullYear()
    const month = nextMonthDate.getMonth()
    const targetDay = day <= 15 ? 15 : new Date(year, month + 1, 0).getDate()
    const result = new Date(year, month, targetDay)
    while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() + 1)
    return result.toISOString().slice(0, 10)
}

function calcOwnerDueDate(startDate) {
    const d = new Date(startDate + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
}

function formatDateChinese(isoDate) {
    const d = new Date(isoDate + 'T00:00:00')
    const days = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getMonth() + 1}/${d.getDate()}（週${days[d.getDay()]}）`
}

const props = defineProps({ caseId: String, caseName: String })
const vendorsStore = useVendorsStore()
const casesStore = useCasesStore()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const remindersStore = usePaymentRemindersStore()
const { toast } = useToast()

const showForm = ref(false)
const saving = ref(false)
const editingIdx = ref(null)
const form = ref({
    name: '', vendorId: '', startDate: '', endDate: '',
    paymentItems: [], paymentFree: false,
    hasQuote: false, hasSchedule: false,
    vendorCostItems: [], vendorCostFree: false,
    costIncludesTax: false,
})

const showVendorPayForm = ref(false)
const savingVendorPay = ref(false)
const vendorPayingIdx = ref(null)
const vendorPayForm = ref({ amount: 0, paidDate: '', note: '' })

const vendorPhotos = reactive({})
const activeWtId = ref('')
const vendorFileInput = ref(null)
const previewVendorUrl = ref(null)
const previewWtId = ref('')
const previewImgIdx = ref(-1)

const WT_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316']

function sumItems(items, free) {
    if (free) return 0
    return (items || []).reduce((s, i) => s + (i.amount || 0), 0)
}

function wtPaymentTotal(wt) {
    const items = wt.paymentItems ?? (wt.payment > 0 ? [{ amount: wt.payment }] : [])
    return sumItems(items, wt.paymentFree)
}

function wtVendorCostTotal(wt) {
    const items = wt.vendorCostItems ?? (wt.vendorCost > 0 ? [{ amount: wt.vendorCost }] : [])
    return sumItems(items, wt.vendorCostFree)
}

function normalizeItems(items, legacyAmount, prefix) {
    if (items && items.length > 0) return items.map(i => ({ ...i }))
    if (legacyAmount > 0) return [{ id: `${prefix}_legacy`, description: '工程款', amount: legacyAmount, note: '' }]
    return []
}

function addPaymentItem() {
    form.value.paymentItems.push({ id: `pi_${Date.now()}`, description: '', amount: 0, note: '' })
}
function removePaymentItem(i) {
    form.value.paymentItems.splice(i, 1)
}
function addVendorCostItem() {
    form.value.vendorCostItems.push({ id: `vc_${Date.now()}`, description: '', amount: 0, note: '' })
}
function removeVendorCostItem(i) {
    form.value.vendorCostItems.splice(i, 1)
}

const formPaymentTotal = computed(() =>
    form.value.paymentItems.reduce((s, i) => s + (i.amount || 0), 0)
)
const formVendorCostTotal = computed(() =>
    form.value.vendorCostItems.reduce((s, i) => s + (i.amount || 0), 0)
)

const selectedCategory = ref('')
watch(selectedCategory, (val) => {
    if (val && val !== '__custom__') form.value.name = val
    else if (val === '__custom__') form.value.name = ''
})

const vendorSearch = ref('')
const showVendorDropdown = ref(false)
const filteredVendorList = computed(() => {
    const kw = vendorSearch.value.trim()
    if (!kw) return regionVendors.value
    return regionVendors.value.filter(v => v.name.includes(kw))
})
function selectVendor(vendor) {
    form.value.vendorId = vendor?.id ?? ''
    vendorSearch.value = vendor?.name ?? ''
    showVendorDropdown.value = false
}
function hideVendorDropdown() {
    setTimeout(() => { showVendorDropdown.value = false }, 150)
}

const caseData = computed(() => casesStore.cases.find(c => c.id === props.caseId))
const workTypes = computed(() => caseData.value?.workTypes ?? [])

const TODAY_STR = new Date().toISOString().slice(0, 10)

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isWorkTypeOverdue(wt) {
    if (!wt.endDate || wt.done) return false
    const caseStatus = caseData.value?.status
    if (caseStatus === 'completed' || caseStatus === 'lost') return false
    return wt.endDate < TODAY_STR
}

async function markDone(idx) {
    const updated = [...workTypes.value]
    updated[idx] = { ...updated[idx], done: true }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    const wt = workTypes.value[idx]
    if (wt.endDate) {
        const dueDate = calcVendorDueDate(wt.endDate)
        await remindersStore.addAutoReminder(`auto_vendor_${wt.id}`, {
            source: 'auto',
            type: 'vendor',
            dueDate,
            caseId: props.caseId,
            caseName: props.caseName,
            companyId: caseData.value?.companyId ?? '',
            workTypeId: wt.id,
            workTypeName: wt.name,
            vendorName: wt.vendorName || '',
            amount: wtVendorCostTotal(wt),
            createdBy: authStore.user?.uid ?? '',
            createdByName: authStore.name ?? '',
        })
        toast(`已完工，廠商付款提醒：${formatDateChinese(dueDate)}`)
    } else {
        toast('已標記完工')
    }
}

async function unmarkDone(idx) {
    const updated = [...workTypes.value]
    updated[idx] = { ...updated[idx], done: false }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    const wt = workTypes.value[idx]
    await remindersStore.deleteAutoReminder(`auto_vendor_${wt.id}`)
}

function openVendorPreview(wtId, idx) {
    previewWtId.value = wtId
    previewImgIdx.value = idx
    previewVendorUrl.value = vendorPhotos[wtId][idx].url
}

function navigateVendorPhoto(dir) {
    const list = vendorPhotos[previewWtId.value] || []
    const next = previewImgIdx.value + dir
    if (next >= 0 && next < list.length) {
        previewImgIdx.value = next
        previewVendorUrl.value = list[next].url
    }
}

function handleVendorKeydown(e) {
    if (!previewVendorUrl.value) return
    if (e.key === 'Escape') { previewVendorUrl.value = null; return }
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        navigateVendorPhoto(1)
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateVendorPhoto(-1)
    }
}

onUnmounted(() => {
    window.removeEventListener('keydown', handleVendorKeydown)
})

onMounted(async () => {
    window.addEventListener('keydown', handleVendorKeydown)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, workTypeId, createdAt } = d.data()
        if (type === 'vendor_quote' && workTypeId) {
            if (!vendorPhotos[workTypeId]) vendorPhotos[workTypeId] = []
            const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
            const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            vendorPhotos[workTypeId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, createdAt })
        }
    })
})

function triggerVendorUpload(wtId) {
    activeWtId.value = wtId
    vendorFileInput.value?.click()
}

async function handleVendorFiles(e) {
    const files = Array.from(e.target.files)
    e.target.value = ''
    for (const file of files) {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); continue }
        try {
            const url = await uploadPhoto(file, 'vendor_quote')
            const isPdf = file.name.toLowerCase().endsWith('.pdf')
            const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'vendor_quote',
                workTypeId: activeWtId.value,
                url, isPdf,
                uploadedBy: authStore.user?.uid ?? 'unknown',
                createdAt: serverTimestamp()
            })
            if (!vendorPhotos[activeWtId.value]) vendorPhotos[activeWtId.value] = []
            vendorPhotos[activeWtId.value].push({ id: docRef.id, url, isPdf, pdfUrl, createdAt: { toDate: () => new Date() } })
        } catch {
            toast('上傳失敗，請重試', 'error')
        }
    }
}

async function deleteVendorPhoto(wtId, item) {
    if (item.id && props.caseId) {
        await deleteDoc(doc(db, 'cases', props.caseId, 'photos', item.id))
    }
    vendorPhotos[wtId] = vendorPhotos[wtId].filter(p => p !== item)
}

const remainingVendorAmount = computed(() => {
    if (vendorPayingIdx.value === null) return 0
    const wt = workTypes.value[vendorPayingIdx.value]
    if (!wt) return 0
    return Math.max(0, wtVendorCostTotal(wt) - totalVendorPaid(wt))
})

const regionVendors = computed(() => {
    const vendors = vendorsStore.vendors.filter(v => !v.companyId || v.companyId === caseData.value?.companyId)
    if (!selectedCategory.value || selectedCategory.value === '__custom__') return vendors
    const standardCategories = WORK_CATEGORIES.filter(c => c !== '其他')
    if (selectedCategory.value === '其他') return vendors.filter(v => !standardCategories.includes(v.specialty))
    return vendors.filter(v => v.specialty === selectedCategory.value)
})
const totalPayment = computed(() => workTypes.value.reduce((sum, wt) => sum + wtPaymentTotal(wt), 0))
const totalVendorCost = computed(() => workTypes.value.reduce((sum, wt) => sum + wtVendorCostTotal(wt), 0))
const totalProfit = computed(() => totalPayment.value - totalVendorCost.value)

function totalVendorPaid(wt) {
    return (wt.vendorPayments || []).reduce((sum, vp) => sum + (vp.amount || 0), 0)
}

function vendorInvoiceStatus(wt) {
    const payments = wt.vendorPayments || []
    if (payments.length === 0) return null
    const count = payments.filter(vp => vp.hasInvoice).length
    if (count === payments.length) return { label: '發票全到', cls: 'bg-green-100 text-green-700' }
    if (count > 0) return { label: `發票 ${count}/${payments.length}`, cls: 'bg-amber-100 text-amber-700' }
    return { label: '無發票', cls: 'bg-gray-100 text-gray-400' }
}

function openAdd() {
    editingIdx.value = null
    selectedCategory.value = ''
    vendorSearch.value = ''
    form.value = {
        name: '', vendorId: '', startDate: '', endDate: '',
        paymentItems: [], paymentFree: false,
        hasQuote: false, hasSchedule: false,
        vendorCostItems: [], vendorCostFree: false,
        costIncludesTax: false,
    }
    showForm.value = true
}

function openEdit(idx) {
    editingIdx.value = idx
    const wt = workTypes.value[idx]
    selectedCategory.value = WORK_CATEGORIES.includes(wt.name) ? wt.name : (wt.name ? '__custom__' : '')
    vendorSearch.value = wt.vendorName || ''
    form.value = {
        name: wt.name,
        vendorId: wt.vendorId || '',
        startDate: wt.startDate || '',
        endDate: wt.endDate || '',
        paymentItems: normalizeItems(wt.paymentItems, wt.payment, 'pi'),
        paymentFree: wt.paymentFree || false,
        hasQuote: wt.hasQuote || false,
        hasSchedule: wt.hasSchedule || false,
        vendorCostItems: normalizeItems(wt.vendorCostItems, wt.vendorCost, 'vc'),
        vendorCostFree: wt.vendorCostFree || false,
        costIncludesTax: wt.costIncludesTax || false,
    }
    showForm.value = true
}

function openVendorPay(idx) {
    vendorPayingIdx.value = idx
    vendorPayForm.value = { amount: 0, paidDate: '', note: '' }
    showVendorPayForm.value = true
}

async function submitForm() {
    if (!form.value.name || saving.value) return
    saving.value = true
    try {
        const vendor = vendorsStore.vendors.find(v => v.id === form.value.vendorId)
        const existing = editingIdx.value !== null ? workTypes.value[editingIdx.value] : null
        const entry = {
            id: existing ? existing.id : `wt_${Date.now()}`,
            name: form.value.name,
            vendorId: form.value.vendorId || '',
            vendorName: vendor?.name ?? '',
            startDate: form.value.startDate || '',
            endDate: form.value.endDate || '',
            paymentItems: form.value.paymentFree ? [] : form.value.paymentItems.filter(i => i.description || i.amount > 0),
            paymentFree: form.value.paymentFree || false,
            hasQuote: form.value.hasQuote || false,
            hasSchedule: form.value.hasSchedule || false,
            vendorCostItems: form.value.vendorCostFree ? [] : form.value.vendorCostItems.filter(i => i.description || i.amount > 0),
            vendorCostFree: form.value.vendorCostFree || false,
            costIncludesTax: form.value.costIncludesTax || false,
            color: existing ? existing.color : WT_COLORS[workTypes.value.length % WT_COLORS.length],
            vendorPayments: existing?.vendorPayments ?? [],
            done: existing?.done ?? false,
        }
        const updated = [...workTypes.value]
        if (editingIdx.value !== null) {
            updated[editingIdx.value] = entry
        } else {
            updated.push(entry)
        }
        await casesStore.updateCase(props.caseId, { workTypes: updated })
        const autoOwnerId = `auto_owner_${entry.id}`
        if (entry.startDate) {
            const dueDate = calcOwnerDueDate(entry.startDate)
            const amount = entry.paymentFree ? 0 : form.value.paymentItems.reduce((s, i) => s + (i.amount || 0), 0)
            await remindersStore.addAutoReminder(autoOwnerId, {
                source: 'auto',
                type: 'owner',
                dueDate,
                caseId: props.caseId,
                caseName: props.caseName,
                companyId: caseData.value?.companyId ?? '',
                workTypeId: entry.id,
                workTypeName: entry.name,
                vendorName: entry.vendorName || '',
                amount,
                createdBy: authStore.user?.uid ?? '',
                createdByName: authStore.name ?? '',
            })
        } else {
            await remindersStore.deleteAutoReminder(autoOwnerId)
        }
        notifStore.notifyAll(authStore.name ?? '', `更新了「${props.caseName}」的工種`, props.caseId, props.caseName, caseData.value?.companyId ?? '')
        showForm.value = false
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        saving.value = false
    }
}

async function sendReminder(item, type) {
    if (editingIdx.value === null) return
    const wt = workTypes.value[editingIdx.value]
    const typeLabel = type === 'owner' ? '向業主請款' : '廠商匯款'
    await remindersStore.addReminder({
        type,
        caseId: props.caseId,
        caseName: props.caseName,
        companyId: caseData.value?.companyId ?? '',
        workTypeId: wt.id,
        workTypeName: wt.name,
        itemId: item.id,
        description: item.description,
        amount: item.amount || 0,
        note: item.note || '',
        createdBy: authStore.user?.uid ?? '',
        createdByName: authStore.name ?? '',
    })
    await notifStore.notifyManagers(
        authStore.name ?? '',
        `${props.caseName}－${wt.name}：${item.description} ${typeLabel} $${(item.amount || 0).toLocaleString()}`
    )
    toast('已提醒主管')
}

async function deleteVendorPayment(vpId) {
    if (!confirm('確定要刪除這筆付款記錄？')) return
    const updated = [...workTypes.value]
    const wt = { ...updated[vendorPayingIdx.value] }
    wt.vendorPayments = wt.vendorPayments.filter(vp => vp.id !== vpId)
    updated[vendorPayingIdx.value] = wt
    await casesStore.updateCase(props.caseId, { workTypes: updated })
}

async function toggleVendorInvoice(vpId) {
    const updated = [...workTypes.value]
    const wt = { ...updated[vendorPayingIdx.value] }
    wt.vendorPayments = wt.vendorPayments.map(vp =>
        vp.id === vpId ? { ...vp, hasInvoice: !vp.hasInvoice } : vp
    )
    updated[vendorPayingIdx.value] = wt
    await casesStore.updateCase(props.caseId, { workTypes: updated })
}

async function addVendorPayment() {
    if (!vendorPayForm.value.amount || savingVendorPay.value) return
    savingVendorPay.value = true
    try {
        const updated = [...workTypes.value]
        const wt = { ...updated[vendorPayingIdx.value] }
        wt.vendorPayments = [...(wt.vendorPayments || []), {
            id: `vp_${Date.now()}`,
            amount: vendorPayForm.value.amount,
            paidDate: vendorPayForm.value.paidDate,
            note: vendorPayForm.value.note,
        }]
        updated[vendorPayingIdx.value] = wt
        await casesStore.updateCase(props.caseId, { workTypes: updated })
        showVendorPayForm.value = false
    } catch {
        toast('儲存失敗，請重試', 'error')
    } finally {
        savingVendorPay.value = false
    }
}

async function removeWorkType(idx) {
    if (!confirm(`確定要刪除「${workTypes.value[idx].name}」？`)) return
    const wt = workTypes.value[idx]
    try {
        const updated = workTypes.value.filter((_, i) => i !== idx)
        await casesStore.updateCase(props.caseId, { workTypes: updated })
        await remindersStore.deleteAutoReminder(`auto_vendor_${wt.id}`)
        await remindersStore.deleteAutoReminder(`auto_owner_${wt.id}`)
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
