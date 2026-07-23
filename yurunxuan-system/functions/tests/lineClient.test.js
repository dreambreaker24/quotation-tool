import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendLinePush } from '../lineClient.js'

describe('sendLinePush', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('呼叫 LINE push API 時帶正確的 URL、headers、body', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true })
        vi.stubGlobal('fetch', fetchMock)

        await sendLinePush('U1234', '庫存低於門檻', 'test-access-token')

        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.line.me/v2/bot/message/push',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer test-access-token'
                },
                body: JSON.stringify({
                    to: 'U1234',
                    messages: [{ type: 'text', text: '庫存低於門檻' }]
                })
            }
        )
    })

    it('LINE API 回傳非 2xx 時拋出錯誤', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))

        await expect(sendLinePush('U1234', '測試', 'test-access-token'))
            .rejects.toThrow('LINE push 發送失敗（HTTP 400）')
    })
})
