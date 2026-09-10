import { randomBytes } from 'node:crypto'
import { ALLOWED_EXT } from './config.js'

const CT_MAP = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
}

export function extFromName(name) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(String(name || ''))
  return m ? m[1].toLowerCase() : ''
}

export function extFromUrl(url) {
  try {
    const p = new URL(url).pathname
    return extFromName(p)
  } catch {
    return ''
  }
}

export function extFromContentType(ct) {
  const key = String(ct || '').split(';')[0].trim().toLowerCase()
  return CT_MAP[key] || ''
}

export function generateFilename(originalName, now = new Date()) {
  const ext = extFromName(originalName)
  if (!ALLOWED_EXT.has(ext)) {
    const err = new Error(`不支援的副檔名：${ext || '(無)'}`)
    err.code = 'BAD_EXT'
    throw err
  }
  const d = new Date(now).toISOString().slice(0, 10).replace(/-/g, '')
  return `${d}-${randomBytes(4).toString('hex')}.${ext}`
}
