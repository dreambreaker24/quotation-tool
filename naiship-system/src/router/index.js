import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
  { path: '/cases', name: 'cases', component: () => import('@/views/CasesView.vue') },
  { path: '/clients', name: 'clients', component: () => import('@/views/ClientsView.vue') },
  {
    path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'),
    meta: { requireAdmin: true }
  }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.user) return { name: 'login' }
  if (to.meta.requireAdmin && !auth.isAdmin) return { name: 'dashboard' }
})

export default router
