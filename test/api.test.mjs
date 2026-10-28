import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { loadKey, encryptSecret, decryptSecret, aadFor } from '../api/_lib/crypto.js'
import { HttpError } from '../api/_lib/errors.js'
import { normalizeUrl } from '../api/_lib/validate.js'
import { setAuthForTests } from '../api/_lib/auth.js'
import { setSqlForTests } from '../api/_lib/db.js'
import { createFakeSql } from './fake-sql.js'
import linksHandler from '../api/links.js'
import passwordsHandler from '../api/passwords.js'
import revealHandler from '../api/reveal.js'

const GOOD_KEY = randomBytes(32).toString('base64')
process.env.VAULT_ENCRYPTION_KEY = GOOD_KEY
setAuthForTests((token) => {
  if (token === 'bad') throw new HttpError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED')
  return token // in tests the "token" is simply the user id
})

let fake
beforeEach(() => {
  fake = createFakeSql()
  setSqlForTests(fake)
  process.env.VAULT_ENCRYPTION_KEY = GOOD_KEY
})

async function call(handler, { method = 'GET', user = 'user_A', query = {}, body, headers = {} } = {}) {
  const req = { method, query, body, headers: { 'content-type': 'application/json', ...(user ? { authorization: 'Bearer ' + user } : {}), ...headers } }
  const res = { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.code = c; return this }, json(b) { this.body = b; return this } }
  await handler(req, res)
  return res
}

// ---------- key validation ----------
test('key: accepts exactly 32 bytes of Base64', () => {
  assert.equal(loadKey({ VAULT_ENCRYPTION_KEY: GOOD_KEY }).length, 32)
})
test('key: rejects missing, empty, short, long, and non-Base64 keys', () => {
  const bad = [undefined, '', '   ', randomBytes(16).toString('base64'), randomBytes(31).toString('base64'), randomBytes(33).toString('base64'), randomBytes(64).toString('base64'), 'not base64!!', 'abc', 'a'.repeat(44)]
  for (const k of bad) assert.throws(() => loadKey({ VAULT_ENCRYPTION_KEY: k }), (e) => e.status === 500 && /VAULT_ENCRYPTION_KEY/.test(e.message), `should reject ${JSON.stringify(k)}`)
})

// ---------- AES-256-GCM ----------
test('crypto: round trip, random IV, ciphertext hides plaintext', () => {
  const key = loadKey(); const aad = aadFor('u', 'e', 'password')
  const a = encryptSecret('Sup3r Secret ✓', aad, key); const b = encryptSecret('Sup3r Secret ✓', aad, key)
  assert.notEqual(a, b)
  assert.ok(a.startsWith('v1.'))
  assert.ok(!a.includes('Sup3r'))
  assert.equal(decryptSecret(a, aad, key), 'Sup3r Secret ✓')
  assert.equal(decryptSecret(encryptSecret('', aad, key), aad, key), '')
})
test('crypto: tampering, wrong key and wrong owner/row/field all fail', () => {
  const key = loadKey(); const aad = aadFor('u', 'e', 'password')
  const enc = encryptSecret('secret', aad, key)
  const parts = enc.split('.')
  const flip = (s) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1)
  assert.throws(() => decryptSecret([parts[0], parts[1], parts[2], flip(parts[3])].join('.'), aad, key), { code: 'DECRYPT_FAILED' })
  assert.throws(() => decryptSecret([parts[0], parts[1], flip(parts[2]), parts[3]].join('.'), aad, key), { code: 'DECRYPT_FAILED' })
  assert.throws(() => decryptSecret(enc, aad, randomBytes(32)), { code: 'DECRYPT_FAILED' })
  assert.throws(() => decryptSecret(enc, aadFor('other', 'e', 'password'), key), { code: 'DECRYPT_FAILED' })
  assert.throws(() => decryptSecret(enc, aadFor('u', 'other', 'password'), key), { code: 'DECRYPT_FAILED' })
  assert.throws(() => decryptSecret(enc, aadFor('u', 'e', 'notes'), key), { code: 'DECRYPT_FAILED' })
  assert.throws(() => decryptSecret('garbage', aad, key), { code: 'DECRYPT_FAILED' })
})

