// /api/passwords — GET list, POST create, PUT ?id= update, DELETE ?id= delete
//
// The list NEVER includes passwords or notes (not even encrypted). They are only
// returned by /api/reveal, one value at a time, when the signed-in owner asks.
import { createHandler } from './_lib/http.js'
import { HttpError } from './_lib/errors.js'
import { aadFor, encryptSecret, loadKey } from './_lib/crypto.js'
import { LIMITS, email, password, requireId, text, url } from './_lib/validate.js'
import { randomUUID } from 'node:crypto'

const notFound = () => new HttpError(404, 'That password entry was not found.', 'NOT_FOUND')

function readFields(body) {
  return {
    siteName: text(body, 'siteName', 'Website name', LIMITS.siteName, { required: true }),
    siteUrl: url(body, 'siteUrl', 'Website URL'),
    username: text(body, 'username', 'Username', LIMITS.username),
    email: email(body, 'email'),
  }
}

export default createHandler('passwords', {
  GET: {
    limit: 240,
    async run({ userId, sql }) {
      const rows = await sql`
        SELECT id, site_name AS "siteName", site_url AS "siteUrl", username, email,
               (notes_enc IS NOT NULL) AS "hasNotes",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM password_entries WHERE user_id = ${userId}
        ORDER BY created_at DESC LIMIT 10000`
      return { json: { entries: rows } }
    },
  },
  POST: {
    limit: 60,
    async run({ userId, sql, body }) {
      const f = readFields(body)
      const pw = password(body, 'password', { required: true })
      const notes = text(body, 'notes', 'Notes', LIMITS.notes)
      const key = loadKey() // fails safely (500 + clear message) if the key is missing or wrong
      const id = randomUUID()
      const passwordEnc = encryptSecret(pw, aadFor(userId, id, 'password'), key)
      const notesEnc = notes ? encryptSecret(notes, aadFor(userId, id, 'notes'), key) : null
      const rows = await sql`
        INSERT INTO password_entries (id, user_id, site_name, site_url, username, email, password_enc, notes_enc)
        VALUES (${id}, ${userId}, ${f.siteName}, ${f.siteUrl}, ${f.username}, ${f.email}, ${passwordEnc}, ${notesEnc})
        RETURNING id, site_name AS "siteName", site_url AS "siteUrl", username, email,
                  (notes_enc IS NOT NULL) AS "hasNotes",
                  created_at AS "createdAt", updated_at AS "updatedAt"`
      return { status: 201, json: { entry: rows[0] } }
    },
  },
  PUT: {
    limit: 60,
    async run({ userId, sql, body, query }) {
      const id = requireId(query.id)
      const f = readFields(body)
      const pw = password(body, 'password', { required: false }) // empty = keep the current password
      const key = loadKey()
      const passwordEnc = pw === null ? null : encryptSecret(pw, aadFor(userId, id, 'password'), key)

      // notes: omitted = keep, "" = remove, text = replace
      let notesMode = 'keep'
      let notesEnc = null
      if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
        const notes = text(body, 'notes', 'Notes', LIMITS.notes)
        notesMode = notes ? 'set' : 'clear'
        notesEnc = notes ? encryptSecret(notes, aadFor(userId, id, 'notes'), key) : null
      }

      const rows = await sql`
        UPDATE password_entries
        SET site_name = ${f.siteName}, site_url = ${f.siteUrl}, username = ${f.username}, email = ${f.email},
            password_enc = COALESCE(${passwordEnc}::text, password_enc),
            notes_enc = CASE WHEN ${notesMode}::text = 'keep' THEN notes_enc
                             WHEN ${notesMode}::text = 'clear' THEN NULL
                             ELSE ${notesEnc}::text END,
            updated_at = now()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id, site_name AS "siteName", site_url AS "siteUrl", username, email,
                  (notes_enc IS NOT NULL) AS "hasNotes",
                  created_at AS "createdAt", updated_at AS "updatedAt"`
      if (!rows.length) throw notFound()
      return { json: { entry: rows[0] } }
    },
  },
  DELETE: {
    limit: 60,
    async run({ userId, sql, query }) {
      const id = requireId(query.id)
      const rows = await sql`DELETE FROM password_entries WHERE id = ${id} AND user_id = ${userId} RETURNING id`
      if (!rows.length) throw notFound()
      return { json: { ok: true } }
    },
  },
})
