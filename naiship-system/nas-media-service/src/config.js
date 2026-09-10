export const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'mp4', 'mov'])

// 對應現有 Cloudinary 資料夾 / useStorage 的 type 參數 / server.js 的 TYPES
export const ALLOWED_TYPES = new Set([
  'survey', 'contract', '3d', 'construction', 'completion', 'commercial', 'floorplan', 'blueprint',
  'vendor_quote', 'invoice', 'wt_construction', 'bid_quote',
  'reply', 'log', 'fuel', 'task', 'review', 'announcement',
  'progress-notes', 'dashboard-notes', 'petty-cash',
])

function req(env, key) {
  const v = env[key]
  if (!v) throw new Error(`缺少必要環境變數：${key}`)
  return v
}

export function loadConfig(env = process.env) {
  return {
    projectId: req(env, 'FIREBASE_PROJECT_ID'),
    mediaRoot: req(env, 'MEDIA_ROOT'),
    publicBaseUrl: req(env, 'PUBLIC_BASE_URL').replace(/\/$/, ''),
    allowedOrigins: (env.ALLOWED_ORIGINS || '')
      .split(',').map(s => s.trim()).filter(Boolean),
    port: Number(env.PORT || 3001),
    maxFileBytes: Number(env.MAX_FILE_MB || 50) * 1024 * 1024,
  }
}
