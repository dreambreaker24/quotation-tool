export function getVendorSpecialties(vendor) {
    if (Array.isArray(vendor.specialties) && vendor.specialties.length > 0) return vendor.specialties
    return vendor.specialty ? [vendor.specialty] : []
}

export function filterVendorsByCategory(vendors, category, workCategories) {
    if (!workCategories.includes(category)) return vendors
    const standardCategories = workCategories.filter(c => c !== '其他')
    if (category === '其他') {
        return vendors.filter(v => !getVendorSpecialties(v).some(s => standardCategories.includes(s)))
    }
    return vendors.filter(v => getVendorSpecialties(v).includes(category))
}
