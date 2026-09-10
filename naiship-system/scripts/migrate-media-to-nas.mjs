import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { urlKind, replaceInStringArray, rewriteAttachmentUrl, deriveExt } from './lib/media-migration.mjs'

const MAP_FILE = './migrate-media-map.tsv'
const FAIL_FILE = './migrate-media-failures.log'
const REVERSE_UNMAPPED_FILE = './migrate-media-reverse-unmapped.log'
const NAS_UPLOAD = process.env.NAS_BASE_URL
  ? `${process.env.NAS_BASE_URL}/upload`
  : 'https://nextdesign.myqnapcloud.com/media/upload'

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const REVERSE = args.includes('--reverse')
const LIMIT = numArg('--limit', Infinity)
const BATCH = numArg('--batch', 100)
function numArg(flag, dflt) {
  const i = args.indexOf(flag)
  if (i < 0) return dflt
  const raw = args[i + 1]
  if (raw === undefined) return dflt // flag 在最後一個位置，無值 → 用預設
  const n = Number(raw)
  if (raw === '' || raw.startsWith('--') || !Number.isFinite(n)) {
    console.error(`參數 ${flag} 需要數字，收到：「${raw}」`)
    process.exit(1)
  }
  return n
}

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

// ─────────────────────────── ID token（custom token → REST 換 ID token）────────
let cachedIdToken = null
async function getIdToken(forceRefresh = false) {
  if (cachedIdToken && !forceRefresh) return cachedIdToken
  const { getAuth } = await import('firebase-admin/auth')
  const customToken = await getAuth().createCustomToken('media-migration-bot')
  const apiKey = process.env.FIREBASE_WEB_API_KEY
  if (!apiKey) throw new Error('請設環境變數 FIREBASE_WEB_API_KEY（.env 裡的 VITE_FIREBASE_API_KEY 值）')
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(`換 ID token 失敗：${JSON.stringify(data)}`)
  cachedIdToken = data.idToken
  return cachedIdToken
}

// ─────────────────────────── 網路：逾時 + 429/5xx 退避重試 ─────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const backoffMs = (attempt) => 2 ** (attempt - 1) * 1000 // 1s, 2s, 4s

async function fetchWithRetry(url, opts = {}) {
  const MAX = 3
  for (let attempt = 1; attempt <= MAX; attempt++) {
    let res
    try {
      res = await fetch(url, { ...opts, signal: AbortSignal.timeout(120000) })
    } catch (e) {
      if (attempt < MAX) { await sleep(backoffMs(attempt)); continue }
      throw new Error(`${e.name === 'TimeoutError' ? '請求逾時' : '連線失敗'}：${e.message}`)
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
      const ra = Number(res.headers.get('retry-after'))
      await res.body?.cancel().catch(() => {}) // 釋放 socket
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoffMs(attempt))
      continue
    }
    return res
  }
}

// ─────────────────────────── 掃描：所有媒體網址位置 ───────────────────────────
// 這裡是唯一的完整掃描來源。scripts/audit-media-urls.mjs 是操作員可另外手動跑的
// 獨立健檢工具（涵蓋相同位置），本腳本執行時不依賴它。
// 每個 item：{ category, describe, currentUrl, type, isPdf?, rewrite(newUrl) }

function collectScalar(items, docSnap, field, meta) {
  const oldUrl = docSnap.data()[field]
  if (typeof oldUrl !== 'string' || !oldUrl) return
  items.push({
    category: meta.category,
    describe: `${docSnap.ref.path}.${field}`,
    currentUrl: oldUrl,
    type: meta.type,
    isPdf: meta.isPdf === true,
    rewrite: (newUrl) => docSnap.ref.update({ [field]: newUrl }),
  })
}

