<template>
    <div class="flex-1 p-4 sm:p-6">
        <MonthlyExpenseManager />
    </div>
</template>
<script setup>
import { onMounted, onUnmounted } from 'vue'
import MonthlyExpenseManager from '@/components/monthlyExpense/MonthlyExpenseManager.vue'
import { useMonthlyExpensesStore } from '@/stores/monthlyExpenses'

const store = useMonthlyExpensesStore()
onMounted(() => store.subscribe())
onUnmounted(() => store.cleanup())
</script>
