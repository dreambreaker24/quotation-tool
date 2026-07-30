<template>
  <div class="border-t border-gray-200 bg-white px-5 py-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-700">{{ caseName }}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(201,169,110,0.15);color:#c9a96e">工種安排</span>
      </div>
      <div class="flex items-center gap-3">
        <button @click="openAdd" class="text-xs px-3 py-1.5 rounded-lg text-white" style="background:#1e2533">+ 新增工種</button>
      </div>
    </div>

    <div v-if="workTypes.length === 0" class="text-xs text-gray-400 py-3 text-center">
      尚無工種資料，點擊右上新增
    </div>

    <div v-else class="flex flex-col gap-2">
      <div v-for="(wt, idx) in workTypes" :key="wt.id"
        class="border border-gray-100 rounded-xl p-3 bg-gray-50/50 hover:bg-white hover:shadow-sm transition-all">
        <!-- Main row -->
        <div class="overflow-x-auto -mx-1 px-1">
        <div class="flex items-center gap-3 min-w-[480px]">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="`background:${wt.color}`"></span>
          <div class="flex-1 grid grid-cols-6 gap-2 items-start">
            <div class="min-w-0">
              <div class="text-[10px] text-gray-400 mb-0.5">工種</div>
              <div class="text-sm font-bold text-gray-900 truncate" :title="wt.name">{{ wt.name }}</div>
            </div>
            <div class="min-w-0">
              <div class="text-[10px] text-gray-400 mb-0.5">負責廠商</div>
              <div class="text-xs text-gray-600 truncate" :title="wt.vendorName || ''">{{ wt.vendorName || '—' }}</div>
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
              <div class="text-[10px] text-gray-400 mb-0.5">廠商合約金額</div>
              <template v-if="wt.vendorCostFree">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">免費</span>
              </template>
              <template v-else>
                <div class="text-sm font-bold text-gray-900">
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
            <button v-if="wt.done && wtVendorCostTotal(wt) > 0 && !wt.vendorCostFree"
              @click="toggleInvoice(idx)"
              class="text-[11px] px-2 py-1 rounded-lg transition-colors"
              :class="wt.invoiceReceived ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'"
              :title="wt.invoiceReceived ? '點擊取消確認' : '確認廠商發票已到'">
              {{ wt.invoiceReceived ? '發票已到 ✓' : '確認發票' }}
            </button>
            <button @click="openVendorPay(idx)" class="text-[11px] px-1.5 py-1 text-gray-400 hover:text-gray-700 hover:underline transition-colors">記錄付款</button>
            <button @click="openEdit(idx)" class="text-[11px] px-1.5 py-1 text-gray-400 hover:text-gray-700 hover:underline transition-colors">編輯</button>
            <button @click="removeWorkType(idx)" class="text-[11px] px-1.5 py-1 text-red-300 hover:text-red-500 hover:underline transition-colors">刪除</button>
          </div>
        </div>
        </div>

        <div v-if="wt.done && wtVendorCostTotal(wt) > 0 && !wt.vendorCostFree" class="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
          <span class="text-[10px] text-gray-400 font-medium">開立對象</span>
          <button @click="setInvoiceTarget(idx, 'naiship')"
            class="text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors"
            :class="wt.invoiceTarget === 'naiship' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'">
            奈拾
          </button>
          <button @click="setInvoiceTarget(idx, 'boyan')"
            class="text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors"
            :class="wt.invoiceTarget === 'boyan' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'">
            柏延
          </button>
          <span v-if="!wt.invoiceTarget" class="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
            未選開立對象
          </span>
        </div>

        <div v-if="wt.locations?.length" class="mt-2 pt-2 border-t border-gray-100">
          <div class="text-[10px] text-gray-400 font-medium mb-1">施作位置</div>
          <div class="flex flex-col gap-1">
            <div v-for="loc in wt.locations" :key="loc.id" class="text-[11px] text-gray-600 flex items-center gap-2">
              <span class="font-medium">{{ loc.label }}</span>
              <span v-if="loc.startDate" class="text-gray-400">
                {{ loc.startDate }}<template v-if="loc.endDate"> ～ {{ loc.endDate }}</template>
              </span>
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
              <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
              <button @click="deleteVendorPhoto(wt.id, item)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10">✕</button>
            </div>
          </div>
          <div v-else class="text-[10px] text-gray-300">尚未上傳</div>
        </div>

        <!-- Construction photos section -->
        <div class="mt-2 pt-2 border-t border-gray-100">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] text-gray-400 font-medium">施工照片</span>
            <span v-if="wtConstructPhotoCount(wt.id)"
              class="text-[9px] min-w-[16px] h-4 px-1 rounded-full bg-gray-400 text-white leading-4 text-center">
              {{ wtConstructPhotoCount(wt.id) }}
            </span>
            <div class="ml-auto flex items-center gap-1.5">
              <button @click="openWtFolderForm(wt.id)"
                class="text-[9px] px-1.5 py-0.5 border border-gray-200 rounded text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
                + 資料夾
              </button>
              <button @click="triggerWtConstructUpload(wt.id)"
                class="text-[10px] border border-dashed border-gray-200 rounded px-2 py-0.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
                + 上傳
              </button>
            </div>
          </div>

          <!-- Has folders: grouped display -->
          <template v-if="wtFoldersForWt(wt.id).length">
            <div v-for="folder in wtFoldersForWt(wt.id)" :key="folder.id" class="mb-1">
              <div class="flex items-center gap-1.5 cursor-pointer py-0.5" @click="toggleWtFolder(folder.id)">
                <span class="text-[9px] text-gray-300">{{ wtFolderExpanded[folder.id] === true ? '▼' : '▶' }}</span>
                <span class="text-[10px] font-semibold text-gray-600">📁 {{ folder.label }}</span>
                <span v-if="wtPhotosInFolder(wt.id, folder.id).length"
                  class="text-[8px] min-w-[14px] h-3.5 px-0.5 rounded-full bg-gray-100 text-gray-500 leading-[14px] text-center">
                  {{ wtPhotosInFolder(wt.id, folder.id).length }}
                </span>
                <div class="ml-auto flex items-center gap-1" @click.stop>
                  <button @click="uploadToWtFolder(wt.id, folder.id)"
                    class="text-[8px] px-1 py-0.5 border border-dashed border-gray-200 rounded text-gray-400 hover:border-amber-300 hover:text-amber-600 transition-colors">
                    + 上傳
                  </button>
                  <button @click="editWtFolder(folder)"
                    class="text-[8px] text-gray-400 hover:text-gray-700 transition-colors px-0.5">編輯</button>
                  <button @click="deleteWtFolder(folder.id)"
                    class="text-[8px] text-red-300 hover:text-red-500 transition-colors px-0.5">刪除</button>
                </div>
              </div>
              <div v-if="folder.description && wtFolderExpanded[folder.id] === true" class="text-[9px] text-gray-400 ml-4 mb-0.5">{{ folder.description }}</div>
              <div v-if="wtFolderExpanded[folder.id] === true">
                <div v-if="!wtPhotosInFolder(wt.id, folder.id).length" class="text-[9px] text-gray-300 ml-4 py-0.5">尚無照片</div>
                <div v-else class="flex gap-2 overflow-x-auto pb-1">
                  <div v-for="item in wtPhotosInFolder(wt.id, folder.id)" :key="item.id"
                    class="flex-shrink-0 flex flex-col items-center gap-0.5 relative group">
                    <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                      class="w-14 h-14 rounded bg-red-100 flex items-center justify-center text-[10px] text-red-600 font-bold hover:bg-red-200 transition-colors">PDF</a>
                    <img v-else :src="item.url"
                      class="w-14 h-14 rounded object-cover cursor-pointer hover:opacity-80"
                      @click="openWtConstructPreview(wt.id, item)">
                    <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                    <button @click="deleteWtConstructPhoto(wt.id, item)"
                      class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10">✕</button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="wtPhotosInFolder(wt.id, null).length">
              <div class="text-[9px] text-gray-400 font-medium mb-0.5">未分類</div>
              <div class="flex gap-2 overflow-x-auto pb-1">
                <div v-for="item in wtPhotosInFolder(wt.id, null)" :key="item.id"
                  class="flex-shrink-0 flex flex-col items-center gap-0.5 relative group">
                  <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                    class="w-14 h-14 rounded bg-red-100 flex items-center justify-center text-[10px] text-red-600 font-bold hover:bg-red-200 transition-colors">PDF</a>
                  <img v-else :src="item.url"
                    class="w-14 h-14 rounded object-cover cursor-pointer hover:opacity-80"
                    @click="openWtConstructPreview(wt.id, item)">
                  <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                  <button @click="deleteWtConstructPhoto(wt.id, item)"
                    class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10">✕</button>
                </div>
              </div>
            </div>
            <div v-else-if="!wtConstructPhotoCount(wt.id)" class="text-[10px] text-gray-300">尚未上傳</div>
          </template>

          <!-- No folders: flat display -->
          <template v-else>
            <div v-if="wtConstructPhotos[wt.id]?.length" class="flex gap-2 overflow-x-auto pb-1">
              <div v-for="item in wtConstructPhotos[wt.id]" :key="item.id"
                class="flex-shrink-0 flex flex-col items-center gap-0.5 relative group">
                <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                  class="w-14 h-14 rounded bg-red-100 flex items-center justify-center text-[10px] text-red-600 font-bold hover:bg-red-200 transition-colors">PDF</a>
                <img v-else :src="item.url"
                  class="w-14 h-14 rounded object-cover cursor-pointer hover:opacity-80"
                  @click="openWtConstructPreview(wt.id, item)">
                <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                <button @click="deleteWtConstructPhoto(wt.id, item)"
                  class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-600 text-white rounded-full text-[8px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500 z-10">✕</button>
              </div>
            </div>
            <div v-else class="text-[10px] text-gray-300">尚未上傳</div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- 新增/編輯工種 Modal -->
  <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] flex flex-col border-t-4" style="border-top-color:#c9a96e">
      <div class="px-6 pt-6 pb-0 flex-shrink-0">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-gray-800">{{ editingIdx !== null ? '編輯工種' : '新增工種' }}</h3>
          <button @click="showForm = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
      </div>
      <div class="flex flex-col gap-3 overflow-y-auto px-6 py-2 flex-1">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">工種 *</label>
          <select v-model="selectedCategory" @change="onCategoryChange" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1">
            <option value="">— 請選擇工種 —</option>
            <option v-for="cat in WORK_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
          </select>
          <div v-if="isLegacyCustomName" class="mt-1.5 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
            舊資料：{{ form.name }}（不在標準清單內）
            <button type="button" @click="clearLegacyCustomName" class="ml-1 underline hover:text-amber-800">改選標準分類</button>
          </div>
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
                {{ v.name }}<span class="text-gray-400 text-xs ml-1">{{ getVendorSpecialties(v).join('、') }}</span>
              </button>
              <div v-if="filteredVendorList.length === 0" class="px-3 py-2 text-sm text-gray-300">找不到符合廠商</div>
            </div>
          </div>
          <p v-if="regionVendors.length === 0" class="text-[11px] text-gray-400 mt-1">
            {{ selectedCategory ? `尚無「${selectedCategory}」廠商，請至設定新增` : '尚無廠商，請至設定 › 廠商管理新增' }}
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
            <div v-if="formVendorCostTotal > 0" class="text-right text-xs font-semibold mt-0.5 text-red-500">
              合計 ${{ formVendorCostTotal.toLocaleString() }}
            </div>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 font-medium mb-1 block">施作位置（選填）</label>
          <div class="flex flex-col gap-1.5">
            <div v-for="(loc, i) in form.locations" :key="loc.id"
              class="border border-gray-100 rounded-lg p-2 bg-gray-50/60">
              <div class="flex gap-1.5 mb-1.5">
                <input v-model="loc.label" type="text" placeholder="位置（例：浴室）"
                  class="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
                <button type="button" @click="removeLocation(i)"
                  class="text-[10px] text-red-400 hover:text-red-600 px-1 flex-shrink-0">✕</button>
              </div>
              <div class="grid grid-cols-2 gap-1.5 mb-1.5">
                <input :value="loc.startDate" type="date"
                  @input="loc.startDate = $event.target.value"
                  class="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
                <input :value="loc.endDate" type="date"
                  @input="loc.endDate = $event.target.value"
                  class="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
              </div>
              <input v-model="loc.note" type="text" placeholder="備註"
                class="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 bg-white">
            </div>
            <button type="button" @click="addLocation"
              class="text-[11px] border border-dashed border-gray-200 rounded-lg py-1.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors w-full">
              + 新增施作位置
            </button>
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
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border-t-4" style="border-top-color:#c9a96e">
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

  <!-- construction photo file input & lightbox -->
  <input ref="wtConstructFileInput" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.pdf" multiple class="hidden" @change="handleWtConstructFiles">
  <div v-if="previewWtConstructUrl" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    @click.self="previewWtConstructUrl = null">
    <button v-if="previewWtConstructIdx > 0" @click="navigateWtConstruct(-1)"
      class="absolute left-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">‹</button>
    <img :src="previewWtConstructUrl" class="max-h-[80vh] max-w-[90vw] rounded-xl cursor-default">
    <button v-if="previewWtConstructIdx < wtConstructImgList.length - 1" @click="navigateWtConstruct(1)"
      class="absolute right-4 text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 select-none z-10">›</button>
  </div>

  <!-- construction folder picker modal -->
  <div v-if="showWtFolderPicker" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-5 w-72 mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-gray-800">選擇上傳位置</h3>
        <button @click="showWtFolderPicker = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-0.5">
        <label class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input type="radio" v-model="pendingWtFolderId" :value="null" class="accent-amber-600">
          <span class="text-sm text-gray-700">📂 不分類</span>
        </label>
        <label v-for="folder in wtFoldersForWt(wtPickerWtId)" :key="folder.id"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input type="radio" v-model="pendingWtFolderId" :value="folder.id" class="accent-amber-600">
          <div>
            <div class="text-sm text-gray-700">📁 {{ folder.label }}</div>
            <div v-if="folder.description" class="text-[10px] text-gray-400">{{ folder.description }}</div>
          </div>
        </label>
      </div>
      <button @click="openWtFolderFormFromPicker"
        class="mt-3 w-full text-[11px] border border-dashed border-gray-200 rounded-lg py-1.5 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
        + 新增資料夾
      </button>
      <div class="flex justify-end gap-2 mt-4">
        <button @click="showWtFolderPicker = false" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="confirmWtFolderPick" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">確認上傳</button>
      </div>
    </div>
  </div>

  <!-- construction folder create/edit modal -->
  <div v-if="showWtFolderForm" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,0.4)">
    <div class="bg-white rounded-2xl shadow-xl p-5 w-80 mx-4 border-t-4" style="border-top-color:#c9a96e">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-gray-800">{{ editingWtFolderId ? '編輯資料夾' : '新增資料夾' }}</h3>
        <button @click="closeWtFolderForm" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 mb-1 block">資料夾名稱 *</label>
          <input v-model="wtFolderForm.label" type="text"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
            placeholder="例：拆除、木作、油漆…">
        </div>
        <div>
          <label class="text-xs text-gray-500 mb-1 block">說明（選填）</label>
          <input v-model="wtFolderForm.description" type="text"
            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1"
            placeholder="備註說明…">
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="closeWtFolderForm" class="text-sm text-gray-400 px-4 py-2">取消</button>
        <button @click="saveWtFolder" class="text-sm text-white px-5 py-2 rounded-xl" style="background:#1e2533">儲存</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { WT_COLORS } from '@/constants/workTypeColors'
