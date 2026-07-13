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
}))

import { useBidRequestsStore, buildWinningWorkType } from '@/stores/bidRequests'
import { updateDoc, deleteDoc, getDocs } from 'firebase/firestore'

describe('buildWinningWorkType', () => {
    const bidRequest = {
        id: 'br1',
        category: '水電',
        bids: [
            { id: 'bid1', vendorId: 'v1', vendorName: '阿明水電', quoteAmount: 50000, includesTax: true, note: '含材料' },
            { id: 'bid2', vendorId: 'v2', vendorName: '志明水電', quoteAmount: 0, includesTax: false, note: '' },
        ],
    }

    it('builds a workType entry from the winning bid', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid1', 0)
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
    })

    it('leaves vendorCostItems empty when quoteAmount is 0', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid2', 0)
        expect(wt.vendorCostItems).toEqual([])
    })

    it('cycles color by existing work type count', () => {
        const wt = buildWinningWorkType(bidRequest, 'bid1', 9)
        expect(wt.color).toBe('#f59e0b') // index 9 % 8 = 1
    })

    it('throws when the winning bid id does not exist', () => {
        expect(() => buildWinningWorkType(bidRequest, 'missing', 0)).toThrow()
    })
})

describe('useBidRequestsStore actions', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    it('addBid appends a new bid to the matching bidRequest', async () => {
        const store = useBidRequestsStore()
        store.bidRequests = [{ id: 'br1', category: '水電', bids: [] }]
        await store.addBid('case1', 'br1', { vendorId: 'v1', vendorName: '阿明水電', quoteAmount: 50000, includesTax: true, note: '' })
        expect(updateDoc).toHaveBeenCalledTimes(1)
        const [, data] = updateDoc.mock.calls[0]
        expect(data.bids).toHaveLength(1)
        expect(data.bids[0]).toMatchObject({ vendorId: 'v1', vendorName: '阿明水電', quoteAmount: 50000 })
        expect(data.bids[0].id).toMatch(/^bid_/)
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
