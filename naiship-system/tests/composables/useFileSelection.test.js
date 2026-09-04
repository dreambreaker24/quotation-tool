import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useFileSelection } from '@/composables/useFileSelection'

function makeItems() {
    return ref([
        { url: 'https://example.com/a.jpg', isPdf: false },
        { url: 'https://example.com/b.jpg', isPdf: false },
        { url: 'https://example.com/c.pdf', isPdf: true },
    ])
}

describe('useFileSelection - 選取狀態', () => {
    it('預設不在選取模式，選取集合是空的', () => {
        const { selecting, selected } = useFileSelection(makeItems())
        expect(selecting.value).toBe(false)
        expect(selected.value.size).toBe(0)
    })

    it('startSelecting 進入選取模式', () => {
        const { selecting, startSelecting } = useFileSelection(makeItems())
        startSelecting()
        expect(selecting.value).toBe(true)
    })

    it('toggle 切換單一項目選取狀態', () => {
        const items = makeItems()
        const { selected, toggle } = useFileSelection(items)
        toggle('https://example.com/a.jpg')
        expect(selected.value.has('https://example.com/a.jpg')).toBe(true)
        toggle('https://example.com/a.jpg')
        expect(selected.value.has('https://example.com/a.jpg')).toBe(false)
    })

    it('selectAll 選取目前清單全部項目', () => {
        const items = makeItems()
        const { selected, selectAll } = useFileSelection(items)
        selectAll()
        expect(selected.value.size).toBe(3)
    })

    it('clearSelection 清空已選但維持選取模式', () => {
        const items = makeItems()
        const { selecting, selected, startSelecting, selectAll, clearSelection } = useFileSelection(items)
        startSelecting()
        selectAll()
        clearSelection()
        expect(selecting.value).toBe(true)
        expect(selected.value.size).toBe(0)
    })

    it('stopSelecting 離開選取模式並清空已選', () => {
        const items = makeItems()
        const { selecting, selected, startSelecting, selectAll, stopSelecting } = useFileSelection(items)
        startSelecting()
        selectAll()
        stopSelecting()
        expect(selecting.value).toBe(false)
        expect(selected.value.size).toBe(0)
    })
})

describe('useFileSelection - canShare', () => {
    const originalShare = globalThis.navigator?.share
    const originalCanShare = globalThis.navigator?.canShare

    afterEach(() => {
        globalThis.navigator.share = originalShare
        globalThis.navigator.canShare = originalCanShare
    })

    it('裝置支援檔案分享時 canShare 是 true', () => {
        globalThis.navigator.canShare = () => true
        const { canShare } = useFileSelection(makeItems())
        expect(canShare.value).toBe(true)
    })

    it('裝置不支援時 canShare 是 false', () => {
        globalThis.navigator.canShare = undefined
        const { canShare } = useFileSelection(makeItems())
        expect(canShare.value).toBe(false)
    })
})

describe('useFileSelection - downloadSelected', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }))
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
        globalThis.URL.revokeObjectURL = vi.fn()
    })

    it('只下載目前已選取的項目，回傳失敗數 0', async () => {
        const items = makeItems()
        const { selected, toggle, downloadSelected } = useFileSelection(items)
        toggle('https://example.com/a.jpg')
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
        const result = await downloadSelected()
        expect(clickSpy).toHaveBeenCalledTimes(1)
        expect(result.failCount).toBe(0)
        clickSpy.mockRestore()
    })

    it('fetch 失敗時累計失敗數，不中斷其他檔案', async () => {
        const items = makeItems()
        const { selectAll, downloadSelected } = useFileSelection(items)
        selectAll()
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce({ blob: async () => new Blob(['x']) })
            .mockRejectedValueOnce(new Error('network error'))
            .mockResolvedValueOnce({ blob: async () => new Blob(['x']) })
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
        const result = await downloadSelected()
        expect(result.failCount).toBe(1)
        expect(clickSpy).toHaveBeenCalledTimes(2)
        clickSpy.mockRestore()
    })
})

describe('useFileSelection - shareSelected', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }))
    })

    it('把已選項目 fetch 成 File 後呼叫 navigator.share 一次', async () => {
        const items = makeItems()
        const { selectAll, shareSelected } = useFileSelection(items)
        selectAll()
        globalThis.navigator.share = vi.fn(async () => {})
        const result = await shareSelected()
        expect(globalThis.navigator.share).toHaveBeenCalledTimes(1)
        const callArg = globalThis.navigator.share.mock.calls[0][0]
        expect(callArg.files.length).toBe(3)
        expect(result.ok).toBe(true)
    })

    it('使用者取消分享面板（AbortError）不算失敗', async () => {
        const items = makeItems()
        const { selectAll, shareSelected } = useFileSelection(items)
        selectAll()
        const abortErr = new Error('cancelled')
        abortErr.name = 'AbortError'
        globalThis.navigator.share = vi.fn(async () => { throw abortErr })
        const result = await shareSelected()
        expect(result.ok).toBe(true)
    })
})
