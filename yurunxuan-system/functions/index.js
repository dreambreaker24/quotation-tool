import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { verifyLineSignature } from './lineSignature.js'
import { fetchLineProfile, sendLinePush } from './lineClient.js'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { shouldSendLowStockPush } from './lowStockCheck.js'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { aggregateDailyStats, buildDailySummaryText } from './dailySummary.js'

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

export const checkLowStockOnBatchWrite = onDocumentWritten(
    { document: 'productionBatches/{batchId}', secrets: [LINE_CHANNEL_ACCESS_TOKEN] },
    (event) => handleBatchWrite(event)
)

async function handleBatchWrite(event) {
    const after = event.data.after.data()
    const before = event.data.before.data()
    const drinkId = after?.drinkId || before?.drinkId
    if (!drinkId) return

    const drinkName = after?.drinkName || before?.drinkName
    const recipeRef = db.collection('recipes').doc(drinkId)

    const pushInfo = await db.runTransaction(async (transaction) => {
        const recipeSnap = await transaction.get(recipeRef)
        if (!recipeSnap.exists) return null
        const recipe = recipeSnap.data()
        if (recipe.lowStockThreshold == null) return null

        const batchesSnap = await transaction.get(
            db.collection('productionBatches').where('drinkId', '==', drinkId)
        )
        const totalRemainingQty = batchesSnap.docs.reduce(
            (sum, doc) => sum + (doc.data().remainingQty || 0), 0
        )

        const lastPushAt = recipe.lastLowStockPushAt ? recipe.lastLowStockPushAt.toMillis() : null
        const shouldPush = shouldSendLowStockPush({
            totalRemainingQty,
            threshold: recipe.lowStockThreshold,
            lastPushAt,
            now: Date.now()
        })
        if (!shouldPush) return null

        transaction.update(recipeRef, { lastLowStockPushAt: FieldValue.serverTimestamp() })
        return { drinkName, totalRemainingQty, threshold: recipe.lowStockThreshold }
    })

    if (!pushInfo) return

    const text = `${pushInfo.drinkName}庫存低於門檻：剩 ${pushInfo.totalRemainingQty} 杯（門檻 ${pushInfo.threshold} 杯）`
    const recipientsSnap = await db.collection('lineRecipients').where('notifyLowStock', '==', true).get()
    const accessToken = LINE_CHANNEL_ACCESS_TOKEN.value()
    for (const doc of recipientsSnap.docs) {
        try {
            await sendLinePush(doc.id, text, accessToken)
        } catch (err) {
            console.error(`推播低庫存通知給 ${doc.id} 失敗:`, err)
        }
    }
}

export const dailySummaryPush = onSchedule(
    { schedule: '0 18 * * *', timeZone: 'Asia/Taipei', secrets: [LINE_CHANNEL_ACCESS_TOKEN] },
    () => sendDailySummary()
)

function getStartOfDayInTaipei() {
    const todayInTaipei = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date())
    return new Date(`${todayInTaipei}T00:00:00+08:00`)
}

async function sendDailySummary() {
    const startOfDay = getStartOfDayInTaipei()

    const [recipesSnap, productionSnap, revenueSnap, wasteSnap, batchesSnap] = await Promise.all([
        db.collection('recipes').get(),
        db.collection('productionLogs').where('createdAt', '>=', startOfDay).get(),
        db.collection('revenueLogs').where('createdAt', '>=', startOfDay).get(),
        db.collection('wasteLogs').where('createdAt', '>=', startOfDay).get(),
        db.collection('productionBatches').get()
    ])

    const currentStockByDrink = {}
    for (const doc of batchesSnap.docs) {
        const data = doc.data()
        currentStockByDrink[data.drinkId] = (currentStockByDrink[data.drinkId] || 0) + (data.remainingQty || 0)
    }

    const drinkStats = aggregateDailyStats({
        recipes: recipesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })),
        productionDocs: productionSnap.docs.map(doc => doc.data()),
        revenueDocs: revenueSnap.docs.map(doc => doc.data()),
        wasteDocs: wasteSnap.docs.map(doc => doc.data()),
        currentStockByDrink
    })
    const text = buildDailySummaryText(drinkStats)

    const recipientsSnap = await db.collection('lineRecipients').where('notifyDailySummary', '==', true).get()
    const accessToken = LINE_CHANNEL_ACCESS_TOKEN.value()
    for (const doc of recipientsSnap.docs) {
        try {
            await sendLinePush(doc.id, text, accessToken)
        } catch (err) {
            console.error(`推播每日摘要給 ${doc.id} 失敗:`, err)
        }
    }
}
