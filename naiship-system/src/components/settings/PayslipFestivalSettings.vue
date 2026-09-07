<template>
  <div class="bg-white rounded-2xl shadow-md p-6 mt-5">
    <h2 class="text-sm font-semibold text-gray-700 pl-3 border-l-2 mb-4" style="border-left-color:#c9a96e">薪資單節慶日期（{{ year }} 年）</h2>
    <p class="text-xs text-gray-400 mb-4">端午、中秋是農曆節日，國曆日期每年不同，請每年年初填一次今年的實際日期。薪資單會依這裡的日期自動判斷該在哪個月發放節慶禮金。</p>
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div>
        <label class="text-xs text-gray-500 mb-1 block">端午節（國曆）</label>
        <input v-model="form.dragonBoat" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>
      <div>
        <label class="text-xs text-gray-500 mb-1 block">中秋節（國曆）</label>
        <input v-model="form.midAutumn" type="date" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1">
      </div>
    </div>
    <button @click="save" :disabled="saving" class="text-xs text-white px-4 py-2 rounded-lg" style="background:#1e2533">
      {{ saving ? '儲存中…' : '儲存' }}
    </button>
    <span v-if="saved" class="text-xs text-green-600 ml-3">已儲存</span>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const year = new Date().getFullYear()
const form = ref({ dragonBoat: '', midAutumn: '' })
const saving = ref(false)
const saved = ref(false)

onMounted(async () => {
    const snap = await getDoc(doc(db, 'settings', 'payslipFestivals'))
    const data = snap.exists() ? snap.data() : {}
    const yearData = data[year] || {}
    form.value = { dragonBoat: yearData.dragonBoat || '', midAutumn: yearData.midAutumn || '' }
})

async function save() {
    saving.value = true
    saved.value = false
    try {
        const snap = await getDoc(doc(db, 'settings', 'payslipFestivals'))
        const existing = snap.exists() ? snap.data() : {}
        existing[year] = { dragonBoat: form.value.dragonBoat, midAutumn: form.value.midAutumn }
        await setDoc(doc(db, 'settings', 'payslipFestivals'), existing)
        saved.value = true
    } finally {
        saving.value = false
    }
}
</script>
