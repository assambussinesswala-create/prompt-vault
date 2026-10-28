// One wrapper used by every endpoint, so the security checks cannot be forgotten:
//   1. only listed HTTP methods are allowed
//   2. the caller must be signed in (verified Clerk token)
//   3. the caller is rate limited
//   4. JSON bodies are parsed safely
//   5. errors are turned into safe messages (no stack traces, no secrets, no request bodies)
import { requireUser } from './auth.js'
import { getSql, rateLimit } from './db.js'
import { HttpError } from './errors.js'

function readBody(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return {}
  const type = String((req.headers && req.headers['content-type']) || '')
  if (!type.toLowerCase().includes('application/json')) {
    if (req.method === 'DELETE') return {}
    throw new HttpError(415, 'Requests must be sent as JSON.', 'BAD_REQUEST')
  }
  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
  } catch {
    throw new HttpError(400, 'The request could not be read.', 'BAD_REQUEST')
  }
  if (body === undefined || body === null) return {}
  if (typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'The request could not be read.', 'BAD_REQUEST')
  return body
}

export function sendError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code })
  }
  // Log only the error type and code. Never log messages, bodies or credentials.
  console.error('[api] unexpected error:', err && err.name, err && err.code)
  return res.status(500).json({ error: 'Something went wrong on the server. Please try again.', code: 'SERVER_ERROR' })
}

/**
 * @param {string} name used for rate-limit buckets
 * @param {Record<string, { limit: number, run: (ctx: { userId: string, sql: any, body: any, query: any }) => Promise<{ status?: number, json: any }> }>} routes
 */
export function createHandler(name, routes) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      const route = routes[req.method]
      if (!route) {
        res.setHeader('Allow', Object.keys(routes).join(', '))
        throw new HttpError(405, 'This request type is not allowed here.', 'METHOD_NOT_ALLOWED')
      }
      const userId = await requireUser(req)
      const sql = await getSql()
      await rateLimit(sql, `${userId}:${name}:${req.method}`, route.limit)
      const body = readBody(req)
      const out = await route.run({ userId, sql, body, query: req.query || {} })
      return res.status(out.status || 200).json(out.json)
    } catch (err) {
      return sendError(res, err)
    }
  }
}
