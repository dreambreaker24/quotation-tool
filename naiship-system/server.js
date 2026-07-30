import express from 'express'
import multer from 'multer'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())

const TYPES = ['survey', '3d', 'construction', 'completion', 'commercial', 'fuel', 'floorplan', 'blueprint', 'vendor_quote', 'reply']

TYPES.forEach(t => fs.mkdirSync(path.join(__dirname, 'uploads', t), { recursive: true }))

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const type = req.params.type
    if (!TYPES.includes(type)) return cb(new Error('invalid type'))
    cb(null, path.join(__dirname, 'uploads', type))
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  }
})

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

app.post('/upload/:type', upload.single('file'), (req, res) => {
  res.json({ url: `/uploads/${req.params.type}/${req.file.filename}` })
})

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.listen(3001, () => console.log('Upload server: http://localhost:3001'))
