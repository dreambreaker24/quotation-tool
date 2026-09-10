import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, appendFileSync } from 'node:fs'
import { urlKind, replaceInStringArray, replaceInObjectArray, deriveExt } from './lib/media-migration.mjs'

const MAP_FILE = './migrate-media-map.tsv'
const FAIL_FILE = './migrate-media-failures.log'
const NAS_UPLOAD = process.env.NAS_BASE_URL
  ? `${process.env.NAS_BASE_URL}/upload`
  : 'https://nextdesign.myqnapcloud.com/media/upload'

async function getIdToken() {
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
  return data.idToken
}

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const REVERSE = args.includes('--reverse')
const LIMIT = numArg('--limit', Infinity)
const BATCH = numArg('--batch', 100)
function numArg(flag, dflt) {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt
}

const key = JSON.parse(readFileSync('./firebase-admin-key.json', 'utf8'))
initializeApp({ credential: cert(key) })
const db = getFirestore()

// 回傳待處理清單：{ category, describe, currentUrl, type, rewrite(newUrl) }
async function buildWorklist() {
  const items = []

  // 1) cases/{id}/photos/{doc}.url
  for (const p of (await db.collectionGroup('photos').get()).docs) {
    const url = p.data().url
    if (typeof url !== 'string') continue
    const type = p.data().type || 'survey'
    items.push({
      category: 'photos',
      describe: `photos/${p.id} (${type})`,
      currentUrl: url,
      type,
      rewrite: (newUrl) => p.ref.update({ url: newUrl }),
    })
  }

  // 2) cases/{id}/tasks/{doc}.attachments[].url  → type 'task'
  for (const t of (await db.collectionGroup('tasks').get()).docs) {
    const atts = t.data().attachments
    if (!Array.isArray(atts)) continue
    for (const a of atts) {
      if (!a || typeof a.url !== 'string') continue
      const oldUrl = a.url
      items.push({
        category: 'tasks',
        describe: `tasks/${t.id}.attachments`,
        currentUrl: oldUrl,
        type: 'task',
        rewrite: (newUrl) => db.runTransaction(async (tx) => {
          const snap = await tx.get(t.ref)
          const cur = snap.data().attachments || []
          tx.update(t.ref, { attachments: replaceInObjectArray(cur, 'url', oldUrl, newUrl) })
        }),
      })
    }
  }

  // 3) workLogs/{id}.fuelExpenses[].photoUrl  → type 'fuel'
  for (const l of (await db.collection('workLogs').get()).docs) {
    const fes = l.data().fuelExpenses
    if (!Array.isArray(fes)) continue
    for (const f of fes) {
      if (!f || typeof f.photoUrl !== 'string') continue
      const oldUrl = f.photoUrl
      items.push({
        category: 'workLogs',
        describe: `workLogs/${l.id}.fuelExpenses`,
        currentUrl: oldUrl,
        type: 'fuel',
        rewrite: (newUrl) => db.runTransaction(async (tx) => {
          const snap = await tx.get(l.ref)
          const cur = snap.data().fuelExpenses || []
          tx.update(l.ref, { fuelExpenses: replaceInObjectArray(cur, 'photoUrl', oldUrl, newUrl) })
        }),
      })
    }
  }

  // 4) announcements/{id}.images[]  → type 'announcement'
  for (const an of (await db.collection('announcements').get()).docs) {
    const imgs = an.data().images
    if (!Array.isArray(imgs)) continue
    for (const oldUrl of imgs) {
      if (typeof oldUrl !== 'string') continue
      items.push({
        category: 'announcements',
        describe: `announcements/${an.id}.images`,
        currentUrl: oldUrl,
        type: 'announcement',
        rewrite: (newUrl) => db.runTransaction(async (tx) => {
          const snap = await tx.get(an.ref)
          const cur = snap.data().images || []
          tx.update(an.ref, { images: replaceInStringArray(cur, oldUrl, newUrl) })
        }),
      })
    }
  }

  return items
}

async function uploadToNas(buffer, filename, type, idToken) {
  const form = new FormData()
  form.append('file', new Blob([buffer]), filename)
  form.append('type', type)
  const res = await fetch(NAS_UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `NAS 上傳失敗 HTTP ${res.status}`)
  return data.url
}

async function runMigration(todo) {
  const idToken = await getIdToken()
  let ok = 0, fail = 0
  for (let n = 0; n < todo.length && n < LIMIT; n++) {
    const item = todo[n]
    try {
      // 續跑保護：若已經是目標型別就跳過
      if (urlKind(item.currentUrl) !== 'cloudinary') { continue }
      const resp = await fetch(item.currentUrl)
      if (!resp.ok) throw new Error(`下載來源失敗 HTTP ${resp.status}`)
      const buf = Buffer.from(await resp.arrayBuffer())
      const ext = deriveExt(item.currentUrl, resp.headers.get('content-type'))
      const filename = `migrated.${ext}` // 服務端只取副檔名，會重新產生正式檔名
      const newUrl = await uploadToNas(buf, filename, item.type, idToken)
      await item.rewrite(newUrl)
      appendFileSync(MAP_FILE, `${item.currentUrl}\t${newUrl}\t${item.describe}\tOK\n`)
      ok++
      process.stdout.write(`\r已完成 ${ok} / ${todo.length}`)
    } catch (e) {
      fail++
      appendFileSync(FAIL_FILE, `${item.currentUrl}\t${item.describe}\t${e.message}\n`)
    }
    if ((n + 1) % BATCH === 0) await new Promise(r => setTimeout(r, 1000))
  }
  console.log(`\n完成：成功 ${ok}，失敗 ${fail}（失敗清單見 ${FAIL_FILE}）`)
}

async function runReverse(todo) {
  // 依 MAP_FILE 建 nasUrl → cloudinaryUrl 對照
  let map = {}
  try {
    for (const line of readFileSync(MAP_FILE, 'utf8').split('\n')) {
      const [oldU, newU] = line.split('\t')
      if (oldU && newU) map[newU] = oldU
    }
  } catch { /* 沒有 map 檔 */ }

  let ok = 0, skipped = 0
  for (const item of todo) {
    const back = map[item.currentUrl]
    if (!back) { skipped++; continue } // 觀察期新上傳、不在 map → 手動處理
    await item.rewrite(back)
    ok++
  }
  console.log(`反向完成：還原 ${ok} 筆；${skipped} 筆不在 map（觀察期新檔，需手動處理，見 spec §8）`)
}

async function main() {
  const wanted = REVERSE ? 'nas' : 'cloudinary'
  const all = await buildWorklist()
  const todo = all.filter(i => urlKind(i.currentUrl) === wanted)

  const byType = {}
  for (const i of todo) byType[i.category] = (byType[i.category] || 0) + 1

  console.log(`模式：${REVERSE ? '反向（NAS→Cloudinary）' : '正向（Cloudinary→NAS）'}${DRY ? '  [DRY RUN]' : ''}`)
  console.log(`掃描到 ${all.length} 筆網址，其中 ${todo.length} 筆待處理`)
  console.log(JSON.stringify(byType, null, 2))
  console.log('前 5 筆範例：')
  todo.slice(0, 5).forEach(i => console.log(`  ${i.describe}  ${i.currentUrl}`))

  if (DRY) process.exit(0)
  if (REVERSE) await runReverse(todo)
  else await runMigration(todo)
}

main().catch(e => { console.error(e); process.exit(1) })
