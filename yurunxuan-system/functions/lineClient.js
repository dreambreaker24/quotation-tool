export async function fetchLineProfile(userId, accessToken) {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!response.ok) {
        throw new Error(`LINE profile 查詢失敗（HTTP ${response.status}）`)
    }
    return response.json()
}

export async function sendLinePush(userId, text, accessToken) {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] })
    })
    if (!response.ok) {
        throw new Error(`LINE push 發送失敗（HTTP ${response.status}）`)
    }
}
