// POST /api/reveal  { id, field: "password" | "notes" }
// Decrypts ONE value for its owner. Used by the eye button, the copy-password button
// and the notes viewer. Rate limited and never cached or logged.
import { createHandler } from './_lib/http.js'
import { HttpError } from './_lib/errors.js'
import { aadFor, decryptSecret, loadKey } from './_lib/crypto.js'
import { requireId } from './_lib/validate.js'

export default createHandler('reveal', {
  POST: {
    limit: 30,
    async run({ userId, sql, body }) {
      const id = requireId(body.id)
      const field = body.field
      if (field !== 'password' && field !== 'notes') throw new HttpError(400, 'Unknown field.', 'VALIDATION')
      const rows = await sql`
        SELECT password_enc, notes_enc FROM password_entries
        WHERE id = ${id} AND user_id = ${userId}`
      if (!rows.length) throw new HttpError(404, 'That password entry was not found.', 'NOT_FOUND')
      const stored = field === 'password' ? rows[0].password_enc : rows[0].notes_enc
      if (!stored) return { json: { value: '' } }
      const value = decryptSecret(stored, aadFor(userId, id, field), loadKey())
      return { json: { value } }
    },
  },
})
