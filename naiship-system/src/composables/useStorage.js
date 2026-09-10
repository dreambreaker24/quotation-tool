const MAX_SIZE = 10 * 1024 * 1024

export function validateUploadFile(file) {
    if (file.size > MAX_SIZE) {
        const mb = (file.size / 1024 / 1024).toFixed(1)
        return `「${file.name}」檔案過大（${mb} MB），單檔限制 10 MB`
    }
    return null
}

export async function uploadPhoto(file, type) {
    const backend = import.meta.env.VITE_STORAGE_BACKEND || 'local'

    if (backend === 'cloudinary') {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
        const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        const form = new FormData()
        form.append('file', file)
        form.append('upload_preset', preset)
        form.append('folder', `naiship/${type}`)
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: form
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
        return data.secure_url
    }

    if (backend === 'local') {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`http://localhost:3001/upload/${type}`, { method: 'POST', body: form })
        if (!res.ok) throw new Error('Upload failed')
        const { url } = await res.json()
        return url
    }

    if (backend === 'nas') {
        const { auth } = await import('@/firebase')
        const user = auth.currentUser
        if (!user) throw new Error('尚未登入，無法上傳檔案')
        const idToken = await user.getIdToken()
        const base = import.meta.env.VITE_NAS_BASE_URL
        const form = new FormData()
        form.append('file', file)
        form.append('type', type)
        const res = await fetch(`${base}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
            body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        return data.url
    }

    throw new Error(`Storage backend "${backend}" not implemented`)
}
