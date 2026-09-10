import { describe, it, expect } from 'vitest'
import { loadConfig, ALLOWED_EXT, ALLOWED_TYPES } from '../src/config.js'

const base = {
  FIREBASE_PROJECT_ID: 'quotation-system-ddc5c',
  MEDIA_ROOT: '/media',
  PUBLIC_BASE_URL: 'https://nextdesign.myqnapcloud.com/media',
}

describe('loadConfig', () => {
  it('讀出必填欄位', () => {
    const c = loadConfig({ ...base })
    expect(c.projectId).toBe('quotation-system-ddc5c')
    expect(c.mediaRoot).toBe('/media')
    expect(c.publicBaseUrl).toBe('https://nextdesign.myqnapcloud.com/media')
  })

  it('缺必填欄位就丟錯', () => {
    expect(() => loadConfig({ MEDIA_ROOT: '/media', PUBLIC_BASE_URL: 'x' }))
      .toThrow(/FIREBASE_PROJECT_ID/)
  })

  it('ALLOWED_ORIGINS 以逗號分隔並去空白', () => {
    const c = loadConfig({ ...base, ALLOWED_ORIGINS: 'https://a.web.app, https://b.com ' })
    expect(c.allowedOrigins).toEqual(['https://a.web.app', 'https://b.com'])
  })

  it('port 與 maxFileBytes 有預設值', () => {
    const c = loadConfig({ ...base })
    expect(c.port).toBe(3001)
    expect(c.maxFileBytes).toBe(50 * 1024 * 1024)
  })

  it('MAX_FILE_MB 可覆寫上限', () => {
    const c = loadConfig({ ...base, MAX_FILE_MB: '200' })
    expect(c.maxFileBytes).toBe(200 * 1024 * 1024)
  })

  it('白名單常數', () => {
    expect(ALLOWED_EXT.has('jpg')).toBe(true)
    expect(ALLOWED_EXT.has('exe')).toBe(false)
    expect(ALLOWED_TYPES.has('survey')).toBe(true)
    expect(ALLOWED_TYPES.has('vendor_quote')).toBe(true)
    expect(ALLOWED_TYPES.has('../etc')).toBe(false)
  })
})