// ---------- URL validation ----------
test('url: accepts web addresses, rejects dangerous or malformed ones', () => {
  assert.equal(normalizeUrl('https://example.com/login'), 'https://example.com/login')
  assert.equal(normalizeUrl('example.com/login'), 'https://example.com/login')
  assert.equal(normalizeUrl('http://localhost:3000/x'), 'http://localhost:3000/x')
  assert.equal(normalizeUrl('localhost:3000'), 'http://localhost:3000/'.replace('http', 'https'))
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'mailto:a@b.com', 'ftp://example.com', 'https://user:pw@example.com', 'https://nodot', 'ht tp://x.com', '', '   ', 'https://', null, 42]) {
    assert.equal(normalizeUrl(bad), null, `should reject ${bad}`)
  }
})

// ---------- authentication ----------
test('api: requests without a valid token are rejected (401)', async () => {
  for (const h of [linksHandler, passwordsHandler, revealHandler]) {
    const r = await call(h, { user: null, method: h === revealHandler ? 'POST' : 'GET', body: {} })
    assert.equal(r.code, 401)
  }
  const bad = await call(linksHandler, { user: 'bad' })
  assert.equal(bad.code, 401)
  assert.ok(!JSON.stringify(bad.body).includes('stack'))
})
test('api: unsupported methods get 405', async () => {
  assert.equal((await call(linksHandler, { method: 'PATCH', body: {} })).code, 405)
})

// ---------- links ----------
test('links: create, list, update, delete', async () => {
  const c = await call(linksHandler, { method: 'POST', body: { title: ' Docs ', url: 'example.com/docs', description: 'd', category: 'Work' } })
  assert.equal(c.code, 201)
  assert.equal(c.body.link.title, 'Docs')
  assert.equal(c.body.link.url, 'https://example.com/docs')
  const id = c.body.link.id
  assert.equal((await call(linksHandler)).body.links.length, 1)
  const u = await call(linksHandler, { method: 'PUT', query: { id }, body: { title: 'Docs 2', url: 'https://example.org' } })
  assert.equal(u.code, 200); assert.equal(u.body.link.title, 'Docs 2')
  assert.equal((await call(linksHandler, { method: 'DELETE', query: { id } })).code, 200)
  assert.equal((await call(linksHandler)).body.links.length, 0)
})
test('links: validation errors', async () => {
  const post = (body) => call(linksHandler, { method: 'POST', body })
  assert.equal((await post({ url: 'https://a.com' })).code, 400)
  assert.equal((await post({ title: 'x', url: 'javascript:alert(1)' })).code, 400)
  assert.equal((await post({ title: 'x', url: 'not a url' })).code, 400)
  assert.equal((await post({ title: 'x'.repeat(201), url: 'https://a.com' })).code, 400)
  assert.equal((await post({ title: 'x', url: 'https://a.com', category: 5 })).code, 400)
  assert.equal((await call(linksHandler, { method: 'PUT', query: { id: 'nope' }, body: { title: 'x', url: 'https://a.com' } })).code, 400)
  assert.equal(fake.tables.links.length, 0)
})
test('links: no cap on how many a user can store (only a per-minute write rate limit)', async () => {
  for (let i = 0; i < 500; i++) fake.tables.links.push({ id: 'id' + i, user_id: 'user_A', title: 'L' + i, url: 'https://a.com/' + i, description: '', category: '', created_at: '', updated_at: '' })
  assert.equal((await call(linksHandler)).body.links.length, 500)
  let last
  for (let i = 0; i < 61; i++) last = await call(linksHandler, { method: 'POST', body: { title: 'N' + i, url: 'https://a.com/n' + i } })
  assert.equal(last.code, 429) // 61st write inside one minute is throttled
})
test("links: one user cannot see, edit or delete another user's links", async () => {
  const c = await call(linksHandler, { method: 'POST', user: 'user_A', body: { title: 'A private', url: 'https://a.com' } })
  const id = c.body.link.id
  assert.equal((await call(linksHandler, { user: 'user_B' })).body.links.length, 0)
  assert.equal((await call(linksHandler, { method: 'PUT', user: 'user_B', query: { id }, body: { title: 'hacked', url: 'https://evil.com' } })).code, 404)
  assert.equal((await call(linksHandler, { method: 'DELETE', user: 'user_B', query: { id } })).code, 404)
  assert.equal(fake.tables.links[0].title, 'A private')
})

