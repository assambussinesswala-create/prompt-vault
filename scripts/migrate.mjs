// Creates the database tables from db/schema.sql.
// Usage:  DATABASE_URL="postgres://..." npm run db:migrate
// (Or paste db/schema.sql into the Neon "SQL Editor". Both do the same thing.)
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. See README, section "Database setup".')
  process.exit(1)
}
const sql = neon(url)
const run = typeof sql.query === 'function' ? (q) => sql.query(q) : (q) => sql(q)
const statements = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
for (const s of statements) {
  await run(s)
}
console.log(`Done. ${statements.length} statements applied.`)
