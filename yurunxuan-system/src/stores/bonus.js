// src/stores/bonus.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { usePurchaseLogsStore } from '@/stores/purchaseLogs'
import { getQuarterDateRange } from '@/utils/quarter'
import {
    calcQuarterRevenue, calcCogs, calcQuarterExpense, calcQuarterProfit,
    calcTeamBonusPool, splitTeamBonusEqually, calcIndividualCommission, mergeRecalculatedEntries,
} from '@/utils/bonusCalc'

export const useBonusStore = defineStore('bonus', () => {
    const settings = ref({ teamProfitThreshold: null, teamBonusPercent: null, individualCommissionRate: null })
    const currentQuarter = ref(null)
    const unknownDrinkNames = ref([])

    async function loadSettings() {
        const snap = await getDoc(doc(db, 'settings', 'bonus'))
        if (snap.exists()) settings.value = { ...settings.value, ...snap.data() }
    }

    async function updateSettings(patch) {
        const next = { ...settings.value, ...patch }
        await setDoc(doc(db, 'settings', 'bonus'), next, { merge: true })
        settings.value = next
    }

    async function loadQuarter(quarterKey) {
        const snap = await getDoc(doc(db, 'bonusQuarters', quarterKey))
        currentQuarter.value = snap.exists() ? snap.data() : null
    }

    async function fetchNonOwnerParticipants() {
        const snap = await getDocs(collection(db, 'users'))
        return snap.docs
            .map(d => ({ uid: d.id, ...d.data() }))
            .filter(u => u.role !== 'owner')
            .map(u => ({ uid: u.uid, name: u.name }))
    }

    async function calculateQuarter(quarterKey) {
        const { start, end } = getQuarterDateRange(quarterKey)

        const [revenueSnap, expenseSnap, recipeSnap, expenseItemSnap, unitCostMap, participants] = await Promise.all([
            getDocs(query(collection(db, 'revenueLogs'), where('date', '>=', start), where('date', '<=', end))),
            getDocs(query(collection(db, 'monthlyExpenses'), where('date', '>=', start), where('date', '<=', end))),
            getDocs(collection(db, 'recipes')),
            getDocs(collection(db, 'expenseItems')),
            usePurchaseLogsStore().getLatestUnitCosts(),
            fetchNonOwnerParticipants(),
        ])

        const revenueLogs = revenueSnap.docs.map(d => d.data())
        const monthlyExpenses = expenseSnap.docs.map(d => d.data())
        const recipes = recipeSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const expenseItems = expenseItemSnap.docs.map(d => d.data())

        const revenue = calcQuarterRevenue(revenueLogs)
        const { cogs, unknownDrinkNames: unknown } = calcCogs(revenueLogs, recipes, unitCostMap)
        const expense = calcQuarterExpense(monthlyExpenses, expenseItems)
        const profit = calcQuarterProfit(revenue, cogs, expense)

        const threshold = settings.value.teamProfitThreshold || 0
        const percent = settings.value.teamBonusPercent || 0
        const rate = settings.value.individualCommissionRate || 0

        const poolAmount = calcTeamBonusPool(profit, threshold, percent)
        const freshTeamParticipants = splitTeamBonusEqually(poolAmount, participants)
        const freshIndividual = calcIndividualCommission(revenueLogs, participants, rate)

        const mergedTeamParticipants = mergeRecalculatedEntries(freshTeamParticipants, currentQuarter.value?.team?.participants)
        const mergedIndividual = mergeRecalculatedEntries(freshIndividual, currentQuarter.value?.individual)

        const authStore = useAuthStore()
        const data = {
            team: { revenue, cogs, expense, profit, threshold, percent, poolAmount, participants: mergedTeamParticipants },
            individual: mergedIndividual,
            calculatedAt: serverTimestamp(),
            calculatedBy: authStore.name ?? '',
        }

        await setDoc(doc(db, 'bonusQuarters', quarterKey), data)
        currentQuarter.value = data
        unknownDrinkNames.value = unknown
    }

    async function updateIndividualFinalAmount(quarterKey, uid, finalAmount) {
        const ref = doc(db, 'bonusQuarters', quarterKey)
        const snap = await getDoc(ref)
        const data = snap.data()
        const updated = data.individual.map(e => e.uid === uid ? { ...e, finalAmount } : e)
        await updateDoc(ref, { individual: updated })
        currentQuarter.value = { ...data, individual: updated }
    }

    async function setIndividualPaid(quarterKey, uid, paid) {
        const authStore = useAuthStore()
        const ref = doc(db, 'bonusQuarters', quarterKey)
        const snap = await getDoc(ref)
        const data = snap.data()
        const updated = data.individual.map(e => e.uid === uid
            ? { ...e, paid, paidAt: paid ? Timestamp.now() : null, paidBy: paid ? (authStore.name ?? '') : null }
            : e)
        await updateDoc(ref, { individual: updated })
        currentQuarter.value = { ...data, individual: updated }
    }

    async function setTeamPaid(quarterKey, uid, paid) {
        const authStore = useAuthStore()
        const ref = doc(db, 'bonusQuarters', quarterKey)
        const snap = await getDoc(ref)
        const data = snap.data()
        const updated = data.team.participants.map(e => e.uid === uid
            ? { ...e, paid, paidAt: paid ? Timestamp.now() : null, paidBy: paid ? (authStore.name ?? '') : null }
            : e)
        await updateDoc(ref, { 'team.participants': updated })
        currentQuarter.value = { ...data, team: { ...data.team, participants: updated } }
    }

    return {
        settings, currentQuarter, unknownDrinkNames,
        loadSettings, updateSettings, loadQuarter, calculateQuarter,
        updateIndividualFinalAmount, setIndividualPaid, setTeamPaid,
    }
})