import { isLegacyCategoryName } from '@/utils/workTypeCategory'
import { getVendorSpecialties, filterVendorsByCategory } from '@/utils/vendorSpecialty'
import { useVendorsStore } from '@/stores/vendors'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'
import { useUsersStore } from '@/stores/users'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'

function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calcVendorDueDate(endDate) {
    const d = new Date(endDate + 'T00:00:00')
    const day = d.getDate()
    const nextMonthDate = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const year = nextMonthDate.getFullYear()
    const month = nextMonthDate.getMonth()
    const targetDay = day <= 15 ? 15 : new Date(year, month + 1, 0).getDate()
    const result = new Date(year, month, targetDay)
    while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() + 1)
    return toDateStr(result)
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
const usersStore = useUsersStore()
const { toast } = useToast()

const showForm = ref(false)
const saving = ref(false)
const editingIdx = ref(null)
const form = ref({
    name: '', vendorId: '', startDate: '', endDate: '',
    hasQuote: false, hasSchedule: false,
    vendorCostItems: [], vendorCostFree: false,
    costIncludesTax: false, locations: [], customName: false,
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

// Construction photos per work type
const wtConstructPhotos = reactive({})
const wtConstructFileInput = ref(null)
const activeWtConstructId = ref('')
const activeWtConstructFolderId = ref(null)
const previewWtConstructUrl = ref(null)
const previewWtConstructWtId = ref('')
const previewWtConstructIdx = ref(-1)
const wtFolderExpanded = reactive({})
const showWtFolderPicker = ref(false)
const wtPickerWtId = ref('')
const pendingWtFolderId = ref(null)
const showWtFolderForm = ref(false)
const wtFolderFormWtId = ref('')
const editingWtFolderId = ref(null)
const wtFolderForm = ref({ label: '', description: '' })
const wtFolderFromPicker = ref(false)

const wtPhotoFolders = computed(() => caseData.value?.wtPhotoFolders ?? [])
const wtConstructImgList = computed(() =>
    (wtConstructPhotos[previewWtConstructWtId.value] || []).filter(p => !p.isPdf)
)

function wtFoldersForWt(wtId) {
    return wtPhotoFolders.value.filter(f => f.workTypeId === wtId)
}

function wtPhotosInFolder(wtId, folderId) {
    const validIds = new Set(wtPhotoFolders.value.map(f => f.id))
    return (wtConstructPhotos[wtId] || []).filter(p => {
        const eff = p.folderId && validIds.has(p.folderId) ? p.folderId : null
        return folderId === null ? eff === null : eff === folderId
    })
}

function wtConstructPhotoCount(wtId) {
    return (wtConstructPhotos[wtId] || []).length
}

function toggleWtFolder(folderId) {
    wtFolderExpanded[folderId] = wtFolderExpanded[folderId] === false ? true : false
}

function openWtConstructPreview(wtId, item) {
    const list = (wtConstructPhotos[wtId] || []).filter(p => !p.isPdf)
    previewWtConstructWtId.value = wtId
    previewWtConstructIdx.value = list.findIndex(p => p === item)
    previewWtConstructUrl.value = item.url
}

function navigateWtConstruct(dir) {
    const next = previewWtConstructIdx.value + dir
    if (next >= 0 && next < wtConstructImgList.value.length) {
        previewWtConstructIdx.value = next
        previewWtConstructUrl.value = wtConstructImgList.value[next].url
    }
}

function openWtFolderForm(wtId) {
    wtFolderFormWtId.value = wtId
    editingWtFolderId.value = null
    wtFolderForm.value = { label: '', description: '' }
    wtFolderFromPicker.value = false
    showWtFolderForm.value = true
}

function openWtFolderFormFromPicker() {
    showWtFolderPicker.value = false
    wtFolderFormWtId.value = wtPickerWtId.value
    editingWtFolderId.value = null
    wtFolderForm.value = { label: '', description: '' }
    wtFolderFromPicker.value = true
    showWtFolderForm.value = true
}

function editWtFolder(folder) {
    wtFolderFormWtId.value = folder.workTypeId
    editingWtFolderId.value = folder.id
    wtFolderForm.value = { label: folder.label, description: folder.description || '' }
    wtFolderFromPicker.value = false
    showWtFolderForm.value = true
}

function closeWtFolderForm() {
    showWtFolderForm.value = false
    if (wtFolderFromPicker.value) { wtFolderFromPicker.value = false; showWtFolderPicker.value = true }
}

async function saveWtFolder() {
    if (!wtFolderForm.value.label.trim()) return
    const folders = [...wtPhotoFolders.value]
    let newId = null
    if (editingWtFolderId.value) {
        const idx = folders.findIndex(f => f.id === editingWtFolderId.value)
        if (idx >= 0) folders[idx] = { ...folders[idx], label: wtFolderForm.value.label.trim(), description: wtFolderForm.value.description.trim() }
    } else {
        newId = `wtf_${Date.now()}`
        folders.push({ id: newId, workTypeId: wtFolderFormWtId.value, label: wtFolderForm.value.label.trim(), description: wtFolderForm.value.description.trim() })
    }
    await casesStore.updateCase(props.caseId, { wtPhotoFolders: folders })
    showWtFolderForm.value = false
    if (wtFolderFromPicker.value) {
        wtFolderFromPicker.value = false
        if (newId) pendingWtFolderId.value = newId
        showWtFolderPicker.value = true
    }
}

async function deleteWtFolder(folderId) {
    if (!confirm('確定刪除此資料夾？照片將移至未分類。')) return
    const folders = wtPhotoFolders.value.filter(f => f.id !== folderId)
    await casesStore.updateCase(props.caseId, { wtPhotoFolders: folders })
}

function triggerWtConstructUpload(wtId) {
    activeWtConstructId.value = wtId
    if (wtFoldersForWt(wtId).length > 0) {
        wtPickerWtId.value = wtId
        pendingWtFolderId.value = null
        showWtFolderPicker.value = true
    } else {
        activeWtConstructFolderId.value = null
        wtConstructFileInput.value?.click()
    }
}

function uploadToWtFolder(wtId, folderId) {
    activeWtConstructId.value = wtId
    activeWtConstructFolderId.value = folderId
    wtConstructFileInput.value?.click()
}

function confirmWtFolderPick() {
    activeWtConstructFolderId.value = pendingWtFolderId.value
    showWtFolderPicker.value = false
    wtConstructFileInput.value?.click()
}

async function handleWtConstructFiles(e) {
    const files = Array.from(e.target.files)
    e.target.value = ''
    const wtId = activeWtConstructId.value
    const folderId = activeWtConstructFolderId.value
    for (const file of files) {
        const err = validateUploadFile(file)
        if (err) { toast(err, 'error'); continue }
        try {
            const url = await uploadPhoto(file, 'wt_construction')
            const isPdf = file.name.toLowerCase().endsWith('.pdf')
            const pdfUrl = isPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            const uploadedBy = authStore.user?.uid ?? 'unknown'
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'wt_construction', workTypeId: wtId,
                folderId: folderId ?? null,
                url, isPdf,
                uploadedBy,
                createdAt: serverTimestamp(),
            })
            if (!wtConstructPhotos[wtId]) wtConstructPhotos[wtId] = []
            wtConstructPhotos[wtId].push({ id: docRef.id, url, isPdf, pdfUrl, folderId: folderId ?? null, createdAt: { toDate: () => new Date() }, uploadedBy })
        } catch {
            toast('上傳失敗，請重試', 'error')
        }
    }
}

