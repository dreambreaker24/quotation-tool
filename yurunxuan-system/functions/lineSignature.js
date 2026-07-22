import { createHmac } from 'crypto'

export function verifyLineSignature(rawBody, signature, channelSecret) {
    if (!signature) return false
    const expected = createHmac('SHA256', channelSecret).update(rawBody).digest('base64')
    return expected === signature
}
