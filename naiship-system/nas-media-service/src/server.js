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

  // 靜態供檔（GET/HEAD），只開放 naiship 子樹、inline 顯示、長快取
  app.use('/media/naiship', express.static(join(config.mediaRoot, 'naiship'), {
    maxAge: '30d',
    index: false,
    dotfiles: 'deny',
    setHeaders(res) {
      res.setHeader('Content-Disposition', 'inline')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    },
  }))

  // 上傳：CORS 限白名單
  const uploadCors = cors({
    origin(origin, cb) {
      if (!origin || config.allowedOrigins.includes(origin)) cb(null, true)
      else cb(null, false)
    },
  })
  // NOTE: reverse proxy should cap body size + connections
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFileBytes },
  })

  app.post('/media/upload', uploadCors, (req, res) => {
    upload.single('file')(req, res, async (err) => {
      if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '檔案過大' })
      if (err) return res.status(400).json({ error: '上傳解析失敗' })
      try {
        const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')
        const token = m ? m[1].trim() : ''
        if (!token) return res.status(401).json({ error: '未帶憑證' })
        let claims
        try { claims = await verifyIdToken(token) } catch { return res.status(401).json({ error: '憑證無效' }) }

        const type = req.body.type
        if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
          return res.status(400).json({ error: '不允許的類別' })
        }
        if (!req.file) return res.status(400).json({ error: '缺少檔案' })

        const dir = join(config.mediaRoot, 'naiship', type)
        await mkdir(dir, { recursive: true })

        let saved = null
        for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
          let candidate
          try { candidate = generateFilename(req.file.originalname) }
          catch (e) {
            console.warn('generateFilename 失敗', e)
            return res.status(400).json({ error: '不支援的檔案格式' })
          }
          try {
            await writeFile(join(dir, candidate), req.file.buffer, { flag: 'wx' })
            saved = candidate
          } catch (e) {
            if (e.code === 'EEXIST') continue
            throw e
          }
        }
        if (!saved) return res.status(500).json({ error: '伺服器錯誤' })

        console.log(JSON.stringify({ evt: 'upload', uid: claims.sub, type, filename: saved }))
        res.json({ url: `${config.publicBaseUrl}/naiship/${type}/${saved}` })
      } catch (e) {
        console.error('upload 失敗', e)
        res.status(500).json({ error: '伺服器錯誤' })
      }
    })
  })

  return app
}
