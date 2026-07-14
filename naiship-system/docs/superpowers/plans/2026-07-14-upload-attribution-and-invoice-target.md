# Upload Attribution + Invoice Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show who uploaded each file (not just when) across the three independent photo/file galleries, and let employees tag each work type's invoice with a billing entity (奈拾/柏延) that's visible on the work-type card.

**Architecture:** Both features reuse data that already exists or fits directly into existing patterns — no new stores, no schema migrations beyond one new optional field. Feature 1 fixes three places that already write `uploadedBy` (uid) to Firestore but drop it when loading into local component state; each file gets the uid retained through its load/upload path and resolved to a name via the same `usersStore.users.find(u => u.id === uid)?.name` pattern already used elsewhere in this codebase (`WorkJournalLogCard.vue`, `CaseTasks.vue`). Feature 2 adds an `invoiceTarget` field to the `workTypes` array item (same array-overwrite persistence as the existing `invoiceReceived` toggle) with a two-button inline control.

**Tech Stack:** Vue 3 `<script setup>`, Pinia stores, Firestore (`cases/{caseId}/photos` subcollection, `cases.workTypes` array field). No test harness exists for these three Vue components (no component-mount tests anywhere in `tests/` for case-detail components) — verification is manual via `npm run dev` in the browser, consistent with how this codebase already validates this class of change.

---

## Before you start

Run the dev server once and keep it running in the background for manual verification after each task:

```bash
cd "C:\AI助理 Claude\.claude\worktrees\vendor-bidding-multi-location\naiship-system"
npm run dev
```

Open a case with at least one work type that has an uploaded vendor quote photo and a construction photo, so you have real data to check against after each task. If none exists, create one via the UI first (add a work type, upload one photo to "廠商報價單" and one to "施工照片").

---

### Task 1: PhotoUpload.vue — retain and display uploader name

**Files:**
- Modify: `src/components/cases/PhotoUpload.vue`

- [ ] **Step 1: Add the `useUsersStore` import and instance**

In `src/components/cases/PhotoUpload.vue`, find the import block (around line 218-226):

```js
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useCasesStore } from '@/stores/cases'
import { useNavStore } from '@/stores/nav'
```

Replace with:

```js
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useCasesStore } from '@/stores/cases'
import { useNavStore } from '@/stores/nav'
import { useUsersStore } from '@/stores/users'
```

Then find where the other stores are instantiated (around line 229-232):

```js
const navStore = useNavStore()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const casesStore = useCasesStore()
```

Replace with:

```js
const navStore = useNavStore()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const casesStore = useCasesStore()
const usersStore = useUsersStore()
```

- [ ] **Step 2: Add the `uploaderName` helper next to `formatTime`**

Find `formatTime` (around line 291-295):

```js
function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
```

Add immediately after it:

```js
function uploaderName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? '未知'
}
```

- [ ] **Step 3: Retain `uploadedBy` when loading existing photos**

Find `onMounted` (around line 327-349):

```js
onMounted(async () => {
    window.addEventListener('keydown', handleKeydown)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, folderId, createdAt } = d.data()
        const resolvedType = type === 'construction' ? 'survey' : type
        if (photos[resolvedType] !== undefined) {
            const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
            const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            photos[resolvedType].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, folderId: folderId ?? null, createdAt })
        }
    })
```

Replace the destructure and push lines with:

```js
        const { type, url, isPdf, folderId, createdAt, uploadedBy } = d.data()
        const resolvedType = type === 'construction' ? 'survey' : type
        if (photos[resolvedType] !== undefined) {
            const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
            const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
            photos[resolvedType].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, folderId: folderId ?? null, createdAt, uploadedBy })
        }
```

- [ ] **Step 4: Carry `uploadedBy` into the record pushed right after upload**

Find `uploadFiles` (around line 433-468), specifically these lines:

```js
            const docData = {
                type: typeKey, url, isPdf,
                folderId: folderId ?? null,
                uploadedBy: authStore.user?.uid ?? 'unknown',
                createdAt: serverTimestamp(),
            }
            if (props.caseId) {
                const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), docData)
                photos[typeKey].push({ id: docRef.id, url, isPdf, pdfUrl, folderId: folderId ?? null, createdAt: { toDate: () => new Date() } })
            } else {
                photos[typeKey].push({ id: null, url, isPdf, pdfUrl, folderId: folderId ?? null, createdAt: { toDate: () => new Date() } })
            }
```

Replace with:

```js
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
```

- [ ] **Step 5: Show the uploader name in all three thumbnail grids**

There are three identical timestamp spans in the template (folder photos, unfiled photos, flat/no-folder photos) — around lines 79, 106, and 127:

