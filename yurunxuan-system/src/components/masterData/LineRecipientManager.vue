<template>
    <div class="bg-white rounded-2xl shadow-md p-5">
        <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2" style="border-left-color:#d98fa0">LINE 通知設定</h2>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ store.recipients.length }} 位</span>
        </div>
        <div v-if="store.recipients.length === 0" class="text-sm text-gray-400 text-center py-8">
            尚無收件人，請先讓對方把鈺潤軒 LINE 官方帳號加為好友
        </div>
        <div v-else class="flex flex-col gap-2">
            <div v-for="r in store.recipients" :key="r.id" class="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50">
                <div class="flex items-center gap-2 mb-2">
                    <input v-model="draftNames[r.id]" @change="updateName(r.id, draftNames[r.id])"
                        class="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1">
                    <button @click="confirmDelete(r)" class="text-red-400 hover:text-red-600 text-xs">刪除</button>
                </div>
                <div class="flex gap-4 text-xs text-gray-600">
                    <label class="flex items-center gap-1.5">
                        <input type="checkbox" :checked="r.notifyLowStock" @change="toggle(r.id, 'notifyLowStock', $event.target.checked)">
                        補貨提醒
                    </label>
                    <label class="flex items-center gap-1.5">
                        <input type="checkbox" :checked="r.notifyDailySummary" @change="toggle(r.id, 'notifyDailySummary', $event.target.checked)">
                        每日摘要
                    </label>
                    <label class="flex items-center gap-1.5">
                        <input type="checkbox" :checked="r.notifyLowPettyCash" @change="toggle(r.id, 'notifyLowPettyCash', $event.target.checked)">
                        零用金提醒
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { reactive, watch } from 'vue'
import { useLineRecipientsStore } from '@/stores/lineRecipients'
import { useToast } from '@/composables/useToast'

const store = useLineRecipientsStore()
const { toast } = useToast()

// Local draft copy of names, decoupled from the live store array so that an
// unrelated Firestore snapshot (e.g. someone else toggling a checkbox) can't
// reset an in-progress edit. Seeded lazily and only once per id — never
// overwritten once present, so it survives every later re-render.
const draftNames = reactive({})
watch(() => store.recipients, (list) => {
    for (const r of list) {
        if (!(r.id in draftNames)) draftNames[r.id] = r.name
    }
}, { immediate: true })

async function updateName(id, name) {
    if (!name) {
        toast('名稱不能是空的', 'error')
        return
    }
    try {
        await store.updateRecipient(id, { name })
        toast('已更新')
    } catch (e) {
        console.warn('更新名稱失敗:', e)
        toast('更新失敗，請重試', 'error')
    }
}

async function toggle(id, field, value) {
    try {
        await store.updateRecipient(id, { [field]: value })
    } catch (e) {
        console.warn('更新通知設定失敗:', e)
        toast('更新失敗，請重試', 'error')
    }
}

async function confirmDelete(r) {
    if (!confirm(`確定要刪除「${r.name}」這位收件人？`)) return
    try {
        await store.deleteRecipient(r.id)
        toast('已刪除')
    } catch (e) {
        console.warn('刪除失敗:', e)
        toast('刪除失敗，請重試', 'error')
    }
}
</script>
