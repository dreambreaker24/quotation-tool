export async function uploadPhoto(file, type) {
    const backend = import.meta.env.VITE_STORAGE_BACKEND || 'local'
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
