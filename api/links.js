// /api/links  — GET list, POST create, PUT ?id= update, DELETE ?id= delete
// Every query is limited to the signed-in user with "user_id = ${userId}".
import { createHandler } from './_lib/http.js'
import { HttpError } from './_lib/errors.js'
import { LIMITS, requireId, text, url } from './_lib/validate.js'
import { randomUUID } from 'node:crypto'

const notFound = () => new HttpError(404, 'That link was not found.', 'NOT_FOUND')

export default createHandler('links', {
  GET: {
    limit: 240,
    async run({ userId, sql }) {
      const rows = await sql`
        SELECT id, title, url, description, category,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM links WHERE user_id = ${userId}
        ORDER BY created_at DESC LIMIT 10000`
      return { json: { links: rows } }
    },
  },
  POST: {
    limit: 60,
    async run({ userId, sql, body }) {
      const title = text(body, 'title', 'Title', LIMITS.title, { required: true })
      const link = url(body, 'url', 'Website URL')
      const description = text(body, 'description', 'Description', LIMITS.description)
      const category = text(body, 'category', 'Category', LIMITS.category)
      const rows = await sql`
        INSERT INTO links (id, user_id, title, url, description, category)
        VALUES (${randomUUID()}, ${userId}, ${title}, ${link}, ${description}, ${category})
        RETURNING id, title, url, description, category,
                  created_at AS "createdAt", updated_at AS "updatedAt"`
      return { status: 201, json: { link: rows[0] } }
    },
  },
  PUT: {
    limit: 60,
    async run({ userId, sql, body, query }) {
      const id = requireId(query.id)
      const title = text(body, 'title', 'Title', LIMITS.title, { required: true })
      const link = url(body, 'url', 'Website URL')
      const description = text(body, 'description', 'Description', LIMITS.description)
      const category = text(body, 'category', 'Category', LIMITS.category)
      const rows = await sql`
        UPDATE links
        SET title = ${title}, url = ${link}, description = ${description}, category = ${category}, updated_at = now()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id, title, url, description, category,
                  created_at AS "createdAt", updated_at AS "updatedAt"`
      if (!rows.length) throw notFound()
      return { json: { link: rows[0] } }
    },
  },
  DELETE: {
    limit: 60,
    async run({ userId, sql, query }) {
      const id = requireId(query.id)
      const rows = await sql`DELETE FROM links WHERE id = ${id} AND user_id = ${userId} RETURNING id`
      if (!rows.length) throw notFound()
      return { json: { ok: true } }
    },
  },
})
