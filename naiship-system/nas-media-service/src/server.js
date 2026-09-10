import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ALLOWED_TYPES } from './config.js'
import { generateFilename } from './filename.js'

export function createApp(config, verifyIdToken) {
  const app = express()

  // health：所有來源開放
  app.get('/media/health', cors(), (req, res) => res.json({ ok: true }))

  // 靜態供檔（GET/HEAD），inline 顯示、長快取
  app.use('/media', express.static(config.mediaRoot, {
    maxAge: '30d',
    index: false,
    setHeaders(res) { res.setHeader('Content-Disposition', 'inline') },
  }))

  // 上傳：CORS 限白名單
  const uploadCors = cors({
    origin(origin, cb) {
      if (!origin || config.allowedOrigins.includes(origin)) cb(null, true)
      else cb(null, false)
    },
  })
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFileBytes },
  })

  app.post('/media/upload', uploadCors, (req, res) => {
    upload.single('file')(req, res, async (err) => {
      if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '檔案過大' })
      if (err) return res.status(400).json({ error: '上傳解析失敗' })
      try {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        if (!token) return res.status(401).json({ error: '未帶憑證' })
        try { await verifyIdToken(token) } catch { return res.status(401).json({ error: '憑證無效' }) }

        const type = req.body.type
        if (!ALLOWED_TYPES.has(type)) return res.status(400).json({ error: `不允許的類別：${type}` })
        if (!req.file) return res.status(400).json({ error: '缺少檔案' })

        let filename
        try { filename = generateFilename(req.file.originalname) }
        catch (e) { return res.status(400).json({ error: e.message }) }

        const dir = join(config.mediaRoot, 'naiship', type)
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, filename), req.file.buffer)

        res.json({ url: `${config.publicBaseUrl}/naiship/${type}/${filename}` })
      } catch {
        res.status(500).json({ error: '伺服器錯誤' })
      }
    })
  })

  return app
}
