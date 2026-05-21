import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore'
import dotenv from 'dotenv'
dotenv.config()

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
})
const db = getFirestore(app)

const cases = [
    {
        name: '台南東區翻新',
        companyId: 'south',
        assignedTo: 'placeholder-uid-1',
        assigneeName: '柯其宏',
        status: 'construction',
        estimatedAmount: 1300000,
        signedAmount: 1200000,
        startDate: Timestamp.fromDate(new Date('2026-05-02')),
        endDate: Timestamp.fromDate(new Date('2026-05-22'))
    },
    {
        name: '永康老屋改造',
        companyId: 'south',
        assignedTo: 'placeholder-uid-2',
        assigneeName: '黃怡君',
        status: 'drafting',
        estimatedAmount: 800000,
        signedAmount: 0
    },
    {
        name: '安平商業空間',
        companyId: 'south',
        assignedTo: 'placeholder-uid-3',
        assigneeName: '蔡明哲',
        status: 'negotiating',
        estimatedAmount: 2000000,
        signedAmount: 0
    },
    {
        name: '台北信義住宅',
        companyId: 'north',
        assignedTo: 'placeholder-uid-4',
        assigneeName: '林志遠',
        status: 'construction',
        estimatedAmount: 2000000,
        signedAmount: 1800000,
        startDate: Timestamp.fromDate(new Date('2026-04-15')),
        endDate: Timestamp.fromDate(new Date('2026-06-01'))
    }
]

async function seed() {
    console.log('Seeding cases...')
    for (const c of cases) {
        await addDoc(collection(db, 'cases'), { ...c, createdAt: Timestamp.now() })
        console.log(`  ✓ ${c.name}`)
    }
    console.log('Seed done')
    process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