```html
                    <span class="text-[9px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }}</span>
```

Replace **all three** occurrences with:

```html
                    <span class="text-[9px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
```

- [ ] **Step 6: Manual verification**

With `npm run dev` running, open a case, expand "檔案管理", and upload a new test photo to any type (e.g. 場勘). Confirm the thumbnail caption shows `M/D HH:MM · <your name>`. Refresh the page and confirm it still shows your name after reload (proves the `onMounted` load path also carries `uploadedBy` correctly, not just the immediate post-upload path).

- [ ] **Step 7: Commit**

```bash
cd "C:\AI助理 Claude\.claude\worktrees\vendor-bidding-multi-location\naiship-system"
git add src/components/cases/PhotoUpload.vue
git commit -m "$(cat <<'EOF'
feat(cases): show uploader name in PhotoUpload file galleries

uploadedBy was already written to Firestore on every upload but
dropped when loading photos into local state, so it never rendered.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: WorkTypePanel.vue — retain and display uploader name (vendor quotes + construction photos)

**Files:**
- Modify: `src/components/cases/WorkTypePanel.vue`

- [ ] **Step 1: Add the `useUsersStore` import and instance**

Find the import block (around line 566-578):

```js
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { WT_COLORS } from '@/constants/workTypeColors'
import { isLegacyCategoryName } from '@/utils/workTypeCategory'
import { useVendorsStore } from '@/stores/vendors'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { usePaymentRemindersStore } from '@/stores/paymentReminders'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'
```

Replace with (adds one import line):

```js
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { WT_COLORS } from '@/constants/workTypeColors'
import { isLegacyCategoryName } from '@/utils/workTypeCategory'
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
```

Find the store instantiations (around line 602-608):

```js
const props = defineProps({ caseId: String, caseName: String })
const vendorsStore = useVendorsStore()
const casesStore = useCasesStore()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const remindersStore = usePaymentRemindersStore()
const { toast } = useToast()
```

Replace with:

```js
const props = defineProps({ caseId: String, caseName: String })
const vendorsStore = useVendorsStore()
const casesStore = useCasesStore()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const remindersStore = usePaymentRemindersStore()
const usersStore = useUsersStore()
const { toast } = useToast()
```

- [ ] **Step 2: Add the `uploaderName` helper next to `formatTime`**

Find `formatTime` (around line 869-873):

```js
function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
```

Add immediately after it:

```js
function uploaderName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? '未知'
}
```

- [ ] **Step 3: Retain `uploadedBy` when loading vendor-quote and construction photos**

Find `onMounted` (around line 951-968):

```js
onMounted(async () => {
    window.addEventListener('keydown', handleVendorKeydown)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, workTypeId, folderId, createdAt } = d.data()
        const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
        const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
        if (type === 'vendor_quote' && workTypeId) {
            if (!vendorPhotos[workTypeId]) vendorPhotos[workTypeId] = []
            vendorPhotos[workTypeId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, createdAt })
        } else if (type === 'wt_construction' && workTypeId) {
            if (!wtConstructPhotos[workTypeId]) wtConstructPhotos[workTypeId] = []
            wtConstructPhotos[workTypeId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, folderId: folderId ?? null, createdAt })
        }
    })
})
```

Replace with:

```js
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
```

- [ ] **Step 4: Carry `uploadedBy` into the record pushed right after a vendor-quote upload**

Find `handleVendorFiles` (around line 975-996):

```js
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'vendor_quote',
                workTypeId: activeWtId.value,
                url, isPdf,
                uploadedBy: authStore.user?.uid ?? 'unknown',
                createdAt: serverTimestamp()
            })
            if (!vendorPhotos[activeWtId.value]) vendorPhotos[activeWtId.value] = []
            vendorPhotos[activeWtId.value].push({ id: docRef.id, url, isPdf, pdfUrl, createdAt: { toDate: () => new Date() } })
```

Replace with:

```js
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
```

- [ ] **Step 5: Carry `uploadedBy` into the record pushed right after a construction-photo upload**

Find `handleWtConstructFiles` (around line 770-794):

```js
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'wt_construction', workTypeId: wtId,
                folderId: folderId ?? null,
                url, isPdf,
                uploadedBy: authStore.user?.uid ?? 'unknown',
                createdAt: serverTimestamp(),
            })
            if (!wtConstructPhotos[wtId]) wtConstructPhotos[wtId] = []
            wtConstructPhotos[wtId].push({ id: docRef.id, url, isPdf, pdfUrl, folderId: folderId ?? null, createdAt: { toDate: () => new Date() } })
