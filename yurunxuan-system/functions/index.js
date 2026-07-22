import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { verifyLineSignature } from './lineSignature.js'
import { fetchLineProfile } from './lineClient.js'

initializeApp()
const db = getFirestore()

const LINE_CHANNEL_SECRET = defineSecret('LINE_CHANNEL_SECRET')
const LINE_CHANNEL_ACCESS_TOKEN = defineSecret('LINE_CHANNEL_ACCESS_TOKEN')

export const lineWebhook = onRequest(
    { secrets: [LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN] },
    async (req, res) => {
        const signature = req.get('x-line-signature')
        if (!verifyLineSignature(req.rawBody, signature, LINE_CHANNEL_SECRET.value())) {
            res.status(401).send('invalid signature')
            return
        }

        const events = req.body.events || []
        for (const event of events) {
            if (event.type === 'follow') {
                await handleFollow(event.source.userId, LINE_CHANNEL_ACCESS_TOKEN.value())
            }
        }
        res.status(200).send('OK')
    }
)

async function handleFollow(userId, accessToken) {
    const ref = db.collection('lineRecipients').doc(userId)
    const snap = await ref.get()
    if (snap.exists) return

    const profile = await fetchLineProfile(userId, accessToken)
    await ref.set({
        name: profile.displayName,
        notifyLowStock: false,
        notifyDailySummary: false,
        followedAt: FieldValue.serverTimestamp()
    })
}
