import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifyLineSignature } from '../lineSignature.js'

describe('verifyLineSignature', () => {
    const secret = 'test-channel-secret'
    const body = Buffer.from(JSON.stringify({ events: [] }))
    const validSignature = createHmac('SHA256', secret).update(body).digest('base64')

    it('簽章正確時回傳 true', () => {
        expect(verifyLineSignature(body, validSignature, secret)).toBe(true)
    })

    it('簽章錯誤時回傳 false', () => {
        expect(verifyLineSignature(body, 'this-is-not-the-right-signature', secret)).toBe(false)
    })

    it('完全沒有簽章時回傳 false', () => {
        expect(verifyLineSignature(body, undefined, secret)).toBe(false)
        expect(verifyLineSignature(body, null, secret)).toBe(false)
        expect(verifyLineSignature(body, '', secret)).toBe(false)
    })

    it('body 內容被竄改時，就算簽章看起來像樣也驗證失敗', () => {
        const tamperedBody = Buffer.from(JSON.stringify({ events: [{ type: 'follow', source: { userId: 'fake' } }] }))
        expect(verifyLineSignature(tamperedBody, validSignature, secret)).toBe(false)
    })

    it('channel secret 錯誤時驗證失敗', () => {
        expect(verifyLineSignature(body, validSignature, 'wrong-secret')).toBe(false)
    })
})
