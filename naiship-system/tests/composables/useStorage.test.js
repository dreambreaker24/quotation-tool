// naiship-system/tests/composables/useStorage.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  beforeEach(() => {
    vi.resetModules()
    import.meta.env.VITE_STORAGE_BACKEND = 'nas'
    import.meta.env.VITE_NAS_BASE_URL = 'https://nas.example/media'
    vi.doMock('@/firebase', () => ({
      auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('tok-abc') } },
    }))
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ url: 'https://nas.example/media/naiship/survey/x.jpg' }) }),
    )
  })

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
    vi.doMock('@/firebase', () => ({ auth: { currentUser: null } }))
    vi.resetModules()
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
