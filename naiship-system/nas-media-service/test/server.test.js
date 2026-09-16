import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { createApp } from '../src/server.js'

// 只有在測試需要時才把 randomBytes 固定住（製造檔名碰撞），其餘走真隨機
const { rbState } = vi.hoisted(() => ({ rbState: { fixed: null } }))
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    randomBytes: (...args) => (rbState.fixed ? Buffer.from(rbState.fixed) : actual.randomBytes(...args)),
  }
})

let mediaRoot
const config = () => ({
  projectId: 'p', mediaRoot,
  publicBaseUrl: 'https://nas.example/media',
  allowedOrigins: ['https://app.example'],
  port: 3001, maxFileBytes: 1024 * 1024,
})
// 假 verifier：token === 'good' 通過，其餘丟錯
const fakeVerify = async (t) => { if (t !== 'good') throw new Error('bad'); return { sub: 'u1' } }

beforeEach(() => { mediaRoot = mkdtempSync(join(tmpdir(), 'media-')) })
afterEach(() => {
  rmSync(mediaRoot, { recursive: true, force: true })
  rbState.fixed = null
})

describe('GET /media/health', () => {
  it('回 { ok: true }，不需認證', async () => {
    const res = await request(createApp(config(), fakeVerify)).get('/media/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('POST /media/upload', () => {
  it('OPTIONS 預檢帶白名單來源 → 回 CORS 標頭（不然瀏覽器會擋下後續的真實 POST）', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .options('/media/upload')
      .set('Origin', 'https://app.example')
      .set('Access-Control-Request-Method', 'POST')
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example')
  })

  it('OPTIONS 預檢帶非白名單來源 → 不回 CORS 標頭', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .options('/media/upload')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('沒帶 token → 401', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').field('type', 'survey').attach('file', Buffer.from('x'), 'a.jpg')
    expect(res.status).toBe(401)
  })

  it('token 無效 → 401', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer bad')
      .field('type', 'survey').attach('file', Buffer.from('x'), 'a.jpg')
    expect(res.status).toBe(401)
  })

  it('type 不在白名單 → 400', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', '../evil').attach('file', Buffer.from('x'), 'a.jpg')
    expect(res.status).toBe(400)
  })

  it('副檔名不允許 → 400', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'survey').attach('file', Buffer.from('x'), 'a.exe')
    expect(res.status).toBe(400)
  })

  it('沒附檔案 → 400', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good').field('type', 'survey')
    expect(res.status).toBe(400)
  })

  it('成功 → 存檔到 mediaRoot/naiship/<type>/ 並回完整網址', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'vendor_quote').attach('file', Buffer.from('hello'), 'q.pdf')
    expect(res.status).toBe(200)
    expect(res.body.url).toMatch(
      /^https:\/\/nas\.example\/media\/naiship\/vendor_quote\/20\d{6}-[0-9a-f]{8}\.pdf$/,
    )
    const rel = res.body.url.replace('https://nas.example/media/', '')
    expect(readFileSync(join(mediaRoot, rel), 'utf8')).toBe('hello')
  })

  it('超過大小上限 → 413', async () => {
    const big = Buffer.alloc(2 * 1024 * 1024, 1)
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'survey').attach('file', big, 'big.jpg')
    expect(res.status).toBe(413)
  })

  it('Authorization 帶裸 token（無 Bearer 前綴）→ 401', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'good')
      .field('type', 'survey').attach('file', Buffer.from('x'), 'a.jpg')
    expect(res.status).toBe(401)
  })

  it('type 送兩次（欄位污染成陣列）→ 400', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'survey').field('type', 'x')
      .attach('file', Buffer.from('x'), 'a.jpg')
    expect(res.status).toBe(400)
  })

  it('naiship 子樹壞掉（暫存資料夾建立失敗）→ 安全的錯誤回應，不外洩 stack', async () => {
    // 讓 naiship 變成檔案而非資料夾。暫存資料夾現在也在 naiship/ 底下（修 EXDEV 的必要條件，
    // 見 uploadTmpDir 旁的說明），所以這會讓 multer 自己的 destination callback 先失敗，
    // 屬於 multer 解析錯誤（400），不是我們自己路由邏輯裡的伺服器錯誤（500）——
    // 兩種都是安全、不洩漏內部細節的錯誤回應，差別只是分類。
    writeFileSync(join(mediaRoot, 'naiship'), 'not a dir')
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'survey').attach('file', Buffer.from('x'), 'a.jpg')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: '上傳解析失敗' })
    expect(JSON.stringify(res.body)).not.toMatch(/stack|\.js:\d+|ENOTDIR/i)
  })

  it('檔名碰撞時不會靜默覆寫既有檔案', async () => {
    rbState.fixed = Buffer.from('aabbccdd', 'hex')
    const app = createApp(config(), fakeVerify)
    const first = await request(app)
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'survey').attach('file', Buffer.from('original'), 'a.jpg')
    expect(first.status).toBe(200)
    const rel = first.body.url.replace('https://nas.example/media/', '')

    const second = await request(app)
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'survey').attach('file', Buffer.from('overwrite-attempt'), 'a.jpg')
    expect(second.status).toBe(500)
    expect(readFileSync(join(mediaRoot, rel), 'utf8')).toBe('original')
  })
})

