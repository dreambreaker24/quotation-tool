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