```

Replace with:

```js
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
```

- [ ] **Step 6: Show the uploader name in the vendor-quote thumbnail grid**

Find (around line 152):

```html
              <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }}</span>
              <button @click="deleteVendorPhoto(wt.id, item)"
```

Replace with:

```html
              <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
              <button @click="deleteVendorPhoto(wt.id, item)"
```

(This is the only occurrence of `deleteVendorPhoto(wt.id, item)` in the file, so the surrounding context makes this a unique match.)

- [ ] **Step 7: Show the uploader name in all three construction-photo thumbnail grids**

There are three identical timestamp spans (folder view, unfiled-in-folder-mode view, flat view) — around lines 212, 229, and 248:

```html
                    <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }}</span>
                    <button @click="deleteWtConstructPhoto(wt.id, item)"
```

Replace **all three** occurrences with:

```html
                    <span class="text-[8px] text-gray-400 leading-tight">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                    <button @click="deleteWtConstructPhoto(wt.id, item)"
```

- [ ] **Step 8: Manual verification**

With `npm run dev` running, open a work type with existing vendor-quote and construction photos, confirm both galleries now show `M/D HH:MM · <uploader name>`. Upload one new photo to each gallery and confirm the name appears immediately (not just after refresh). Refresh the page and confirm the names persist.

- [ ] **Step 9: Commit**

```bash
cd "C:\AI助理 Claude\.claude\worktrees\vendor-bidding-multi-location\naiship-system"
git add src/components/cases/WorkTypePanel.vue
git commit -m "$(cat <<'EOF'
feat(cases): show uploader name in WorkTypePanel photo galleries

Same uploadedBy-dropped-on-load issue as PhotoUpload.vue, fixed for
both the vendor-quote and construction-photo galleries.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: BidRequestPanel.vue — add time + uploader display (currently missing entirely)

**Files:**
- Modify: `src/components/cases/BidRequestPanel.vue`

- [ ] **Step 1: Add imports and store instances**

Find the import block (around line 155-165):

```js
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { useBidRequestsStore, buildWinningWorkType } from '@/stores/bidRequests'
import { useVendorsStore } from '@/stores/vendors'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const props = defineProps({ caseId: String, caseName: String })
const bidRequestsStore = useBidRequestsStore()
const vendorsStore = useVendorsStore()
const casesStore = useCasesStore()
const authStore = useAuthStore()
const { toast } = useToast()
```

Replace with:

```js
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { WORK_CATEGORIES } from '@/constants/workCategories'
import { useBidRequestsStore, buildWinningWorkType } from '@/stores/bidRequests'
import { useVendorsStore } from '@/stores/vendors'
import { useCasesStore } from '@/stores/cases'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useToast } from '@/composables/useToast'
import { uploadPhoto, validateUploadFile } from '@/composables/useStorage'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const props = defineProps({ caseId: String, caseName: String })
const bidRequestsStore = useBidRequestsStore()
const vendorsStore = useVendorsStore()
const casesStore = useCasesStore()
const authStore = useAuthStore()
const usersStore = useUsersStore()
const { toast } = useToast()
```

- [ ] **Step 2: Add `formatTime` and `uploaderName` helpers**

Find `hideVendorDropdown` (around line 239-241):

```js
function hideVendorDropdown() {
    setTimeout(() => { showVendorDropdown.value = false }, 150)
}
```

Add immediately after it:

```js

function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate?.() ?? new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function uploaderName(uid) {
    return usersStore.users.find(u => u.id === uid)?.name ?? '未知'
}
```

- [ ] **Step 3: Retain `createdAt` and `uploadedBy` when loading quote photos**

Find `onMounted` (around line 334-347):

```js
onMounted(async () => {
    bidRequestsStore.subscribe(props.caseId)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, bidEntryId } = d.data()
        if (type !== 'bid_quote' || !bidEntryId) return
        const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
        const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
        if (!quotePhotos[bidEntryId]) quotePhotos[bidEntryId] = []
        quotePhotos[bidEntryId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl })
    })
})
```

Replace with:

```js
onMounted(async () => {
    bidRequestsStore.subscribe(props.caseId)
    if (!props.caseId) return
    const q = query(collection(db, 'cases', props.caseId, 'photos'), orderBy('createdAt'))
    const snap = await getDocs(q)
    snap.docs.forEach(d => {
        const { type, url, isPdf, bidEntryId, createdAt, uploadedBy } = d.data()
        if (type !== 'bid_quote' || !bidEntryId) return
        const resolvedIsPdf = isPdf ?? url.toLowerCase().endsWith('.pdf')
        const pdfUrl = resolvedIsPdf && !url.toLowerCase().endsWith('.pdf') ? url + '.pdf' : url
        if (!quotePhotos[bidEntryId]) quotePhotos[bidEntryId] = []
        quotePhotos[bidEntryId].push({ id: d.id, url, isPdf: resolvedIsPdf, pdfUrl, createdAt, uploadedBy })
    })
})
```