describe('GET 靜態供檔', () => {
  it('回傳已存在的檔案，帶 inline disposition', async () => {
    const dir = join(mediaRoot, 'naiship', 'survey')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'x.jpg'), 'imgdata')
    const res = await request(createApp(config(), fakeVerify)).get('/media/naiship/survey/x.jpg')
    expect(res.status).toBe(200)
    expect(res.body.toString('utf8')).toBe('imgdata')
    expect(res.headers['content-disposition']).toMatch(/inline/)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('路徑穿越（..）拿不到 naiship 以外的檔案', async () => {
    mkdirSync(join(mediaRoot, 'naiship'), { recursive: true })
    writeFileSync(join(mediaRoot, 'secret.txt'), 'top-secret')
    const res = await request(createApp(config(), fakeVerify))
      .get('/media/naiship/%2e%2e/secret.txt')
    expect(res.status).not.toBe(200)
    expect(res.text || '').not.toContain('top-secret')
  })

  it('點檔案（dotfile）被擋下', async () => {
    const dir = join(mediaRoot, 'naiship')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.secret'), 'nope')
    const res = await request(createApp(config(), fakeVerify)).get('/media/naiship/.secret')
    expect([403, 404]).toContain(res.status)
  })

  it('白名單來源帶 CORS 標頭 → 前端 fetch() 圈選下載/分享才讀得到回應內容', async () => {
    // <img>/<video> 顯示縮圖不需要 CORS，但「圈選下載/分享」是用 fetch() 讀回應內容再存成
    // blob，沒有這個標頭瀏覽器會直接擋下讀取（縮圖正常、下載卻全部失敗，2026-09-16 事故）。
    const dir = join(mediaRoot, 'naiship', 'survey')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'x.jpg'), 'imgdata')
    const res = await request(createApp(config(), fakeVerify))
      .get('/media/naiship/survey/x.jpg')
      .set('Origin', 'https://app.example')
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example')
  })

  it('非白名單來源不帶 CORS 標頭', async () => {
    const dir = join(mediaRoot, 'naiship', 'survey')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'x.jpg'), 'imgdata')
    const res = await request(createApp(config(), fakeVerify))
      .get('/media/naiship/survey/x.jpg')
      .set('Origin', 'https://evil.example')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('磁碟暫存不殘留', () => {
  // 刻意連「暫存資料夾有沒有被建立」都一起斷言，不是只看「有沒有殘留檔案」——
  // 舊的 memoryStorage 實作永遠不會建立 .uploading 資料夾，如果只斷言「沒有殘留檔案」，
  // 舊實作會因為資料夾根本不存在而讓這幾個測試「假綠燈」，測不出真的有改用磁碟暫存。
  function tmpDirState() {
    const tmpDir = join(mediaRoot, 'naiship', '.uploading')
    const exists = existsSync(tmpDir)
    return { exists, leftover: exists ? readdirSync(tmpDir) : null }
  }

  it('上傳成功後，暫存資料夾有被使用過、且沒有殘留檔案', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'survey').attach('file', Buffer.from('hello'), 'q.jpg')
    expect(res.status).toBe(200)
    const state = tmpDirState()
    expect(state.exists).toBe(true)
    expect(state.leftover).toEqual([])
  })

  it('沒帶 token 失敗時，暫存資料夾有被使用過、且沒有殘留檔案', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').field('type', 'survey').attach('file', Buffer.from('x'), 'a.jpg')
    expect(res.status).toBe(401)
    const state = tmpDirState()
    expect(state.exists).toBe(true)
    expect(state.leftover).toEqual([])
  })

  it('type 不在白名單失敗時，暫存資料夾有被使用過、且沒有殘留檔案', async () => {
    const res = await request(createApp(config(), fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', '../evil').attach('file', Buffer.from('x'), 'a.jpg')
    expect(res.status).toBe(400)
    const state = tmpDirState()
    expect(state.exists).toBe(true)
    expect(state.leftover).toEqual([])
  })

  it('5MB 影片檔（走磁碟暫存路徑）也能成功上傳並搬到最終位置', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024, 7)
    const res = await request(createApp({ ...config(), maxFileBytes: 10 * 1024 * 1024 }, fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'wt_construction').attach('file', big, 'clip.mp4')
    expect(res.status).toBe(200)
    const rel = res.body.url.replace('https://nas.example/media/', '')
    expect(readFileSync(join(mediaRoot, rel)).length).toBe(5 * 1024 * 1024)
    expect(tmpDirState().leftover).toEqual([])
  })

  it('超過大小上限（413）時，暫存資料夾也不會殘留檔案', async () => {
    const big = Buffer.alloc(2 * 1024 * 1024, 1)
    const res = await request(createApp({ ...config(), maxFileBytes: 1024 * 1024 }, fakeVerify))
      .post('/media/upload').set('Authorization', 'Bearer good')
      .field('type', 'survey').attach('file', big, 'big.jpg')
    expect(res.status).toBe(413)
    const state = tmpDirState()
    expect(state.exists).toBe(true)
    expect(state.leftover).toEqual([])
  })
})
