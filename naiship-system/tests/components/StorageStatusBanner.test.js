import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StorageStatusBanner from '@/components/common/StorageStatusBanner.vue'

describe('StorageStatusBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    import.meta.env.VITE_STORAGE_BACKEND = 'nas'
    import.meta.env.VITE_NAS_BASE_URL = 'https://nas.example/media'
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('backend 不是 nas 時完全不偵測、不顯示', async () => {
    import.meta.env.VITE_STORAGE_BACKEND = 'cloudinary'
    global.fetch = vi.fn()
    const w = mount(StorageStatusBanner)
    await flushPromises()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(w.text()).toBe('')
  })

  it('health 正常時不顯示橫幅', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    const w = mount(StorageStatusBanner)
    await flushPromises()
    expect(w.find('[data-test="storage-offline"]').exists()).toBe(false)
  })

  it('連續兩次失敗才顯示橫幅', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down'))
    const w = mount(StorageStatusBanner)
    await flushPromises() // 第 1 次（onMounted）
    expect(w.find('[data-test="storage-offline"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(60000) // 第 2 次
    await flushPromises()
    expect(w.find('[data-test="storage-offline"]').exists()).toBe(true)
    expect(w.text()).toContain('檔案伺服器')
  })

  it('恢復後橫幅消失', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down'))
    const w = mount(StorageStatusBanner)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60000)
    await flushPromises()
    expect(w.find('[data-test="storage-offline"]').exists()).toBe(true)
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    await vi.advanceTimersByTimeAsync(60000)
    await flushPromises()
    expect(w.find('[data-test="storage-offline"]').exists()).toBe(false)
  })
})
