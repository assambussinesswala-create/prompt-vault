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

// Makes an error message safe to put in server logs: removes anything that looks like a
// connection string / URL, a Neon host, a Clerk key, a token or a password, then shortens it.
function safeText(value, max = 200) {
  return String(value == null ? '' : value)
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, '[url]') // connection strings and URLs
    .replace(/\b[\w.-]+\.neon\.tech\b/gi, '[host]') // Neon host names
    .replace(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+/g, '[key]') // Clerk keys
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]') // JWT tokens
    .replace(/Bearer\s+\S+/gi, 'Bearer [token]')
    .replace(/password\s*[=:]\s*\S+/gi, 'password=[hidden]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function sendError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code })
  }
  // Diagnostic log: only fixed, sanitized fields. Never the whole error object, request,
  // headers, body, token or credentials. (err.detail is deliberately NOT logged: it can hold row values.)
  console.error('[api] unexpected error:', JSON.stringify({
    name: safeText(err && err.name, 60),
    code: safeText(err && err.code, 20), // PostgreSQL error code, e.g. 42P01, when the database reports one
    message: safeText(err && err.message),
    cause: safeText(err && err.sourceError && err.sourceError.message), // set by the Neon driver on connection failures
  }))
  // The browser always gets the same generic message.
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