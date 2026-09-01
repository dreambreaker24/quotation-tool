// invoice_manager/naiship_sync.js
const admin = require('firebase-admin');
const path  = require('path');

const KEY_PATH = path.join(__dirname, '..', 'naiship-system', 'firebase-admin-key.json');

let cachedApp = null;
function getNaishipApp() {
    if (!cachedApp) {
        const key = require(KEY_PATH);
        cachedApp = admin.initializeApp({ credential: admin.credential.cert(key) }, 'naiship-sync');
    }
    return cachedApp;
}

async function getNaishipCaseNames() {
    const db   = getNaishipApp().firestore();
    const snap = await db.collection('cases').get();
    return snap.docs
        .map(d => String(d.data().name || '').trim())
        .filter(Boolean);
}

function mergeCaseNames(naishipNames, existingNames) {
    const result = [...naishipNames];
    for (const name of existingNames) {
        if (!result.includes(name)) result.push(name);
    }
    return result;
}

module.exports = { getNaishipCaseNames, mergeCaseNames };
