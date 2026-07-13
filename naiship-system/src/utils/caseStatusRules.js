export function isMissingSignedAmountForConstruction(newStatus, originalStatus, signedAmount) {
    return newStatus === 'construction' && originalStatus !== 'construction' && !signedAmount
}
