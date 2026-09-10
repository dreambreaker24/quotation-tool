import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, appendFileSync } from 'node:fs'
import { urlKind, replaceInStringArray, replaceInObjectArray, deriveExt } from './lib/media-migration.mjs'

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

async function runMigration() {
  console.error('寫入模式尚未實作（見 Task 11）。目前只支援 --dry-run。')
  process.exit(1)
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

  if (DRY) { process.exit(0) }

  // 寫入模式 → Task 11
  await runMigration(todo)
}

main().catch(e => { console.error(e); process.exit(1) })