function collectObjectArray(items, docSnap, field, urlKey, meta) {
  const arr = docSnap.data()[field]
  if (!Array.isArray(arr)) return
  for (const el of arr) {
    if (!el || typeof el[urlKey] !== 'string' || !el[urlKey]) continue
    const oldUrl = el[urlKey]
    items.push({
      category: meta.category,
      describe: `${docSnap.ref.path}.${field}[${urlKey}]`,
      currentUrl: oldUrl,
      type: meta.type,
      isPdf: meta.isPdfOf ? meta.isPdfOf(el) === true : false,
      rewrite: (newUrl) => db.runTransaction(async (tx) => {
        const snap = await tx.get(docSnap.ref)
        const cur = snap.data()[field] || []
        tx.update(docSnap.ref, { [field]: rewriteAttachmentUrl(cur, urlKey, oldUrl, newUrl, meta.fixPdfUrl) })
      }),
    })
  }
}

function collectStringArray(items, docSnap, field, meta) {
  const arr = docSnap.data()[field]
  if (!Array.isArray(arr)) return
  for (const oldUrl of arr) {
    if (typeof oldUrl !== 'string' || !oldUrl) continue
    items.push({
      category: meta.category,
      describe: `${docSnap.ref.path}.${field}[]`,
      currentUrl: oldUrl,
      type: meta.type,
      isPdf: meta.isPdf === true,
      rewrite: (newUrl) => db.runTransaction(async (tx) => {
        const snap = await tx.get(docSnap.ref)
        const cur = snap.data()[field] || []
        tx.update(docSnap.ref, { [field]: replaceInStringArray(cur, oldUrl, newUrl) })
      }),
    })
  }
}

// images[] 陣列元素可能是字串或 { url } 物件（progressNotes / reviews）
function collectImageLikeArray(items, docSnap, field, meta) {
  const arr = docSnap.data()[field]
  if (!Array.isArray(arr)) return
  for (const el of arr) {
    const oldUrl = typeof el === 'string' ? el : (el && typeof el.url === 'string' ? el.url : '')
    if (!oldUrl) continue
    items.push({
      category: meta.category,
      describe: `${docSnap.ref.path}.${field}[]`,
      currentUrl: oldUrl,
      type: meta.type,
      isPdf: false,
      rewrite: (newUrl) => db.runTransaction(async (tx) => {
        const snap = await tx.get(docSnap.ref)
        const cur = snap.data()[field] || []
        tx.update(docSnap.ref, {
          [field]: cur.map(v => {
            if (v === oldUrl) return newUrl
            if (v && v.url === oldUrl) return { ...v, url: newUrl }
            return v
          }),
        })
      }),
    })
  }
}

function underParent(docSnap, expectedParentCollectionId) {
  // collectionGroup 會撈到任何同名子集合，鎖定預期的祖父集合
  return docSnap.ref.parent.parent?.parent?.id === expectedParentCollectionId
}

