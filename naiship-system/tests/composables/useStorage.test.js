// naiship-system/tests/composables/useStorage.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateUploadFile, isVideoFile } from '@/composables/useStorage'

describe('useStorage (local backend)', () => {
  beforeEach(() => {
    vi.resetModules()
    import.meta.env.VITE_STORAGE_BACKEND = 'local'
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: '/uploads/survey/test.jpg' })
      })
    )
  })

  it('uploads file and returns url', async () => {
    const { uploadPhoto } = await import('@/composables/useStorage')
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
    const url = await uploadPhoto(file, 'survey')
    expect(url).toBe('/uploads/survey/test.jpg')
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/upload/survey',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('useStorage (nas backend)', () => {
  let currentUser
  beforeEach(() => {
    currentUser = { getIdToken: vi.fn().mockResolvedValue('tok-abc') }
    vi.resetModules()
    import.meta.env.VITE_STORAGE_BACKEND = 'nas'
    import.meta.env.VITE_NAS_BASE_URL = 'https://nas.example/media'
    vi.doMock('@/firebase', () => ({ auth: { get currentUser() { return currentUser } } }))
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ url: 'https://nas.example/media/naiship/survey/x.jpg' }) }),
    )
  })
  afterEach(() => { vi.doUnmock('@/firebase') })

  it('帶 Bearer token 上傳並回傳 url', async () => {
    const { uploadPhoto } = await import('@/composables/useStorage')
    const file = new File(['d'], 't.jpg', { type: 'image/jpeg' })
    const url = await uploadPhoto(file, 'survey')
    expect(url).toBe('https://nas.example/media/naiship/survey/x.jpg')
    const [calledUrl, opts] = global.fetch.mock.calls[0]
    expect(calledUrl).toBe('https://nas.example/media/upload')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer tok-abc')
    expect(opts.body.get('type')).toBe('survey')
    expect(opts.body.get('file')).toBeTruthy()
  })

  it('未登入時丟錯', async () => {
    currentUser = null
    const { uploadPhoto } = await import('@/composables/useStorage')
    await expect(uploadPhoto(new File(['d'], 't.jpg'), 'survey')).rejects.toThrow(/登入/)
  })

  it('服務回非 2xx 時丟出服務端錯誤訊息', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({ error: '憑證無效' }) }),
    )
    const { uploadPhoto } = await import('@/composables/useStorage')
    await expect(uploadPhoto(new File(['d'], 't.jpg'), 'survey')).rejects.toThrow('憑證無效')
  })
})

describe('isVideoFile', () => {
  it('辨識 .mp4/.mov 為影片，不分大小寫，其他副檔名不算', () => {
    expect(isVideoFile(new File([], 'site.mp4'))).toBe(true)
    expect(isVideoFile(new File([], 'SITE.MOV'))).toBe(true)
    expect(isVideoFile(new File([], 'photo.jpg'))).toBe(false)
    expect(isVideoFile(new File([], 'quote.pdf'))).toBe(false)
  })
})

describe('validateUploadFile', () => {
  function makeFile(name, sizeBytes) {
    const file = new File([new Uint8Array(1)], name)
    Object.defineProperty(file, 'size', { value: sizeBytes })
    return file
  }

  it('圖片超過 10MB 擋下', () => {
    const file = makeFile('photo.jpg', 11 * 1024 * 1024)
    expect(validateUploadFile(file)).toMatch(/單檔限制 10 MB/)
  })

  it('圖片 10MB 以內通過', () => {
    const file = makeFile('photo.jpg', 9 * 1024 * 1024)
    expect(validateUploadFile(file)).toBeNull()
  })

  it('影片 200MB 通過（遠超過圖片的 10MB 上限）', () => {
    const file = makeFile('site.mp4', 200 * 1024 * 1024)
    expect(validateUploadFile(file)).toBeNull()
  })

  it('影片超過 500MB 擋下', () => {
    const file = makeFile('site.mov', 600 * 1024 * 1024)
    expect(validateUploadFile(file)).toMatch(/單檔限制 500 MB/)
  })
})
