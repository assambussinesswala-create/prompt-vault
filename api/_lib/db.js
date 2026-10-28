// Database access (Neon serverless Postgres). Every query uses parameters
// (tagged templates), so user input can never change the SQL itself.
import { HttpError } from './errors.js'

let sql = null
export function setSqlForTests(fake) {
  sql = fake
}

export async function getSql() {
  if (sql) return sql
  const url = process.env.DATABASE_URL
  if (!url) throw new HttpError(500, 'Server setup needed: the DATABASE_URL environment variable is missing.', 'DB_NOT_CONFIGURED')
  const { neon } = await import('@neondatabase/serverless')
  sql = neon(url)
  return sql
}

/**
 * Simple fixed-window rate limit stored in Postgres (works across serverless instances).
 * Throws a 429 error when the limit is exceeded.
 */
export async function rateLimit(db, key, limit, windowSeconds = 60) {
  const nowMs = Date.now()
  const windowStart = new Date(Math.floor(nowMs / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString()
  const rows = await db`
    INSERT INTO rate_limits (key, window_start, hits)
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
    RETURNING hits`
  if (Math.random() < 0.01) {
    // Occasional cleanup of old windows. Failure here is harmless.
    db`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`.catch(() => {})
  }
  if (rows[0] && Number(rows[0].hits) > limit) {
    throw new HttpError(429, 'Too many requests. Please wait a minute and try again.', 'RATE_LIMITED')
  }
}
