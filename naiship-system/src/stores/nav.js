import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNavStore = defineStore('nav', () => {
    const pendingJump = ref(null)     // { caseId, caseTab, companyId, workTypeId }
    const pendingPhotoType = ref('')  // photo category key to auto-expand

    function requestCaseJump(caseId, caseTab, companyId, photoType = '', workTypeId = '') {
        pendingPhotoType.value = photoType
        pendingJump.value = { caseId, caseTab, companyId, workTypeId }
    }

    function clearJump() {
        pendingJump.value = null
    }

    function clearPhotoType() {
        pendingPhotoType.value = ''
    }

    return { pendingJump, pendingPhotoType, requestCaseJump, clearJump, clearPhotoType }
})