async function buildWorklist() {
  const items = []

  // 1) cases/{id}/photos/{doc}.url  （scalar；帶 isPdf）
  for (const p of (await db.collectionGroup('photos').get()).docs) {
    if (!underParent(p, 'cases')) continue
    const type = p.data().type || 'survey'
    collectScalar(items, p, 'url', { category: 'photos', type, isPdf: p.data().isPdf === true })
  }

  // 2) cases/{id}/tasks/{doc}.attachments[].url  → type 'task'
  for (const t of (await db.collectionGroup('tasks').get()).docs) {
    if (!underParent(t, 'cases')) continue
    collectObjectArray(items, t, 'attachments', 'url', {
      category: 'tasks', type: 'task', isPdfOf: (a) => a.isPdf === true, fixPdfUrl: true,
    })
  }

  // 3) cases/{id}/progressNotes/{doc}  → type 'progress-notes'
  for (const n of (await db.collectionGroup('progressNotes').get()).docs) {
    if (!underParent(n, 'cases')) continue
    collectScalar(items, n, 'url', { category: 'progressNotes', type: 'progress-notes' })
    collectObjectArray(items, n, 'attachments', 'url', {
      category: 'progressNotes', type: 'progress-notes', isPdfOf: (a) => a.type === 'pdf',
    })
    collectImageLikeArray(items, n, 'images', { category: 'progressNotes', type: 'progress-notes' })
  }

  // 4) cases/{id}/reviews/{doc}  → type 'review'
  for (const r of (await db.collectionGroup('reviews').get()).docs) {
    if (!underParent(r, 'cases')) continue
    collectScalar(items, r, 'url', { category: 'reviews', type: 'review' })
    collectObjectArray(items, r, 'attachments', 'url', {
      category: 'reviews', type: 'review', isPdfOf: (a) => a.isPdf === true, fixPdfUrl: true,
    })
    collectImageLikeArray(items, r, 'images', { category: 'reviews', type: 'review' })
  }

  // 5) announcements/{id}.images[]  → type 'announcement'
  for (const an of (await db.collection('announcements').get()).docs) {
    collectStringArray(items, an, 'images', { category: 'announcements', type: 'announcement' })
  }

  // 6) workLogs/{id}  → 多個欄位
  for (const l of (await db.collection('workLogs').get()).docs) {
    // 6a) fuelExpenses[].photoUrl  → type 'fuel'
    collectObjectArray(items, l, 'fuelExpenses', 'photoUrl', { category: 'workLogs-fuel', type: 'fuel' })
    // 6b) fuelExpense.photoUrl（舊版單數）→ type 'fuel'
    const fe = l.data().fuelExpense
    if (fe && typeof fe.photoUrl === 'string' && fe.photoUrl) {
      const oldUrl = fe.photoUrl
      items.push({
        category: 'workLogs-fuel',
        describe: `${l.ref.path}.fuelExpense.photoUrl`,
        currentUrl: oldUrl,
        type: 'fuel',
        isPdf: false,
        rewrite: (newUrl) => db.runTransaction(async (tx) => {
          const snap = await tx.get(l.ref)
          const cur = snap.data().fuelExpense || {}
          tx.update(l.ref, { fuelExpense: { ...cur, photoUrl: newUrl } })
        }),
      })
    }
    // 6c) logAttachments[].url  → type 'log'
    collectObjectArray(items, l, 'logAttachments', 'url', {
      category: 'workLogs-attachments', type: 'log', isPdfOf: (a) => a.isPdf === true, fixPdfUrl: true,
    })
    // 6d) attachments[].url（audit 有掃，實際欄位是 logAttachments，這裡一併涵蓋舊資料）
    collectObjectArray(items, l, 'attachments', 'url', {
      category: 'workLogs-attachments', type: 'log', isPdfOf: (a) => a.isPdf === true, fixPdfUrl: true,
    })
    // 6e) replies[].attachments[].url  → type 'reply'
    const replies = l.data().replies
    if (Array.isArray(replies)) {
      for (const rp of replies) {
        if (!rp || !Array.isArray(rp.attachments)) continue
        for (const a of rp.attachments) {
          if (!a || typeof a.url !== 'string' || !a.url) continue
          const oldUrl = a.url
          items.push({
            category: 'workLogs-replies',
            describe: `${l.ref.path}.replies[${rp.id}].attachments`,
            currentUrl: oldUrl,
            type: 'reply',
            isPdf: a.isPdf === true,
            rewrite: (newUrl) => db.runTransaction(async (tx) => {
              const snap = await tx.get(l.ref)
              const cur = snap.data().replies || []
              tx.update(l.ref, {
                replies: cur.map(x => (x && Array.isArray(x.attachments))
                  ? { ...x, attachments: rewriteAttachmentUrl(x.attachments, 'url', oldUrl, newUrl, true) }
                  : x),
              })
            }),
          })
        }
      }
    }
  }

  // 7) dashboardNotes/{id}  → type 'dashboard-notes'
  for (const n of (await db.collection('dashboardNotes').get()).docs) {
    collectScalar(items, n, 'url', { category: 'dashboardNotes', type: 'dashboard-notes' })
    collectObjectArray(items, n, 'attachments', 'url', {
      category: 'dashboardNotes', type: 'dashboard-notes', isPdfOf: (a) => a.type === 'pdf',
    })
  }

  // 8) pettyCash/{id}  → type 'petty-cash'
  for (const e of (await db.collection('pettyCash').get()).docs) {
    collectScalar(items, e, 'imageUrl', { category: 'pettyCash', type: 'petty-cash' })
    collectStringArray(items, e, 'receiptImages', { category: 'pettyCash', type: 'petty-cash' })
    collectImageLikeArray(items, e, 'images', { category: 'pettyCash', type: 'petty-cash' })
    collectImageLikeArray(items, e, 'receipts', { category: 'pettyCash', type: 'petty-cash' })
  }

  // 9) clients/{id}/notes/{doc}  （目前無上傳 UI；沿用 audit 走訪範圍，型別借用 progress-notes 桶）
  for (const n of (await db.collectionGroup('notes').get()).docs) {
    if (!underParent(n, 'clients')) continue
    collectObjectArray(items, n, 'attachments', 'url', {
      category: 'clientNotes', type: 'progress-notes', isPdfOf: (a) => a.isPdf === true || a.type === 'pdf',
    })
    collectImageLikeArray(items, n, 'images', { category: 'clientNotes', type: 'progress-notes' })
  }

  // 10) cases/{id}.workTypes[].invoiceFile.url（存在案件文件本身，不是 photos 子集合）→ type 'invoice'
  for (const c of (await db.collection('cases').get()).docs) {
    const wts = c.data().workTypes
    if (!Array.isArray(wts)) continue
    for (const wt of wts) {
      const oldUrl = wt && wt.invoiceFile && wt.invoiceFile.url
      if (typeof oldUrl !== 'string' || !oldUrl) continue
      items.push({
        category: 'workTypes-invoiceFile',
        describe: `${c.ref.path}.workTypes[].invoiceFile.url`,
        currentUrl: oldUrl,
        type: 'invoice',
        isPdf: /\.pdf$/i.test(oldUrl), // 前端只有純 <a href>，無 pdfUrl 邏輯
        rewrite: (newUrl) => db.runTransaction(async (tx) => {
          const snap = await tx.get(c.ref)
          const cur = (snap.data().workTypes || []).map(w =>
            (w && w.invoiceFile && w.invoiceFile.url === oldUrl)
              ? { ...w, invoiceFile: { ...w.invoiceFile, url: newUrl } }
              : w)
          tx.update(c.ref, { workTypes: cur })
        }),
      })
    }
  }

  return items
}

