import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // nas-media-service 是獨立 Node 套件，用自己的 `cd nas-media-service && npx vitest run`
    // （jose 在 jsdom 環境會壞），不要被這個 Vue 專案的測試掃到
    exclude: [...configDefaults.exclude, 'nas-media-service/**']
  }
})
