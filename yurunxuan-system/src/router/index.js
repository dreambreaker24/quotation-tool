import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/daily-entry', name: 'daily-entry', component: () => import('@/views/DailyEntryView.vue') },
  { path: '/inventory', name: 'inventory', component: () => import('@/views/InventoryView.vue') },
  {
    path: '/master-data', name: 'master-data', component: () => import('@/views/MasterDataView.vue'),
    meta: { requireOwner: true }
  },
  {
    path: '/monthly-expenses', name: 'monthly-expenses', component: () => import('@/views/MonthlyExpenseView.vue'),
    meta: { requireOwner: true }
  },
  {
    path: '/petty-cash', name: 'petty-cash', component: () => import('@/views/PettyCashView.vue'),
    meta: { requireOwner: true }
  },
  {
    path: '/bonus', name: 'bonus', component: () => import('@/views/BonusView.vue'),
    meta: { requireOwner: true }
  }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.readyPromise
  if (!to.meta.public && !auth.user) return { name: 'login' }
  if (to.meta.requireOwner && !auth.isOwner) return { name: 'home' }
})

export default router
