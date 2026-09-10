import { describe, it, expect, beforeAll } from 'vitest'
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose'
import { createVerifier } from '../src/auth.js'

const PROJECT = 'quotation-system-ddc5c'
const ISS = `https://securetoken.google.com/${PROJECT}`
let privateKey, otherPrivateKey, resolver

beforeAll(async () => {
  const kp = await generateKeyPair('RS256')
  privateKey = kp.privateKey
  const jwk = await exportJWK(kp.publicKey)
  jwk.kid = 'test-key'
  jwk.alg = 'RS256'
  // 用本機 JWK set 當解析器，貼近正式的 remote JWK set 行為（依 kid 找 key）
  resolver = createLocalJWKSet({ keys: [jwk] })

  const other = await generateKeyPair('RS256')
  otherPrivateKey = other.privateKey
})

async function makeToken(overrides = {}, opts = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ sub: 'uid-123', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(opts.iss ?? ISS)
    .setAudience(opts.aud ?? PROJECT)
    .setIssuedAt(now)
    .setExpirationTime(opts.exp ?? now + 3600)
    .sign(opts.key ?? privateKey)
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
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

  it('偽造的 alg:none token 丟錯', async () => {
    const verify = createVerifier({ projectId: PROJECT, jwksResolver: resolver })
    const now = Math.floor(Date.now() / 1000)
    const forged = `${b64url({ alg: 'none', typ: 'JWT' })}.`
      + `${b64url({ sub: 'uid-123', iss: ISS, aud: PROJECT, iat: now, exp: now + 3600 })}.`
    await expect(verify(forged)).rejects.toThrow()
  })

  it('用別把金鑰簽的 token 丟錯', async () => {
    const verify = createVerifier({ projectId: PROJECT, jwksResolver: resolver })
    await expect(verify(await makeToken({}, { key: otherPrivateKey }))).rejects.toThrow()
  })
})
