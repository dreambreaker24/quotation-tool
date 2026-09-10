import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { createApp } from '../src/server.js'

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
afterEach(() => rmSync(mediaRoot, { recursive: true, force: true }))

describe('GET /media/health', () => {
  it('回 { ok: true }，不需認證', async () => {
    const res = await request(createApp(config(), fakeVerify)).get('/media/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('POST /media/upload', () => {
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
  })
})
