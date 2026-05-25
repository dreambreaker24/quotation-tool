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

    throw new Error(`Storage backend "${backend}" not implemented`)
}
