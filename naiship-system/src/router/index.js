import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { requireManager: true } },
  { path: '/cases', name: 'cases', component: () => import('@/views/CasesView.vue') },
  { path: '/clients', name: 'clients', component: () => import('@/views/ClientsView.vue') },
  { path: '/petty-cash', name: 'petty-cash', component: () => import('@/views/PettyCashView.vue') },
  {
    path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'),
    meta: { requireAdmin: true }
  },
  {
    path: '/payslip', name: 'payslip', component: () => import('@/views/PayslipView.vue'),
    meta: { requireAdmin: true }
  },
  {
    path: '/bonus', name: 'bonus', component: () => import('@/views/BonusView.vue'),
    meta: { requireAdmin: true }
  },
  // 開發用測試頁：不加進導覽列，只能直接打網址進來（報價系統 Vue 改寫 subproject 1 task 5）
  { path: '/quotation-preview-dev', name: 'quotation-preview-dev', component: () => import('@/views/QuotationPreviewDevView.vue') }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.readyPromise
  if (!to.meta.public && !auth.user) return { name: 'login' }
  if (to.meta.requireManager && !auth.isManager) return { name: 'cases' }
  if (to.meta.requireAdmin && !auth.isAdmin) return { name: 'cases' }
})

export default router
