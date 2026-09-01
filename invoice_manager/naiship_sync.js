// invoice_manager/naiship_sync.js
function mergeCaseNames(naishipNames, existingNames) {
    const result = [...naishipNames];
    for (const name of existingNames) {
        if (!result.includes(name)) result.push(name);
    }
    return result;
}

module.exports = { mergeCaseNames };
