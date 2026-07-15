// naiship-system/tests/stores/bidRequests.test.js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn((q, cb) => { cb({ docs: [] }); return () => {} }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    doc: vi.fn(),
    serverTimestamp: vi.fn(() => 'ts'),
    arrayUnion: vi.fn((item) => ({ __op: 'arrayUnion', item })),
}))

import { useBidRequestsStore, buildWinningWorkType } from '@/stores/bidRequests'
import { addDoc, updateDoc, deleteDoc, getDocs, arrayUnion } from 'firebase/firestore'

describe('buildWinningWorkType', () => {
    const bidRequest = {
        id: 'br1',
        category: '水電',
        bids: [
            { id: 'bid1', vendorId: 'v1', vendorName: '阿明水電', quoteAmount: 50000, includesTax: true, note: '含材料' },
            { id: 'bid2', vendorId: 'v2', vendorName: '志明水電', quoteAmount: 0, includesTax: false, note: '' },
        ],
    }
    const finalVendor = { vendorId: 'v1', vendorName: '阿明水電' }

    it('builds a workType entry from the winning bid', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid1', 0, finalVendor, '水電')
        expect(wt.name).toBe('水電')
        expect(wt.vendorId).toBe('v1')
        expect(wt.vendorName).toBe('阿明水電')
        expect(wt.hasQuote).toBe(true)
        expect(wt.costIncludesTax).toBe(true)
        expect(wt.vendorCostItems).toEqual([
            { id: expect.any(String), description: '水電', amount: 50000, note: '含材料' }
        ])
        expect(wt.locations).toEqual([])
        expect(wt.done).toBe(false)
        expect(wt.customName).toBe(false)
    })

    it('leaves vendorCostItems empty when quoteAmount is 0', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid2', 0, finalVendor, '水電')
        expect(wt.vendorCostItems).toEqual([])
    })

    it('cycles color by existing work type count', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid1', 9, finalVendor, '水電')
        expect(wt.color).toBe('#f59e0b') // index 9 % 8 = 1
    })

    it('throws when the winning bid id does not exist', () => {
        expect(() => buildWinningWorkType(bidRequest, 'missing', 0, finalVendor, '水電')).toThrow()
    })

    it('throws when finalVendor is missing or has no vendorId', () => {
        expect(() => buildWinningWorkType(bidRequest, 'bid1', 0, undefined, '水電')).toThrow()
        expect(() => buildWinningWorkType(bidRequest, 'bid1', 0, {}, '水電')).toThrow()
    })

    it('uses the bid request item name and marks customName when no work category is chosen', () => {
        const sofaRequest = {
            id: 'br2', category: '沙發', bids: [
                { id: 'bid1', vendorId: '', vendorName: 'IKEA', quoteAmount: 8000, includesTax: false, note: '' },
            ]
        }
        const wt = buildWinningWorkType(sofaRequest, 'bid1', 0, { vendorId: 'v9', vendorName: 'IKEA' }, '')
        expect(wt.name).toBe('沙發')
        expect(wt.customName).toBe(true)
        expect(wt.vendorId).toBe('v9')
    })
})

describe('useBidRequestsStore actions', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    it('addBidRequest writes category, workCategory and defaults', async () => {
        const store = useBidRequestsStore()
        await store.addBidRequest('case1', '沙發', '', '', 'uid1')
        expect(addDoc).toHaveBeenCalledTimes(1)
        const [, data] = addDoc.mock.calls[0]
        expect(data).toMatchObject({ category: '沙發', workCategory: '', note: '', status: 'open', bids: [], createdBy: 'uid1' })
    })

    it('addBid writes the new bid via arrayUnion instead of overwriting the whole array', async () => {
        const store = useBidRequestsStore()
        await store.addBid('case1', 'br1', { vendorId: '', vendorName: 'IKEA', quoteAmount: 8000, includesTax: false, note: '' })
        expect(arrayUnion).toHaveBeenCalledTimes(1)
        const newBid = arrayUnion.mock.calls[0][0]
        expect(newBid).toMatchObject({ vendorId: '', vendorName: 'IKEA', quoteAmount: 8000 })
        expect(newBid.id).toMatch(/^bid_/)
        expect(updateDoc).toHaveBeenCalledTimes(1)
        const [, data] = updateDoc.mock.calls[0]
        expect(data).toEqual({ bids: { __op: 'arrayUnion', item: newBid } })
    })

    it('appendQuotePhotoId appends a photo id to the matching bid quotePhotoIds', async () => {
        const store = useBidRequestsStore()
        store.bidRequests = [{ id: 'br1', category: '水電', bids: [{ id: 'bid1', quotePhotoIds: ['p0'] }] }]
        await store.appendQuotePhotoId('case1', 'br1', 'bid1', 'p1')
        expect(updateDoc).toHaveBeenCalledTimes(1)
        const [, data] = updateDoc.mock.calls[0]
        expect(data.bids[0].quotePhotoIds).toEqual(['p0', 'p1'])
    })

    it('removeQuotePhotoId deletes the photo doc and filters the id out of quotePhotoIds', async () => {
        const store = useBidRequestsStore()
        store.bidRequests = [{ id: 'br1', category: '水電', bids: [{ id: 'bid1', quotePhotoIds: ['p0', 'p1'] }] }]
        await store.removeQuotePhotoId('case1', 'br1', 'bid1', 'p1')
        expect(deleteDoc).toHaveBeenCalledTimes(1)
        expect(updateDoc).toHaveBeenCalledTimes(1)
        const [, data] = updateDoc.mock.calls[0]
        expect(data.bids[0].quotePhotoIds).toEqual(['p0'])
    })

    it('markConverted writes status, winningBidId and convertedWorkTypeId', async () => {
        const store = useBidRequestsStore()
        await store.markConverted('case1', 'br1', 'bid1', 'wt1')
        expect(updateDoc).toHaveBeenCalledWith(undefined, {
            status: 'converted', winningBidId: 'bid1', convertedWorkTypeId: 'wt1',
        })
    })

    it('repointQuotePhotos updates every photo id to vendor_quote with the new workTypeId', async () => {
        const store = useBidRequestsStore()
        await store.repointQuotePhotos('case1', ['p1', 'p2'], 'wt1')
        expect(updateDoc).toHaveBeenCalledTimes(2)
        expect(updateDoc.mock.calls[0][1]).toEqual({ type: 'vendor_quote', workTypeId: 'wt1' })
    })

    it('deleteBidRequest deletes associated photos then the bidRequest doc', async () => {
        getDocs.mockResolvedValueOnce({ docs: [{ ref: 'photoRef1' }, { ref: 'photoRef2' }] })
        const store = useBidRequestsStore()
        await store.deleteBidRequest('case1', 'br1')
        expect(deleteDoc).toHaveBeenCalledWith('photoRef1')
        expect(deleteDoc).toHaveBeenCalledWith('photoRef2')
        expect(deleteDoc).toHaveBeenCalledTimes(3) // 2 photos + the bidRequest doc itself
    })
})
