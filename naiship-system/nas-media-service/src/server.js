import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { randomBytes } from 'node:crypto'
import { mkdir, link, unlink } from 'node:fs/promises'
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
  // 大檔案（影片可到 500MB）不整包塞進記憶體，先落地到暫存資料夾。
  // 解析/大小超限錯誤（err 分支）不用 respond() 清——那種情況 req.file 是 undefined，
  // multer 自己就會在丟錯前把它寫到一半的暫存檔清掉；respond() 真正要清的是「我們自己驗證
  // 失敗、但檔案已經成功寫進暫存資料夾」的情況，且一定排在送出回應之前（順序很重要，見下方
  // respond 定義旁的說明）。
  // 已知邊角案例（接受不處理）：如果程序在 link() 成功之後、respond() 的 unlink() 執行之前當掉，
  // 暫存檔會永久孤兒化在 .uploading 底下——這台是低流量內部工具，機率極低，先不建立額外的清理機制。
  const uploadTmpDir = join(config.mediaRoot, '.uploading')
  const upload = multer({
    storage: multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await mkdir(uploadTmpDir, { recursive: true })
          cb(null, uploadTmpDir)
        } catch (e) { cb(e) }
      },
      filename: (req, file, cb) => cb(null, `${randomBytes(8).toString('hex')}.tmp`),
    }),
    limits: { fileSize: config.maxFileBytes },
  })

  // Express 的路由比對不會把 OPTIONS 導進上面的 POST-only 處理器，
  // 沒有這行預檢請求會被內建的預設 OPTIONS 處理器攔走、缺 CORS 標頭，
  // 瀏覽器會擋下真正的 POST。
  app.options('/media/upload', uploadCors)
  app.post('/media/upload', uploadCors, (req, res) => {
    upload.single('file')(req, res, async (err) => {
      // 暫存檔清理一定要排在「送出回應」之前，而不是送完回應才在背景清——
      // 兩者若順序反過來，socket 寫出通常比 fs.unlink() 的 threadpool 往返快，
      // 呼叫端可能在暫存檔真的被刪掉之前就已經收到回應。
      const respond = async (status, body) => {
        if (req.file?.path) {
          try { await unlink(req.file.path) }
          catch (e) { if (e.code !== 'ENOENT') console.warn('暫存檔清理失敗', e) }
        }
        res.status(status).json(body)
      }
      try {
        if (err && err.code === 'LIMIT_FILE_SIZE') return await respond(413, { error: '檔案過大' })
        if (err) return await respond(400, { error: '上傳解析失敗' })

        const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')
        const token = m ? m[1].trim() : ''
        if (!token) return await respond(401, { error: '未帶憑證' })
        let claims
        try { claims = await verifyIdToken(token) } catch { return await respond(401, { error: '憑證無效' }) }

        const type = req.body.type
        if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
          return await respond(400, { error: '不允許的類別' })
        }
        if (!req.file) return await respond(400, { error: '缺少檔案' })

        const dir = join(config.mediaRoot, 'naiship', type)
        await mkdir(dir, { recursive: true })

        let saved = null
        for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
          let candidate
          try { candidate = generateFilename(req.file.originalname) }
          catch (e) {
            console.warn('generateFilename 失敗', e)
            return await respond(400, { error: '不支援的檔案格式' })
          }
          try {
            await link(req.file.path, join(dir, candidate))
            saved = candidate
          } catch (e) {
            if (e.code === 'EEXIST') continue
            throw e
          }
        }
        if (!saved) return await respond(500, { error: '伺服器錯誤' })

        console.log(JSON.stringify({ evt: 'upload', uid: claims.sub, type, filename: saved }))
        await respond(200, { url: `${config.publicBaseUrl}/naiship/${type}/${saved}` })
      } catch (e) {
        console.error('upload 失敗', e)
        await respond(500, { error: '伺服器錯誤' })
      }
    })
  })

  return app
}
