// Verifies the Clerk session token sent by the browser and returns the user's id.
// The user id always comes from the verified token, NEVER from the request body or URL.
import { HttpError } from './errors.js'

let override = null
/** Tests only: replace the token check. */
export function setAuthForTests(fn) {
  override = fn
}

export async function requireUser(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization)
  const match = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null
  if (!match) throw new HttpError(401, 'Please sign in to continue.', 'UNAUTHENTICATED')
  if (override) return override(match[1])

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new HttpError(500, 'Server setup needed: the CLERK_SECRET_KEY environment variable is missing.', 'AUTH_NOT_CONFIGURED')

  let result
  try {
    const { verifyToken } = await import('@clerk/backend')
    result = await verifyToken(match[1], { secretKey })
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED')
  }
  // @clerk/backend v1 returns the payload; v2 returns { data, errors }. Accept both.
  const payload = result && typeof result === 'object' && 'data' in result ? result.data : result
  const failed = result && typeof result === 'object' && Array.isArray(result.errors) && result.errors.length > 0
  const userId = payload && payload.sub
  if (failed || typeof userId !== 'string' || !userId) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED')
  }
  return userId
}