// ---------- passwords ----------
const entry = { siteName: 'Example', siteUrl: 'example.com/login', username: 'me', email: 'me@example.com', password: 'Pa$$w0rd-UNIQUE-123', notes: 'my private note UNIQUE-NOTE' }

test('passwords: stored encrypted, never plaintext, never in list responses', async () => {
  const c = await call(passwordsHandler, { method: 'POST', body: entry })
  assert.equal(c.code, 201)
  assert.equal(c.body.entry.siteUrl, 'https://example.com/login')
  const row = fake.tables.passwords[0]
  const stored = JSON.stringify(fake.tables)
  assert.ok(!stored.includes('Pa$$w0rd-UNIQUE-123'), 'plaintext password in database')
  assert.ok(!stored.includes('UNIQUE-NOTE'), 'plaintext notes in database')
  assert.ok(row.password_enc.startsWith('v1.') && row.notes_enc.startsWith('v1.'))
  const list = await call(passwordsHandler)
  const text = JSON.stringify(list.body)
  assert.ok(!text.includes('UNIQUE') && !text.includes('v1.') && !text.includes('password_enc'), 'list leaks secrets')
  assert.equal(list.body.entries[0].hasNotes, true)
  assert.ok(!JSON.stringify(c.body).includes('UNIQUE') && !JSON.stringify(c.body).includes('v1.'))
})
test('passwords: reveal returns the password only to its owner', async () => {
  const id = (await call(passwordsHandler, { method: 'POST', body: entry })).body.entry.id
  const own = await call(revealHandler, { method: 'POST', body: { id, field: 'password' } })
  assert.equal(own.body.value, entry.password)
  assert.equal((await call(revealHandler, { method: 'POST', body: { id, field: 'notes' } })).body.value, entry.notes)
  const other = await call(revealHandler, { method: 'POST', user: 'user_B', body: { id, field: 'password' } })
  assert.equal(other.code, 404)
  assert.ok(!JSON.stringify(other.body).includes(entry.password))
  assert.equal((await call(revealHandler, { method: 'POST', body: { id, field: 'password_enc' } })).code, 400)
  assert.equal((await call(revealHandler, { method: 'POST', body: { id: 'x', field: 'password' } })).code, 400)
})
test("passwords: another user cannot list, edit or delete someone else's entry", async () => {
  const id = (await call(passwordsHandler, { method: 'POST', body: entry })).body.entry.id
  assert.equal((await call(passwordsHandler, { user: 'user_B' })).body.entries.length, 0)
  assert.equal((await call(passwordsHandler, { method: 'PUT', user: 'user_B', query: { id }, body: { siteName: 'x', siteUrl: 'https://x.com', password: 'hijack' } })).code, 404)
  assert.equal((await call(passwordsHandler, { method: 'DELETE', user: 'user_B', query: { id } })).code, 404)
  assert.equal((await call(revealHandler, { method: 'POST', body: { id, field: 'password' } })).body.value, entry.password)
})
test('passwords: a ciphertext moved to another row or user cannot be decrypted', async () => {
  const a = (await call(passwordsHandler, { method: 'POST', body: entry })).body.entry.id
  const b = (await call(passwordsHandler, { method: 'POST', body: { ...entry, password: 'other-pw' } })).body.entry.id
  const rowA = fake.tables.passwords.find((r) => r.id === a)
  const rowB = fake.tables.passwords.find((r) => r.id === b)
  rowB.password_enc = rowA.password_enc
  const r = await call(revealHandler, { method: 'POST', body: { id: b, field: 'password' } })
  assert.equal(r.code, 500); assert.equal(r.body.code, 'DECRYPT_FAILED')
})
test('passwords: edit keeps password when blank, replaces when given; notes keep/clear/set', async () => {
  const id = (await call(passwordsHandler, { method: 'POST', body: entry })).body.entry.id
  const reveal = async (field = 'password') => (await call(revealHandler, { method: 'POST', body: { id, field } })).body.value
  const base = { siteName: 'Example 2', siteUrl: 'https://example.com', username: 'me2', email: '' }
  let r = await call(passwordsHandler, { method: 'PUT', query: { id }, body: { ...base, password: '' } }) // no notes key
  assert.equal(r.code, 200); assert.equal(r.body.entry.siteName, 'Example 2')
  assert.equal(await reveal(), entry.password); assert.equal(await reveal('notes'), entry.notes)
  await call(passwordsHandler, { method: 'PUT', query: { id }, body: { ...base, password: 'new-pw-456', notes: 'changed' } })
  assert.equal(await reveal(), 'new-pw-456'); assert.equal(await reveal('notes'), 'changed')
  r = await call(passwordsHandler, { method: 'PUT', query: { id }, body: { ...base, notes: '' } })
  assert.equal(r.body.entry.hasNotes, false); assert.equal(await reveal(), 'new-pw-456')
})
test('passwords: validation (required fields, URL, email, length)', async () => {
  const post = (b) => call(passwordsHandler, { method: 'POST', body: { ...entry, ...b } })
  assert.equal((await post({ siteName: '' })).code, 400)
  assert.equal((await post({ siteUrl: '' })).code, 400)
  assert.equal((await post({ siteUrl: 'javascript:alert(1)' })).code, 400)
  assert.equal((await post({ password: '' })).code, 400)
  assert.equal((await post({ email: 'nope' })).code, 400)
  assert.equal((await post({ password: 'x'.repeat(1025) })).code, 400)
  assert.equal((await post({ username: '', email: '' })).code, 201) // username/email are optional
  assert.equal(fake.tables.passwords.length, 1)
})
test('passwords: password text is saved exactly (spaces and symbols preserved)', async () => {
  const id = (await call(passwordsHandler, { method: 'POST', body: { ...entry, password: '  spaced "quote" \\ ünï  ' } })).body.entry.id
  assert.equal((await call(revealHandler, { method: 'POST', body: { id, field: 'password' } })).body.value, '  spaced "quote" \\ ünï  ')
})
test('passwords: missing or invalid key fails safely and stores nothing', async () => {
  for (const k of [undefined, randomBytes(16).toString('base64')]) {
    if (k === undefined) delete process.env.VAULT_ENCRYPTION_KEY; else process.env.VAULT_ENCRYPTION_KEY = k
    const r = await call(passwordsHandler, { method: 'POST', body: entry })
    assert.equal(r.code, 500); assert.match(r.body.error, /VAULT_ENCRYPTION_KEY/)
    assert.equal(fake.tables.passwords.length, 0)
    assert.ok(!JSON.stringify(r.body).includes(entry.password))
  }
})
test('passwords: delete works', async () => {
  const id = (await call(passwordsHandler, { method: 'POST', body: entry })).body.entry.id
  assert.equal((await call(passwordsHandler, { method: 'DELETE', query: { id } })).code, 200)
  assert.equal(fake.tables.passwords.length, 0)
})

// ---------- rate limiting & error safety ----------
test('rate limit: reveal is limited to 30 per minute per user', async () => {
  const id = (await call(passwordsHandler, { method: 'POST', body: entry })).body.entry.id
  let last
  for (let i = 0; i < 31; i++) last = await call(revealHandler, { method: 'POST', body: { id, field: 'password' } })
  assert.equal(last.code, 429)
  assert.equal((await call(revealHandler, { method: 'POST', user: 'user_B', body: { id, field: 'password' } })).code, 404) // other user not limited
})
test('errors: unexpected failures return a generic message and do not log secrets', async () => {
  setSqlForTests(async () => { throw Object.assign(new Error('connection to host=secret-db password=hunter2 failed'), { code: 'XX000' }) })
  const logged = []
  const orig = console.error; console.error = (...a) => logged.push(a.join(' '))
  const r = await call(linksHandler)
  console.error = orig
  assert.equal(r.code, 500)
  assert.ok(!JSON.stringify(r.body).includes('hunter2'))
  assert.ok(!logged.join(' ').includes('hunter2'))
})
test('responses are never cacheable', async () => {
  const r = await call(linksHandler)
  assert.equal(r.headers['Cache-Control'], 'no-store')
})
