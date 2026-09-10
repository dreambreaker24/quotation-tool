import { describe, it, expect } from 'vitest'
import {
  urlKind, replaceInStringArray, replaceInObjectArray, deriveExt,
} from '../../scripts/lib/media-migration.mjs'

describe('urlKind', () => {
  it('辨識 cloudinary / nas / other', () => {
    expect(urlKind('https://res.cloudinary.com/x/a.jpg')).toBe('cloudinary')
    expect(urlKind('https://nextdesign.myqnapcloud.com/media/naiship/survey/a.jpg')).toBe('nas')
    expect(urlKind('https://example.com/a.jpg')).toBe('other')
    expect(urlKind('/uploads/survey/a.jpg')).toBe('other')
    expect(urlKind(null)).toBe('other')
    expect(urlKind(123)).toBe('other')
  })
})

describe('replaceInStringArray', () => {
  it('只換相符的元素，回新陣列', () => {
    const a = ['x', 'y', 'x']
    const out = replaceInStringArray(a, 'x', 'z')
    expect(out).toEqual(['z', 'y', 'z'])
    expect(a).toEqual(['x', 'y', 'x']) // 不動原陣列
  })
  it('沒相符時原樣回傳內容', () => {
    expect(replaceInStringArray(['a'], 'x', 'z')).toEqual(['a'])
  })
  it('oldUrl 不存在時回傳內容相等的陣列（交易 no-op）', () => {
    const a = ['a', 'b']
    const out = replaceInStringArray(a, 'x', 'z')
    expect(out).toEqual(['a', 'b'])
    expect(out).not.toBe(a)
  })
  it('連續替換兩個不同網址', () => {
    const step1 = replaceInStringArray(['a', 'b'], 'a', 'na')
    expect(step1).toEqual(['na', 'b'])
    const step2 = replaceInStringArray(step1, 'b', 'nb')
    expect(step2).toEqual(['na', 'nb'])
  })
})

describe('replaceInObjectArray', () => {
  it('只換指定 key 相符的物件', () => {
    const a = [{ url: 'x', n: 1 }, { url: 'y', n: 2 }]
    const out = replaceInObjectArray(a, 'url', 'x', 'z')
    expect(out).toEqual([{ url: 'z', n: 1 }, { url: 'y', n: 2 }])
    expect(a[0].url).toBe('x')
  })
  it('容忍 null 元素', () => {
    expect(replaceInObjectArray([null, { url: 'x' }], 'url', 'x', 'z'))
      .toEqual([null, { url: 'z' }])
  })
  it('oldUrl 不存在時回傳內容相等的陣列（交易 no-op）', () => {
    const a = [{ url: 'a' }, { url: 'b' }]
    const out = replaceInObjectArray(a, 'url', 'x', 'z')
    expect(out).toEqual([{ url: 'a' }, { url: 'b' }])
    expect(out).not.toBe(a)
  })
})

describe('deriveExt', () => {
  it('優先用網址副檔名', () => {
    expect(deriveExt('https://res.cloudinary.com/x/a/b.PNG?v=1', 'image/jpeg')).toBe('png')
  })
  it('網址無副檔名時 fallback content-type', () => {
    expect(deriveExt('https://res.cloudinary.com/x/image/upload/v1/naiship/vendor_quote/abc', 'application/pdf')).toBe('pdf')
  })
  it('都沒有時回 jpg 當保底', () => {
    expect(deriveExt('https://res.cloudinary.com/x/abc', 'application/octet-stream')).toBe('jpg')
  })
  it('網址結尾不是已知媒體副檔名時，改用 content-type', () => {
    expect(deriveExt('https://res.cloudinary.com/x/naiship/review/report.final', 'application/pdf')).toBe('pdf')
  })
  it('content-type 空、網址也無有效副檔名時回 jpg', () => {
    expect(deriveExt('https://res.cloudinary.com/x/naiship/review/report.final', null)).toBe('jpg')
    expect(deriveExt('https://res.cloudinary.com/x/abc', '')).toBe('jpg')
  })
})
