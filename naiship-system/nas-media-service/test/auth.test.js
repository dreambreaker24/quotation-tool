import { describe, it, expect, beforeAll } from 'vitest'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import { createVerifier } from '../src/auth.js'

const PROJECT = 'quotation-system-ddc5c'
const ISS = `https://securetoken.google.com/${PROJECT}`
let privateKey, publicKey, resolver

beforeAll(async () => {
  const kp = await generateKeyPair('RS256')
  privateKey = kp.privateKey
  publicKey = kp.publicKey
  const jwk = await exportJWK(publicKey)
  jwk.kid = 'test-key'
  jwk.alg = 'RS256'
  // jose jwtVerify 第二參數可為 (header, token) => key 的解析函式
  resolver = async () => publicKey
})

async function makeToken(overrides = {}, opts = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ sub: 'uid-123', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(opts.iss ?? ISS)
    .setAudience(opts.aud ?? PROJECT)
    .setIssuedAt(now)
    .setExpirationTime(opts.exp ?? now + 3600)
    .sign(privateKey)
}

describe('createVerifier', () => {
  it('有效 token 通過並回 payload', async () => {
    const verify = createVerifier({ projectId: PROJECT, jwksResolver: resolver })
    const payload = await verify(await makeToken())
    expect(payload.sub).toBe('uid-123')
  })

  it('過期 token 丟錯', async () => {
    const verify = createVerifier({ projectId: PROJECT, jwksResolver: resolver })
    const now = Math.floor(Date.now() / 1000)
    await expect(verify(await makeToken({}, { exp: now - 10 }))).rejects.toThrow()
  })

  it('aud 不對丟錯', async () => {
    const verify = createVerifier({ projectId: PROJECT, jwksResolver: resolver })
    await expect(verify(await makeToken({}, { aud: 'someone-else' }))).rejects.toThrow()
  })

  it('iss 不對丟錯', async () => {
    const verify = createVerifier({ projectId: PROJECT, jwksResolver: resolver })
    await expect(verify(await makeToken({}, { iss: 'https://evil.example' }))).rejects.toThrow()
  })

  it('缺 sub 丟錯', async () => {
    const verify = createVerifier({ projectId: PROJECT, jwksResolver: resolver })
    const now = Math.floor(Date.now() / 1000)
    const bad = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISS).setAudience(PROJECT).setIssuedAt(now).setExpirationTime(now + 3600)
      .sign(privateKey)
    await expect(verify(bad)).rejects.toThrow(/sub/)
  })

  it('亂七八糟的字串丟錯', async () => {
    const verify = createVerifier({ projectId: PROJECT, jwksResolver: resolver })
    await expect(verify('not-a-jwt')).rejects.toThrow()
  })
})
