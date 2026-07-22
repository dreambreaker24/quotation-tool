import { createHmac, timingSafeEqual } from 'crypto'

export function verifyLineSignature(rawBody, signature, channelSecret) {
    if (!signature) return false
    const expected = createHmac('SHA256', channelSecret).update(rawBody).digest('base64')
    const expectedBuffer = Buffer.from(expected)
    const signatureBuffer = Buffer.from(signature)
    if (expectedBuffer.length !== signatureBuffer.length) return false
    return timingSafeEqual(expectedBuffer, signatureBuffer)
}