// ─────────────────────────── 寫入 / 續跑 / 失敗記錄 ───────────────────────────
async function uploadToNas(buffer, filename, type) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const idToken = await getIdToken(attempt === 2) // 第 2 次強制刷新 token
    const form = new FormData()
    form.append('file', new Blob([buffer]), filename)
    form.append('type', type)
    const res = await fetchWithRetry(NAS_UPLOAD, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: form,
    })
    if (res.status === 401 && attempt === 1) {
      await res.body?.cancel().catch(() => {}) // 釋放 socket
      continue // token 過期 → 刷新重試一次
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `NAS 上傳失敗 HTTP ${res.status}`)
    return data.url
  }
  throw new Error('NAS 上傳失敗：ID token 刷新後仍回 401')
}

async function runMigration(todo) {
  await getIdToken() // 先驗證 API key／換得到 token 再開跑
  let ok = 0, fail = 0
  for (let n = 0; n < todo.length && n < LIMIT; n++) {
    const item = todo[n]
    try {
      // 續跑保護：已經不是 cloudinary 就跳過（可能上一輪已搬完）
      if (urlKind(item.currentUrl) !== 'cloudinary') { continue }
      const resp = await fetchWithRetry(item.currentUrl)
      if (!resp.ok) throw new Error(`下載來源失敗 HTTP ${resp.status}`)
      const buf = Buffer.from(await resp.arrayBuffer())
      let ext = deriveExt(item.currentUrl, resp.headers.get('content-type'))
      if (item.isPdf === true) ext = 'pdf' // 信任 Firestore 的 isPdf，避免前端組出 ...jpg.pdf → 404
      const filename = `migrated.${ext}` // 服務端只取副檔名，會重新產生正式檔名
      const newUrl = await uploadToNas(buf, filename, item.type)
      // 崩潰復原：先寫暫定 map，再改 Firestore，成功後補記 REWRITTEN
      appendFileSync(MAP_FILE, `${item.currentUrl}\t${newUrl}\t${item.category}\tUPLOADED\n`)
      await item.rewrite(newUrl)
      appendFileSync(MAP_FILE, `${item.currentUrl}\t${newUrl}\t${item.category}\tREWRITTEN\n`)
      ok++
      process.stdout.write(`\r已完成 ${ok} / ${todo.length}`)
    } catch (e) {
      fail++
      appendFileSync(FAIL_FILE, `${item.currentUrl}\t${item.describe}\t${e.message}\n`)
    }
    if ((n + 1) % BATCH === 0) await sleep(1000)
  }
  console.log(`\n完成：成功 ${ok}，失敗 ${fail}（失敗清單見 ${FAIL_FILE}）`)
}