async function deleteWtConstructPhoto(wtId, item) {
    if (item.id && props.caseId) {
        await deleteDoc(doc(db, 'cases', props.caseId, 'photos', item.id))
    }
    if (wtConstructPhotos[wtId]) {
        wtConstructPhotos[wtId] = wtConstructPhotos[wtId].filter(p => p !== item)
    }
}

function sumItems(items, free) {
    if (free) return 0
    return (items || []).reduce((s, i) => s + (i.amount || 0), 0)
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

function addVendorCostItem() {
    form.value.vendorCostItems.push({ id: `vc_${Date.now()}`, description: '', amount: 0, note: '' })
}
function removeVendorCostItem(i) {
    form.value.vendorCostItems.splice(i, 1)
}
function addLocation() {
    form.value.locations.push({ id: `loc_${Date.now()}`, label: '', startDate: '', endDate: '', note: '' })
}
function removeLocation(i) {
    form.value.locations.splice(i, 1)
}

const formVendorCostTotal = computed(() =>
    form.value.vendorCostItems.reduce((s, i) => s + (i.amount || 0), 0)
)

const selectedCategory = ref('')
function onCategoryChange() {
    if (selectedCategory.value) form.value.name = selectedCategory.value
}
const isLegacyCustomName = computed(() =>
    !form.value.customName && isLegacyCategoryName(selectedCategory.value, form.value.name, WORK_CATEGORIES)
)
function clearLegacyCustomName() {
    form.value.name = ''
}

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

function uploaderName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? '未知'
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
    const effectiveEndDate = wt.endDate || new Date().toISOString().slice(0, 10)
    const dueDate = calcVendorDueDate(effectiveEndDate)
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
        endDate: wt.endDate || '',
        createdBy: authStore.user?.uid ?? '',
        createdByName: authStore.name ?? '',
    })
    toast(`已完工，廠商付款提醒：${formatDateChinese(dueDate)}`)
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
    if (previewWtConstructUrl.value) {
        if (e.key === 'Escape') { previewWtConstructUrl.value = null; return }
        if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); navigateWtConstruct(1) }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateWtConstruct(-1) }
        return
    }
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
        const { type, url, isPdf, workTypeId, folderId, createdAt, uploadedBy } = d.data()
        const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
        const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
        if (type === 'vendor_quote' && workTypeId) {
            if (!vendorPhotos[workTypeId]) vendorPhotos[workTypeId] = []
            vendorPhotos[workTypeId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, createdAt, uploadedBy })
        } else if (type === 'wt_construction' && workTypeId) {
            if (!wtConstructPhotos[workTypeId]) wtConstructPhotos[workTypeId] = []
            wtConstructPhotos[workTypeId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, folderId: folderId ?? null, createdAt, uploadedBy })
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
            const uploadedBy = authStore.user?.uid ?? 'unknown'
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'vendor_quote',
                workTypeId: activeWtId.value,
                url, isPdf,
                uploadedBy,
                createdAt: serverTimestamp()
            })
            if (!vendorPhotos[activeWtId.value]) vendorPhotos[activeWtId.value] = []
            vendorPhotos[activeWtId.value].push({ id: docRef.id, url, isPdf, pdfUrl, createdAt: { toDate: () => new Date() }, uploadedBy })
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
    return filterVendorsByCategory(vendors, selectedCategory.value, WORK_CATEGORIES)
})
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
        hasQuote: false, hasSchedule: false,
        vendorCostItems: [], vendorCostFree: false,
        costIncludesTax: false, locations: [], customName: false,
    }
    showForm.value = true
}

