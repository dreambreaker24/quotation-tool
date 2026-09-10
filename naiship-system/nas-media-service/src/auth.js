import { jwtVerify, createRemoteJWKSet } from 'jose'

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

export function remoteJwksResolver() {
  return createRemoteJWKSet(new URL(FIREBASE_JWKS_URL))
}

export function createVerifier({ projectId, jwksResolver }) {
  const issuer = `https://securetoken.google.com/${projectId}`
  return async function verifyIdToken(token) {
    const { payload } = await jwtVerify(token, jwksResolver, {
      issuer,
      audience: projectId,
      algorithms: ['RS256'],
    })
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('token 缺少 sub')
    return payload
  }
}
