import { describe, it, expect } from 'vitest'
import { extFromName, extFromUrl, extFromContentType, generateFilename } from '../src/filename.js'

describe('extFromName', () => {
  it('取小寫副檔名', () => {
    expect(extFromName('IMG_1234.JPG')).toBe('jpg')
    expect(extFromName('報價單.pdf')).toBe('pdf')
  })
  it('沒有副檔名回空字串', () => {
    expect(extFromName('noext')).toBe('')
    expect(extFromName('')).toBe('')
    expect(extFromName(undefined)).toBe('')
  })
})

describe('extFromUrl', () => {
  it('忽略 query string', () => {
    expect(extFromUrl('https://res.cloudinary.com/x/a/b/c.png?v=1')).toBe('png')
  })
  it('Cloudinary 無副檔名網址回空', () => {
    expect(extFromUrl('https://res.cloudinary.com/x/image/upload/v1/naiship/vendor_quote/abc')).toBe('')
  })
})

describe('extFromContentType', () => {
  it('對應常見型別', () => {
    expect(extFromContentType('image/jpeg')).toBe('jpg')
    expect(extFromContentType('image/png')).toBe('png')
    expect(extFromContentType('application/pdf')).toBe('pdf')
    expect(extFromContentType('video/mp4')).toBe('mp4')
    expect(extFromContentType('video/quicktime')).toBe('mov')
    expect(extFromContentType('image/jpeg; charset=utf-8')).toBe('jpg')
  })
  it('未知型別回空', () => {
    expect(extFromContentType('application/octet-stream')).toBe('')
  })
})

describe('generateFilename', () => {
  const D = new Date('2026-09-10T12:00:00+08:00')
  it('格式為 YYYYMMDD-8碼.ext', () => {
    const name = generateFilename('photo.jpg', D)
    expect(name).toMatch(/^20260910-[0-9a-f]{8}\.jpg$/)
  })
  it('副檔名不在白名單就丟錯', () => {
    expect(() => generateFilename('malware.exe', D)).toThrow(/不支援/)
  })
  it('兩次呼叫檔名不同', () => {
    expect(generateFilename('a.png', D)).not.toBe(generateFilename('a.png', D))
  })
})