function openEdit(idx) {
    editingIdx.value = idx
    const wt = workTypes.value[idx]
    selectedCategory.value = WORK_CATEGORIES.includes(wt.name) ? wt.name : ''
    vendorSearch.value = wt.vendorName || ''
    form.value = {
        name: wt.name,
        vendorId: wt.vendorId || '',
        startDate: wt.startDate || '',
        endDate: wt.endDate || '',
        hasQuote: wt.hasQuote || false,
        hasSchedule: wt.hasSchedule || false,
        vendorCostItems: normalizeItems(wt.vendorCostItems, wt.vendorCost, 'vc'),
        vendorCostFree: wt.vendorCostFree || false,
        costIncludesTax: wt.costIncludesTax || false,
        locations: (wt.locations || []).map(l => ({ ...l })),
        customName: wt.customName || false,
    }
    showForm.value = true
}

function openVendorPay(idx) {
    vendorPayingIdx.value = idx
    vendorPayForm.value = { amount: 0, paidDate: '', note: '' }
    showVendorPayForm.value = true
}

function buildVendorChangeLines(existing, entry) {
    const fallbackToday = new Date().toISOString().slice(0, 10)
    const oldDue = calcVendorDueDate(existing.endDate || fallbackToday)
    const newDue = calcVendorDueDate(entry.endDate || fallbackToday)
    const oldAmount = wtVendorCostTotal(existing)
    const newAmount = wtVendorCostTotal(entry)
    const lines = []
    if ((existing.endDate || '') !== (entry.endDate || '')) {
        lines.push(`完工日期：${existing.endDate ? formatDateChinese(existing.endDate) : '未設'} → ${entry.endDate ? formatDateChinese(entry.endDate) : '未設'}`)
    }
    if (oldDue !== newDue) {
        lines.push(`付款到期日：${formatDateChinese(oldDue)} → ${formatDateChinese(newDue)}`)
    }
    if (oldAmount !== newAmount) {
        lines.push(`廠商金額：$${oldAmount.toLocaleString()} → $${newAmount.toLocaleString()}`)
    }
    return { lines, dueDate: newDue, amount: newAmount }
}