async function runReverse(todo) {
  // 依 MAP_FILE 建 nasUrl → cloudinaryUrl 對照（UPLOADED / REWRITTEN 皆算）
  const map = {}
  try {
    for (const line of readFileSync(MAP_FILE, 'utf8').split('\n')) {
      const [oldU, newU] = line.split('\t')
      if (oldU && newU) map[newU] = oldU
    }
  } catch { /* 沒有 map 檔 */ }

  writeFileSync(REVERSE_UNMAPPED_FILE, '') // 每次重跑先清空，避免重複累積
  let ok = 0, fail = 0, unmapped = 0
  for (const item of todo) {
    const back = map[item.currentUrl]
    if (!back) { // 觀察期新上傳、不在 map → 逐筆立即寫檔，中途掛也不丟失
      unmapped++
      appendFileSync(REVERSE_UNMAPPED_FILE, `${item.currentUrl}\n`)
      continue
    }
    try {
      await item.rewrite(back)
      ok++
    } catch (e) {
      fail++
      appendFileSync(FAIL_FILE, `${item.currentUrl}\t${item.describe}\t反向失敗：${e.message}\n`)
    }
  }
  console.log(`\n反向完成：還原 ${ok} 筆；失敗 ${fail} 筆（見 ${FAIL_FILE}）；${unmapped} 筆不在 map（觀察期新檔，清單見 ${REVERSE_UNMAPPED_FILE}，需手動處理，見 spec §8）`)
}

function tallyBy(list, keyFn) {
  const out = {}
  for (const x of list) { const k = keyFn(x); out[k] = (out[k] || 0) + 1 }
  return out
}

function printTable(title, obj) {
  console.log(title)
  const rows = Object.entries(obj).sort((a, b) => b[1] - a[1])
  const w = Math.max(0, ...rows.map(([k]) => k.length))
  for (const [k, v] of rows) console.log(`  ${k.padEnd(w)}  ${String(v).padStart(6)}`)
}

async function main() {
  const wanted = REVERSE ? 'nas' : 'cloudinary'
  const all = await buildWorklist()
  const todo = all.filter(i => urlKind(i.currentUrl) === wanted)

  console.log(`模式：${REVERSE ? '反向（NAS→Cloudinary）' : '正向（Cloudinary→NAS）'}${DRY ? '  [DRY RUN]' : ''}`)
  console.log(`掃描到 ${all.length} 筆媒體網址，其中 ${todo.length} 筆待處理（${wanted}）\n`)
  printTable('各位置分佈（全部）：', tallyBy(all, i => i.category))
  console.log()
  const hostTally = { cloudinary: 0, nas: 0, other: 0, ...tallyBy(all, i => urlKind(i.currentUrl)) }
  printTable('主機分佈（全部）：', hostTally)
  console.log()
  printTable('待處理分佈：', tallyBy(todo, i => i.category))
  console.log('\n前 5 筆範例：')
  todo.slice(0, 5).forEach(i => console.log(`  ${i.describe}  ${i.currentUrl}`))

  if (DRY) process.exit(0)
  if (REVERSE) await runReverse(todo)
  else await runMigration(todo)
}

main().catch(e => { console.error(e); process.exit(1) })