- [ ] **Step 4: Carry `createdAt`/`uploadedBy` into the record pushed right after upload**

Find `handleQuoteFiles` (around line 274-299):

```js
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'bid_quote', bidRequestId, bidEntryId,
                url, isPdf,
                uploadedBy: authStore.user?.uid ?? 'unknown',
                createdAt: serverTimestamp(),
            })
            await bidRequestsStore.appendQuotePhotoId(props.caseId, bidRequestId, bidEntryId, docRef.id)
            if (!quotePhotos[bidEntryId]) quotePhotos[bidEntryId] = []
            quotePhotos[bidEntryId].push({ id: docRef.id, url, isPdf, pdfUrl })
```

Replace with:

```js
            const uploadedBy = authStore.user?.uid ?? 'unknown'
            const docRef = await addDoc(collection(db, 'cases', props.caseId, 'photos'), {
                type: 'bid_quote', bidRequestId, bidEntryId,
                url, isPdf,
                uploadedBy,
                createdAt: serverTimestamp(),
            })
            await bidRequestsStore.appendQuotePhotoId(props.caseId, bidRequestId, bidEntryId, docRef.id)
            if (!quotePhotos[bidEntryId]) quotePhotos[bidEntryId] = []
            quotePhotos[bidEntryId].push({ id: docRef.id, url, isPdf, pdfUrl, createdAt: { toDate: () => new Date() }, uploadedBy })
```

- [ ] **Step 5: Add the time + uploader caption to the quote-photo thumbnails (currently absent)**

Find the quote-photo thumbnail block (around line 43-51):

```html
            <div v-if="quotePhotos[bid.id]?.length" class="flex gap-1 w-full">
              <div v-for="item in quotePhotos[bid.id]" :key="item.id" class="relative group">
                <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                  class="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-[8px] text-red-600 font-bold">PDF</a>
                <img v-else :src="item.url" class="w-8 h-8 rounded object-cover">
                <button v-if="br.status !== 'converted'" @click="deleteQuotePhoto(br.id, bid.id, item)"
                  class="absolute -top-1 -right-1 w-3 h-3 bg-gray-600 text-white rounded-full text-[7px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500">✕</button>
              </div>
            </div>
```

Replace with:

```html
            <div v-if="quotePhotos[bid.id]?.length" class="flex gap-1.5 w-full flex-wrap">
              <div v-for="item in quotePhotos[bid.id]" :key="item.id" class="relative group flex flex-col items-center gap-0.5">
                <a v-if="item.isPdf" :href="item.pdfUrl" target="_blank"
                  class="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-[8px] text-red-600 font-bold">PDF</a>
                <img v-else :src="item.url" class="w-8 h-8 rounded object-cover">
                <span class="text-[7px] text-gray-400 leading-tight whitespace-nowrap">{{ formatTime(item.createdAt) }} · {{ uploaderName(item.uploadedBy) }}</span>
                <button v-if="br.status !== 'converted'" @click="deleteQuotePhoto(br.id, bid.id, item)"
                  class="absolute -top-1 -right-1 w-3 h-3 bg-gray-600 text-white rounded-full text-[7px] leading-none hidden group-hover:flex items-center justify-center hover:bg-red-500">✕</button>
              </div>
            </div>
```

- [ ] **Step 6: Manual verification**

With `npm run dev` running, open a case's "廠商比價" section, upload a report quote photo to a bid, and confirm the thumbnail now shows a caption `M/D HH:MM · <your name>` underneath it (previously showed nothing at all). Refresh and confirm it persists.

- [ ] **Step 7: Commit**

```bash
cd "C:\AI助理 Claude\.claude\worktrees\vendor-bidding-multi-location\naiship-system"
git add src/components/cases/BidRequestPanel.vue
git commit -m "$(cat <<'EOF'
feat(cases): show upload time + uploader name for bid quote photos

BidRequestPanel never loaded createdAt/uploadedBy at all, so quote
photo thumbnails had no caption. Brings it in line with the other
two photo galleries in the app.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: WorkTypePanel.vue — add `invoiceTarget` field and toggle handler

**Files:**
- Modify: `src/components/cases/WorkTypePanel.vue`

- [ ] **Step 1: Add `invoiceTarget` to the work-type entry shape in `submitForm`**

Find (around line 1096-1113):

```js
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
        locations: form.value.locations.filter(l => l.label),
    }
