export function isLegacyCategoryName(selectedCategory, formName, categories) {
    return !selectedCategory && !!formName && !categories.includes(formName)
}
