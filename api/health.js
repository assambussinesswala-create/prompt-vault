// GET /api/health — setup check. Public, but it only says "ok", "missing" or "invalid".
// It never returns secret values.
import { loadKey } from './_lib/crypto.js'
import { getSql } from './_lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })
  const checks = {}
  try {
    loadKey()
    checks.encryptionKey = 'ok'
  } catch (e) {
    checks.encryptionKey = e && e.code === 'KEY_MISSING' ? 'missing' : 'invalid'
  }
  checks.clerkSecretKey = process.env.CLERK_SECRET_KEY ? 'ok' : 'missing'
  if (!process.env.DATABASE_URL) {
    checks.database = 'missing'
  } else {
    try {
      const sql = await getSql()
      await sql`SELECT 1 FROM links LIMIT 1`
      await sql`SELECT 1 FROM password_entries LIMIT 1`
      checks.database = 'ok'
    } catch {
      checks.database = 'error (check DATABASE_URL and that db/schema.sql was run)'
    }
  }
  const ok = Object.values(checks).every((v) => v === 'ok')
  return res.status(ok ? 200 : 503).json({ ok, checks })
}
