// 記一筆針對「單一收款期款」的收款——首頁儀表板的「待請款」快速完成，跟案件詳情
// PaymentMilestones.vue 的完整編輯表單（可以同時改名稱/金額/到期日）是不同操作，
// 這裡只處理「記錄收到多少錢、哪天收的」這一件事，其餘欄位維持不變。
export function applyMilestonePayment(milestones, milestoneId, { paidAmount, paidDate }) {
    const idx = milestones.findIndex(m => m.id === milestoneId)
    if (idx === -1) return null
    const newMilestones = [...milestones]
    newMilestones[idx] = { ...milestones[idx], paidAmount, paidDate }
    const fullyPaid = paidAmount >= (newMilestones[idx].amount || 0) && (newMilestones[idx].amount || 0) > 0
    return { milestones: newMilestones, milestone: newMilestones[idx], fullyPaid }
}
