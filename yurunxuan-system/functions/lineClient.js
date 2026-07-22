export async function fetchLineProfile(userId, accessToken) {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!response.ok) {
        throw new Error(`LINE profile 查詢失敗（HTTP ${response.status}）`)
    }
    return response.json()
}
