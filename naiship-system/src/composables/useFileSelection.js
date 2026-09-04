// 檔案圈選＋下載／分享共用邏輯。9 個顯示照片/PDF 清單的地方都呼叫這個 composable，
// 避免各自重複實作導致邏輯對不起來（跟 D3、C 組修過的問題同一類）。
import { ref, computed } from 'vue'

export function useFileSelection(itemsRef) {
    const selecting = ref(false)
    const selected = ref(new Set())

    const canShare = computed(() => {
        if (typeof navigator === 'undefined' || !navigator.canShare) return false
        try {
            const testFile = new File(['x'], 'test.txt', { type: 'text/plain' })
            return navigator.canShare({ files: [testFile] })
        } catch {
            return false
        }
    })

    function startSelecting() {
        selecting.value = true
    }

    function stopSelecting() {
        selecting.value = false
        selected.value = new Set()
    }

    function toggle(url) {
        const next = new Set(selected.value)
        if (next.has(url)) next.delete(url)
        else next.add(url)
        selected.value = next
    }

    function selectAll() {
        selected.value = new Set((itemsRef.value || []).map(item => item.url))
    }

    function clearSelection() {
        selected.value = new Set()
    }

    function guessFileName(url, isPdf) {
        const base = (url.split('/').pop() || 'file').split('?')[0]
        if (isPdf && !base.toLowerCase().endsWith('.pdf')) return `${base}.pdf`
        return base
    }

    function selectedItems() {
        return (itemsRef.value || []).filter(item => selected.value.has(item.url))
    }

    async function downloadSelected() {
        let failCount = 0
        for (const item of selectedItems()) {
            try {
                const res = await fetch(item.url)
                const blob = await res.blob()
                const blobUrl = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = blobUrl
                a.download = guessFileName(item.url, item.isPdf)
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(blobUrl)
            } catch {
                failCount++
            }
        }
        return { failCount }
    }

    async function shareSelected() {
        const files = []
        let failCount = 0
        for (const item of selectedItems()) {
            try {
                const res = await fetch(item.url)
                const blob = await res.blob()
                files.push(new File([blob], guessFileName(item.url, item.isPdf), { type: blob.type }))
            } catch {
                failCount++
            }
        }
        if (files.length === 0) return { ok: false, failCount }
        try {
            await navigator.share({ files })
            return { ok: true, failCount }
        } catch (err) {
            if (err?.name === 'AbortError') return { ok: true, failCount }
            return { ok: false, failCount }
        }
    }

    return {
        selecting, selected, canShare,
        startSelecting, stopSelecting, toggle, selectAll, clearSelection,
        downloadSelected, shareSelected,
    }
}
