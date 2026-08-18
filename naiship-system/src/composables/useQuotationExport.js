import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// 對應舊版 quotation-dev.html 第 3589-3610 行：找出安全切割候選點
// （各 tbody 間隙、各列底部），輸出由小到大排序的 DOM 座標陣列（單位：CSS px，相對 page2 頂部）
export function findCutCandidates(page2El) {
    const p2Rect = page2El.getBoundingClientRect()
    const candidates = []
    const tbodies = Array.from(page2El.querySelector('#detail-table').children)
        .filter(el => el.tagName === 'TBODY')
    for (let i = 0; i < tbodies.length - 1; i++) {
        const bot = tbodies[i].getBoundingClientRect().bottom - p2Rect.top
        const nxt = tbodies[i + 1].getBoundingClientRect().top - p2Rect.top
        if (nxt > bot) candidates.push(Math.round((bot + nxt) / 2))
    }
    for (const outerTbody of tbodies) {
        const innerTable = outerTbody.querySelector('table')
        if (!innerTable) continue
        const innerTbody = Array.from(innerTable.children).find(el => el.tagName === 'TBODY')
        if (!innerTbody) continue
        const innerTrs = Array.from(innerTbody.children)
        for (let j = 0; j < innerTrs.length - 1; j++) {
            const trBot = innerTrs[j].getBoundingClientRect().bottom - p2Rect.top
            if (trBot > 0) candidates.push(Math.round(trBot))
        }
    }
    candidates.sort((a, b) => a - b)
    return candidates
}

// 對應舊版第 3664-3701 行的切片迴圈邏輯，抽成純函式方便測試：
// 輸入總高度、單頁可用高度、候選切割點，輸出每一片的 [start, end)（單位：canvas px，已含 scale）
export function computeSlices(effectiveH, a4SlicePx, headerRegionPx, cutCandidatesDom, scale) {
    const slices = []
    let sliceStart = 0
    let isFirstSlice = true
    while (sliceStart < effectiveH) {
        const availPx = isFirstSlice ? a4SlicePx : (a4SlicePx - headerRegionPx)
        const idealEnd = sliceStart + availPx
        let sliceEnd
        if (idealEnd >= effectiveH) {
            sliceEnd = effectiveH
        } else {
            const idealDom = idealEnd / scale
            let bestDom = idealDom
            for (const c of cutCandidatesDom) { if (c <= idealDom) bestDom = c; else break }
            sliceEnd = Math.min(Math.round(bestDom * scale), effectiveH)
            if (sliceEnd <= sliceStart) sliceEnd = Math.min(idealEnd, effectiveH)
        }
        const sliceH = sliceEnd - sliceStart
        if (sliceH < 6) break
        slices.push({ start: sliceStart, end: sliceEnd, isFirstSlice })
        isFirstSlice = false
        sliceStart = sliceEnd
    }
    return slices
}

// 對應舊版 _bakeLogoGlow（第 3538-3551 行）：html2canvas 不支援 filter:drop-shadow，
// 截圖前用 canvas shadow 手動燒入光暈，四層 shadowBlur 疊加順序不能變
function bakeLogoGlow(logoEl, scale) {
    const w = logoEl.offsetWidth, h = logoEl.offsetHeight
    if (!w || !h) return null
    const c = document.createElement('canvas')
    c.width = w * scale; c.height = h * scale
    const ctx = c.getContext('2d')
    ctx.scale(scale, scale)
    ctx.shadowColor = 'rgba(201,169,110,0.6)'; ctx.shadowBlur = 40; ctx.drawImage(logoEl, 0, 0, w, h)
    ctx.shadowColor = 'rgba(255,220,150,0.9)'; ctx.shadowBlur = 18; ctx.drawImage(logoEl, 0, 0, w, h)
    ctx.shadowColor = 'rgba(255,255,255,1)';   ctx.shadowBlur = 6;  ctx.drawImage(logoEl, 0, 0, w, h)
    ctx.shadowBlur = 0; ctx.drawImage(logoEl, 0, 0, w, h)
    return c.toDataURL('image/png')
}

/**
 * @param {Object} refs - 對應舊版 getElementById 目標，改成 template ref
 * @param {HTMLElement} refs.page1El - QuotationPreviewPage1 的根元素（#a4-page）
 * @param {HTMLElement} refs.page2El - QuotationPreviewPage2 的根元素（#a4-page-2）
 * @param {HTMLElement} refs.logo1El - page1 的 logo img
 * @param {HTMLElement} refs.logo2El - page2 的 logo img
 * @param {HTMLElement} refs.wmPage2El - page2 的浮水印 img（第一片不用隱藏，因為第一片是 page1 直接輸出；page2 截圖前要隱藏這個浮水印，理由見舊版第 3612 行註解）
 * @param {number} p1Zoom - 對應舊版 __pfit 的 zoom 值，1 代表不縮放
 * @returns {Promise<Blob>} PDF blob
 */
