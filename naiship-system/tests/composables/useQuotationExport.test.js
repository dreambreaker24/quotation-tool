import { describe, it, expect } from 'vitest'
import { computeSlices } from '@/composables/useQuotationExport'

describe('computeSlices', () => {
  it('內容比一頁可用高度小時，只產生一片，涵蓋全部內容', () => {
    const slices = computeSlices(500, 1000, 100, [], 1)
    expect(slices).toEqual([{ start: 0, end: 500, isFirstSlice: true }])
  })

  it('內容超過一頁時，第二片起扣掉 headerRegionPx 的可用空間', () => {
    const slices = computeSlices(2500, 1000, 100, [], 1)
    expect(slices[0]).toEqual({ start: 0, end: 1000, isFirstSlice: true })
    expect(slices[1].start).toBe(1000)
    expect(slices[1].end).toBe(1000 + 900) // 第二片可用高度 = a4SlicePx - headerRegionPx
    expect(slices[1].isFirstSlice).toBe(false)
  })

  it('有候選切割點時，優先切在候選點而不是硬切在理想位置', () => {
    // idealEnd = 1000，但候選點 950 <= 1000，應該切在 950
    const slices = computeSlices(1500, 1000, 100, [950], 1)
    expect(slices[0].end).toBe(950)
  })

  it('候選點超過理想位置時忽略，維持硬切在理想位置', () => {
    const slices = computeSlices(1500, 1000, 100, [1200], 1)
    expect(slices[0].end).toBe(1000)
  })

  it('最後一片不足 6px 時捨棄，不產生空白頁', () => {
    const slices = computeSlices(1003, 1000, 100, [], 1)
    expect(slices.length).toBe(1)
    expect(slices[0].end).toBe(1000)
    // 剩下 3px 不足 6px 門檻，不產生第二片
  })
})
