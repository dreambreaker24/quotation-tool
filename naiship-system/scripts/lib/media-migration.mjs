export const CLOUDINARY_HOST = 'res.cloudinary.com'
export const NAS_HOST = 'nextdesign.myqnapcloud.com'

export function urlKind(url) {
  if (typeof url !== 'string' || !url.startsWith('http')) return 'other'
  try {
    const h = new URL(url).host
    if (h === CLOUDINARY_HOST) return 'cloudinary'
    if (h === NAS_HOST) return 'nas'
  } catch { /* ignore */ }
  return 'other'
}

export function replaceInStringArray(arr, oldUrl, newUrl) {
  return arr.map(v => (v === oldUrl ? newUrl : v))
}

export function replaceInObjectArray(arr, key, oldUrl, newUrl) {
  return arr.map(o => (o && o[key] === oldUrl ? { ...o, [key]: newUrl } : o))
}

const CT_MAP = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
}

export function deriveExt(url, contentType) {
  try {
    const m = /\.([a-zA-Z0-9]+)$/.exec(new URL(url).pathname)
    if (m) return m[1].toLowerCase()
  } catch { /* ignore */ }
  const key = String(contentType || '').split(';')[0].trim().toLowerCase()
  return CT_MAP[key] || 'jpg'
}
