export function formatCaseAddress(caseData) {
    const parts = [caseData.addressCity, caseData.addressDistrict, caseData.addressStreet].filter(Boolean)
    if (parts.length) return parts.join('')
    return caseData.address || ''
}
