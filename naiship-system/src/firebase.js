import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, terminate, clearIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// import.meta.env.DEV 在 `vite build`（正式部署用）永遠是 false，就算 .env 忘記關旗標，
// 部署上線的版本也不會連到 emulator，只有 `npm run dev` 本機開發才可能生效
const useEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true'

const app = initializeApp(firebaseConfig)
// 本機快取：重新整理/切頁時只向伺服器拿有變動的資料，節省每日讀取額度；支援同時開多個分頁。
// 模擬資料庫模式只用記憶體快取，避免模擬資料跟正式資料混在同一個瀏覽器快取裡
export const db = initializeFirestore(app, {
    localCache: useEmulator
        ? memoryLocalCache()
        : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const auth = getAuth(app)
export const storage = getStorage(app)

if (useEmulator) {
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectAuthEmulator(auth, 'http://localhost:9099')
    // Playwright 測試用 scripts/emulator/login-as.mjs 直接登入，不用走 Google 登入畫面
    window.__e2eSignIn = token => signInWithCustomToken(auth, token)
}

// 登出時清掉本機快取，避免共用電腦留下案件/薪資等資料；清完 db 就不能再用，呼叫端要重新載入頁面
export async function clearLocalCache() {
    await terminate(db)
    await clearIndexedDbPersistence(db)
}
