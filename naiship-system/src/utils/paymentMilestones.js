// 記一筆針對「單一收款期款」的收款——首頁儀表板的「待請款」快速完成，跟案件詳情
// PaymentMilestones.vue 的完整編輯表單（可以同時改名稱/金額/到期日）是不同操作，
// 這裡只處理「記錄收到多少錢、哪天收的」這一件事，其餘欄位維持不變。
// paidAmount 是「這一筆收到多少」（增量），不是「累計總共收到多少」——因為期款本來就
// 可能分好幾次收，這個函式負責把新收到的錢加到既有的 paidAmount 上，不能直接覆蓋掉
// 之前已經收過的錢。
export function applyMilestonePayment(milestones, milestoneId, { paidAmount, paidDate }) {
    const idx = milestones.findIndex(m => m.id === milestoneId)
    if (idx === -1) return null
    if (paidAmount <= 0) return null
    const current = milestones[idx]
    if ((current.paidAmount || 0) >= (current.amount || 0) && (current.amount || 0) > 0) return null
    const newPaidAmount = (current.paidAmount || 0) + paidAmount
    const newMilestones = [...milestones]
    newMilestones[idx] = { ...current, paidAmount: newPaidAmount, paidDate }
    const fullyPaid = newPaidAmount >= (current.amount || 0) && (current.amount || 0) > 0
    return { milestones: newMilestones, milestone: newMilestones[idx], fullyPaid }
}