export async function exportQuotationPdf({ page1El, page2El, logo1El, logo2El, wmPage2El }, p1Zoom = 1) {
    const captureOpts = { scale: 3, useCORS: true, backgroundColor: '#ffffff' }

    // 擷取第一頁（對應舊版第 3553-3561 行）
    const logo1Baked = bakeLogoGlow(logo1El, captureOpts.scale)
    const logo1OrigSrc = logo1El.src, logo1OrigFilter = logo1El.style.filter
    if (logo1Baked) { logo1El.src = logo1Baked; logo1El.style.filter = 'none' }
    await new Promise(r => setTimeout(r, 0))
    const canvas1 = await html2canvas(page1El, captureOpts)
    logo1El.src = logo1OrigSrc; logo1El.style.filter = logo1OrigFilter

    let page1DataUrl, page1H
    if (p1Zoom < 0.999) {
        const sc = document.createElement('canvas')
        sc.width = Math.round(canvas1.width * p1Zoom); sc.height = Math.round(canvas1.height * p1Zoom)
        const ctx = sc.getContext('2d'); ctx.scale(p1Zoom, p1Zoom); ctx.drawImage(canvas1, 0, 0)
        page1DataUrl = sc.toDataURL('image/jpeg', 0.95)
        page1H = Math.min(sc.height / sc.width * 210, 297)
    } else {
        page1DataUrl = canvas1.toDataURL('image/jpeg', 0.95)
        page1H = Math.min(canvas1.height / canvas1.width * 210, 297)
    }

    // 對應舊版第 3578-3610 行：算頁首高度、安全切割候選點
    const p2Rect = page2El.getBoundingClientRect()
    const headerEl = page2El.querySelector('#prev2-header')
    const headerHeightPx = Math.round(headerEl.getBoundingClientRect().height * captureOpts.scale)
    const headerRegionPx = Math.round(
        (headerEl.getBoundingClientRect().bottom - p2Rect.top + 4 / 25.4 * 96) * captureOpts.scale
    )
    const cutCandidatesDom = findCutCandidates(page2El)

    // 對應舊版第 3612-3624 行：截圖前隱藏浮水印、燒錄 page2 logo 光暈
    const wmOrigDisplay = wmPage2El.style.display
    wmPage2El.style.display = 'none'
    const logo2Baked = bakeLogoGlow(logo2El, captureOpts.scale)
    const logo2OrigSrc = logo2El.src, logo2OrigFilter = logo2El.style.filter
    if (logo2Baked) { logo2El.src = logo2Baked; logo2El.style.filter = 'none' }
    await new Promise(r => setTimeout(r, 0))
    const canvas2 = await html2canvas(page2El, captureOpts)
    logo2El.src = logo2OrigSrc; logo2El.style.filter = logo2OrigFilter
    wmPage2El.style.display = wmOrigDisplay

    // 對應舊版第 3626-3639 行：預載浮水印圖片，後面每片手動疊加 10% 透明度
    const wmImg = new Image()
    wmImg.crossOrigin = 'anonymous'
    wmImg.src = wmPage2El.src
    await new Promise(r => { if (wmImg.complete && wmImg.naturalWidth) r(); else { wmImg.onload = r; wmImg.onerror = r } })
    const drawWm = (ctx, w, h) => {
        if (!wmImg.complete || !wmImg.naturalWidth) return
        const wmW = w * 0.62
        const wmH = wmW * wmImg.naturalHeight / wmImg.naturalWidth
        ctx.save()
        ctx.globalAlpha = 0.10
        ctx.drawImage(wmImg, (w - wmW) / 2, (h - wmH) / 2, wmW, wmH)
        ctx.restore()
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    pdf.addImage(page1DataUrl, 'JPEG', 0, 0, 210, page1H)

    // 對應舊版第 3650-3702 行：智慧分頁主迴圈
    const a4SlicePx = Math.round(297 / 25.4 * 96 * captureOpts.scale)
    const detailEl = page2El.querySelector('#detail-table')
    const detailBottom = detailEl.getBoundingClientRect().bottom
    const effectiveH = Math.min(
        canvas2.height,
        Math.ceil((detailBottom - p2Rect.top + 14 / 25.4 * 96) * captureOpts.scale) + captureOpts.scale * 2
    )

    const slices = computeSlices(effectiveH, a4SlicePx, headerRegionPx, cutCandidatesDom, captureOpts.scale)
    for (const { start, end, isFirstSlice } of slices) {
        const sliceH = end - start
        pdf.addPage()
        if (isFirstSlice) {
            const slice = document.createElement('canvas')
            slice.width = canvas2.width; slice.height = sliceH
            const sliceCtx = slice.getContext('2d')
            sliceCtx.drawImage(canvas2, 0, start, canvas2.width, sliceH, 0, 0, canvas2.width, sliceH)
            drawWm(sliceCtx, slice.width, slice.height)
            pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, sliceH / canvas2.width * 210)
        } else {
            const pageCanvas = document.createElement('canvas')
            pageCanvas.width = canvas2.width; pageCanvas.height = headerRegionPx + sliceH
            const ctx = pageCanvas.getContext('2d')
            ctx.drawImage(canvas2, 0, 0, canvas2.width, headerRegionPx, 0, 0, canvas2.width, headerRegionPx)
            ctx.drawImage(canvas2, 0, start, canvas2.width, sliceH, 0, headerRegionPx, canvas2.width, sliceH)
            drawWm(ctx, pageCanvas.width, pageCanvas.height)
            pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, pageCanvas.height / canvas2.width * 210)
        }
    }

    return pdf.output('blob')
}

// 對應舊版 updatePrintZoom（第 3470-3483 行）：判斷 page1 內容是否超過 A4 可印刷高度，
// 超過就回傳縮小比例（給 exportQuotationPdf 的 p1Zoom 參數用），沒超過回傳 1
export function computePrintZoom(page1El) {
    const a4Px = 297 / 25.4 * 96 * 0.93
    const h = page1El.scrollHeight
    if (h > a4Px) return a4Px / h
    return 1
}
