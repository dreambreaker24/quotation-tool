import { ref } from 'vue'

const toasts = ref([])
let idCounter = 0

export function useToast() {
    function toast(message, type = 'success', duration = 2500, action = undefined) {
        const id = ++idCounter
        toasts.value.push({ id, message, type, action })
        setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, duration)
    }
    return { toasts, toast }
}