async function submitForm() {
    if (!form.value.name || saving.value) return
    const vendor = vendorsStore.vendors.find(v => v.id === form.value.vendorId)
    const existing = editingIdx.value !== null ? workTypes.value[editingIdx.value] : null
    const entry = {
        id: existing ? existing.id : `wt_${Date.now()}`,
        name: form.value.name,
        vendorId: form.value.vendorId || '',
        vendorName: vendor?.name ?? '',
        startDate: form.value.startDate || '',
        endDate: form.value.endDate || '',
        hasQuote: form.value.hasQuote || false,
        hasSchedule: form.value.hasSchedule || false,
        vendorCostItems: form.value.vendorCostFree ? [] : form.value.vendorCostItems.filter(i => i.description || i.amount > 0),
        vendorCostFree: form.value.vendorCostFree || false,
        costIncludesTax: form.value.costIncludesTax || false,
        color: existing ? existing.color : WT_COLORS[workTypes.value.length % WT_COLORS.length],
        vendorPayments: existing?.vendorPayments ?? [],
        done: existing?.done ?? false,
        invoiceReceived: existing?.invoiceReceived ?? false,
        invoiceTarget: existing?.invoiceTarget ?? null,
        locations: form.value.locations.filter(l => l.label),
        customName: existing?.customName ?? false,
    }

    let vendorChange = null
    if (existing?.done) {
        vendorChange = buildVendorChangeLines(existing, entry)
        if (vendorChange.lines.length > 0) {
            const confirmed = confirm(`確定要儲存這些變動嗎？\n\n${vendorChange.lines.join('\n')}\n\n此變動會同步更新首頁付款清單（若該筆款項已標記付款完成，金額將維持原紀錄不變）`)
            if (!confirmed) return
        }
    }

    saving.value = true
    try {
        const updated = [...workTypes.value]
        if (editingIdx.value !== null) {
            updated[editingIdx.value] = entry
        } else {
            updated.push(entry)
        }
        await casesStore.updateCase(props.caseId, { workTypes: updated })
        if (existing?.done && vendorChange?.lines?.length > 0) {
            try {
                await remindersStore.addAutoReminder(`auto_vendor_${entry.id}`, {
                    source: 'auto',
                    type: 'vendor',
                    dueDate: vendorChange.dueDate,
                    caseId: props.caseId,
                    caseName: props.caseName,
                    companyId: caseData.value?.companyId ?? '',
                    workTypeId: entry.id,
                    workTypeName: entry.name,
                    vendorName: entry.vendorName || '',
                    amount: vendorChange.amount,
                    endDate: entry.endDate || '',
                    createdBy: authStore.user?.uid ?? '',
                    createdByName: authStore.name ?? '',
                })
            } catch {
                toast('工種已儲存，但同步首頁付款清單失敗，請手動確認', 'error')
            }
        }
        notifStore.notifyAll(authStore.name ?? '', `更新了「${props.caseName}」的工種安排`, props.caseId, props.caseName, caseData.value?.companyId ?? '', '', 'worktype')
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
        endDate: wt.endDate || '',
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

async function toggleInvoice(idx) {
    const wt = workTypes.value[idx]
    const updated = [...workTypes.value]
    updated[idx] = { ...wt, invoiceReceived: !wt.invoiceReceived }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    toast(wt.invoiceReceived ? '已取消發票確認' : '發票已確認')
}

const INVOICE_TARGET_LABELS = { naiship: '奈拾', boyan: '柏延' }

async function setInvoiceTarget(idx, target) {
    const wt = workTypes.value[idx]
    const nextTarget = wt.invoiceTarget === target ? null : target
    const updated = [...workTypes.value]
    updated[idx] = { ...wt, invoiceTarget: nextTarget }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    toast(nextTarget ? `發票開立對象已設為${INVOICE_TARGET_LABELS[nextTarget]}` : '已取消開立對象')
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
        const totalPaid = totalVendorPaid(wt)
        const totalCost = wtVendorCostTotal(wt)
        if (totalCost > 0 && totalPaid >= totalCost) {
            try { await remindersStore.markDone(`auto_vendor_${wt.id}`) } catch (_) {}
        } else if (wt.done && totalCost > 0) {
            try {
                await remindersStore.addAutoReminder(`auto_vendor_${wt.id}`, {
                    source: 'auto',
                    type: 'vendor',
                    dueDate: calcVendorDueDate(wt.endDate || new Date().toISOString().slice(0, 10)),
                    caseId: props.caseId,
                    caseName: props.caseName,
                    companyId: caseData.value?.companyId ?? '',
                    workTypeId: wt.id,
                    workTypeName: wt.name,
                    vendorName: wt.vendorName || '',
                    amount: totalCost - totalPaid,
                    endDate: wt.endDate || '',
                    createdBy: authStore.user?.uid ?? '',
                    createdByName: authStore.name ?? '',
                })
            } catch (_) {}
        }
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
    } catch {
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
