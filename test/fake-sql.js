// In-memory stand-in for the Postgres tagged-template function, for tests only.
// It understands exactly the queries used by api/*.js. It checks handler logic
// (ownership, encryption, validation) but NOT real SQL syntax.
export function createFakeSql() {
  const links = []
  const passwords = []
  const hits = new Map()
  const now = () => new Date().toISOString()
  const meta = (r) => ({ id: r.id, siteName: r.site_name, siteUrl: r.site_url, username: r.username, email: r.email, hasNotes: r.notes_enc !== null, createdAt: r.created_at, updatedAt: r.updated_at })
  const linkOut = (r) => ({ id: r.id, title: r.title, url: r.url, description: r.description, category: r.category, createdAt: r.created_at, updatedAt: r.updated_at })

  async function sql(strings, ...v) {
    const q = strings.join('?').replace(/\s+/g, ' ')
    if (q.includes('INSERT INTO rate_limits')) {
      const k = v[0] + '|' + v[1]
      hits.set(k, (hits.get(k) || 0) + 1)
      return [{ hits: hits.get(k) }]
    }
    if (q.includes('DELETE FROM rate_limits')) return []
    if (q.includes('FROM links WHERE user_id')) return links.filter((r) => r.user_id === v[0]).map(linkOut)
    if (q.includes('INSERT INTO links')) {
      const r = { id: v[0], user_id: v[1], title: v[2], url: v[3], description: v[4], category: v[5], created_at: now(), updated_at: now() }
      links.push(r)
      return [linkOut(r)]
    }
    if (q.includes('UPDATE links')) {
      const r = links.find((x) => x.id === v[4] && x.user_id === v[5])
      if (!r) return []
      Object.assign(r, { title: v[0], url: v[1], description: v[2], category: v[3], updated_at: now() })
      return [linkOut(r)]
    }
    if (q.includes('DELETE FROM links')) {
      const i = links.findIndex((x) => x.id === v[0] && x.user_id === v[1])
      if (i < 0) return []
      links.splice(i, 1)
      return [{ id: v[0] }]
    }
    if (q.includes('FROM password_entries WHERE user_id')) return passwords.filter((r) => r.user_id === v[0]).map(meta)
    if (q.includes('INSERT INTO password_entries')) {
      const r = { id: v[0], user_id: v[1], site_name: v[2], site_url: v[3], username: v[4], email: v[5], password_enc: v[6], notes_enc: v[7], created_at: now(), updated_at: now() }
      passwords.push(r)
      return [meta(r)]
    }
    if (q.includes('UPDATE password_entries')) {
      const r = passwords.find((x) => x.id === v[8] && x.user_id === v[9])
      if (!r) return []
      r.site_name = v[0]; r.site_url = v[1]; r.username = v[2]; r.email = v[3]
      if (v[4] !== null) r.password_enc = v[4]
      if (v[5] === 'clear') r.notes_enc = null
      else if (v[6] === 'set') r.notes_enc = v[7]
      r.updated_at = now()
      return [meta(r)]
    }
    if (q.includes('SELECT password_enc, notes_enc')) {
      const r = passwords.find((x) => x.id === v[0] && x.user_id === v[1])
      return r ? [{ password_enc: r.password_enc, notes_enc: r.notes_enc }] : []
    }
    if (q.includes('DELETE FROM password_entries')) {
      const i = passwords.findIndex((x) => x.id === v[0] && x.user_id === v[1])
      if (i < 0) return []
      passwords.splice(i, 1)
      return [{ id: v[0] }]
    }
    throw new Error('fake sql: unsupported query: ' + q.slice(0, 80))
  }
  sql.tables = { links, passwords }
  return sql
}
