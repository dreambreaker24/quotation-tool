import { loadConfig } from './config.js'
import { createApp } from './server.js'
import { createVerifier, remoteJwksResolver } from './auth.js'

const config = loadConfig()
const verify = createVerifier({
  projectId: config.projectId,
  jwksResolver: remoteJwksResolver(),
})

createApp(config, verify).listen(config.port, () => {
  console.log(`nas-media-service listening on :${config.port}`)
})