```

Replace with:

```js
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
    }
```

- [ ] **Step 2: Add the `setInvoiceTarget` handler**

Find `toggleInvoice` (around line 1206-1212):

```js
async function toggleInvoice(idx) {
    const wt = workTypes.value[idx]
    const updated = [...workTypes.value]
    updated[idx] = { ...wt, invoiceReceived: !wt.invoiceReceived }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    toast(wt.invoiceReceived ? '已取消發票確認' : '發票已確認')
}
```

Add immediately after it:

```js

const INVOICE_TARGET_LABELS = { naiship: '奈拾', boyan: '柏延' }

async function setInvoiceTarget(idx, target) {
    const wt = workTypes.value[idx]
    const nextTarget = wt.invoiceTarget === target ? null : target
    const updated = [...workTypes.value]
    updated[idx] = { ...wt, invoiceTarget: nextTarget }
    await casesStore.updateCase(props.caseId, { workTypes: updated })
    toast(nextTarget ? `發票開立對象已設為${INVOICE_TARGET_LABELS[nextTarget]}` : '已取消開立對象')
}
```

- [ ] **Step 3: No automated test — this is a Firestore-backed toggle identical in shape to the existing, untested `toggleInvoice`/`toggleVendorInvoice` handlers in this file. Manual verification happens in Task 5 once the UI exists to trigger it.**

- [ ] **Step 4: Commit**

```bash
cd "C:\AI助理 Claude\.claude\worktrees\vendor-bidding-multi-location\naiship-system"
git add src/components/cases/WorkTypePanel.vue
git commit -m "$(cat <<'EOF'
feat(cases): add invoiceTarget field and toggle handler to work types

No UI wired up yet (next commit) - this just adds the persisted
naiship/boyan field alongside the existing invoiceReceived toggle.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: WorkTypePanel.vue — invoice-target UI on the work-type card

**Files:**
- Modify: `src/components/cases/WorkTypePanel.vue`

- [ ] **Step 1: Add the two-button toggle row + required-field reminder badge**

Find the end of the main row and the start of the locations section (around line 117-119):

```html
        </div>
        </div>

        <div v-if="wt.locations?.length" class="mt-2 pt-2 border-t border-gray-100">
```

Replace with:

```html
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
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running:
1. Open a work type that is marked 完工 (done) and has a non-zero, non-free vendor cost — confirm the new "開立對象" row appears below the action-buttons row, showing a red "未選開立對象" badge and two gray buttons "奈拾"/"柏延".
2. Click "奈拾" — confirm it turns amber/highlighted, the other stays gray, and the red "未選開立對象" badge disappears.
3. Refresh the page — confirm "奈拾" is still highlighted (proves persistence via `casesStore.updateCase`).
4. Click "奈拾" again (the already-selected one) — confirm it un-highlights and the red reminder badge reappears (toggle-off behavior, matching the existing `確認發票` button's "click again to un-confirm" pattern).
5. Click "柏延" — confirm it becomes highlighted and "奈拾" is not.
6. Open a work type that is NOT done, or has zero/free vendor cost — confirm the whole "開立對象" row does not render at all (same gating as the 確認發票 button).

- [ ] **Step 3: Commit**

```bash
cd "C:\AI助理 Claude\.claude\worktrees\vendor-bidding-multi-location\naiship-system"
git add src/components/cases/WorkTypePanel.vue
git commit -m "$(cat <<'EOF'
feat(cases): add 開立對象 (奈拾/柏延) toggle UI to work-type cards

Lets employees mark which entity a work type's vendor invoice should
be billed to, so they can tell the vendor without leaving the case
detail page. Required field - unset shows a red reminder badge.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final check (after all 5 tasks)

- [ ] Run the full test suite to make sure nothing else broke:

```bash
cd "C:\AI助理 Claude\.claude\worktrees\vendor-bidding-multi-location\naiship-system"
npx vitest run
```

Expected: all existing tests still pass (this plan touches no store logic covered by `tests/stores/*`, only three Vue SFCs with no existing test files).

- [ ] Run a production build to catch any template/syntax errors the dev server tolerates:

```bash
npm run build
```

Expected: builds cleanly, same as before this plan.

- [ ] Do a final manual pass through all three galleries (PhotoUpload, WorkTypePanel ×2, BidRequestPanel) plus the invoice-target toggle in one case, since these five commits touch overlapping areas of two files and a regression in an earlier task could be masked until everything is applied together.
