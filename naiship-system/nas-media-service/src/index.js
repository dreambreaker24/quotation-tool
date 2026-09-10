import { loadConfig } from './config.js'
import { createApp } from './server.js'
import { createVerifier, remoteJwksResolver } from './auth.js'

process.on('unhandledRejection', e => console.error('unhandledRejection', e))
process.on('uncaughtException', e => { console.error('uncaughtException', e); process.exit(1) })

const config = loadConfig()
const verify = createVerifier({
  projectId: config.projectId,
  jwksResolver: remoteJwksResolver(),
})

const server = createApp(config, verify).listen(config.port, () => {
  console.log(`nas-media-service listening on :${config.port}`)
})

process.on('SIGTERM', () => server.close(() => process.exit(0)))
