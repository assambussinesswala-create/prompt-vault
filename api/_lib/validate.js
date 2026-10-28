// Input validation shared by all endpoints. Every value from the browser is untrusted.
import { HttpError } from './errors.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isUuid(v) {
  return typeof v === 'string' && UUID.test(v)
}

export function requireId(v) {
  if (!isUuid(v)) throw new HttpError(400, 'That item id is not valid.', 'VALIDATION')
  return v
}

/**
 * Returns a clean http(s) URL string, or null if the input is not an acceptable web address.
 * "example.com/login" is accepted and becomes "https://example.com/login".
 * javascript:, data:, file:, mailto: and similar schemes are rejected.
 */
export function normalizeUrl(input) {
  if (typeof input !== 'string') return null
  let s = input.trim()
  if (!s || s.length > 2048 || /\s/.test(s)) return null
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
    const looksLikeHostPort = /^[^\s/?#:]+:\d+([/?#]|$)/.test(s)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) && !looksLikeHostPort) return null
    s = 'https://' + s
  }
  let u
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null // never store credentials inside a URL
  const host = u.hostname
  if (!host || !(host.includes('.') || host === 'localhost' || host.startsWith('['))) return null
  return u.href
}

/** Reads a text field. Trims it, enforces a maximum length and an optional "required" rule. */
export function text(body, key, label, max, { required = false } = {}) {
  const raw = body[key]
  if (raw === undefined || raw === null) {
    if (required) throw new HttpError(400, `${label} is required.`, 'VALIDATION')
    return ''
  }
  if (typeof raw !== 'string') throw new HttpError(400, `${label} must be text.`, 'VALIDATION')
  const v = raw.trim()
  if (required && !v) throw new HttpError(400, `${label} is required.`, 'VALIDATION')
  if (v.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`, 'VALIDATION')
  return v
}

export function url(body, key, label, { required = true } = {}) {
  const raw = body[key]
  if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) {
    if (required) throw new HttpError(400, `${label} is required.`, 'VALIDATION')
    return ''
  }
  const clean = normalizeUrl(raw)
  if (!clean) throw new HttpError(400, `${label} is not a valid web address. Use something like https://example.com`, 'VALIDATION')
  return clean
}

export function email(body, key = 'email') {
  const v = text(body, key, 'Email', 254)
  if (v && !EMAIL.test(v)) throw new HttpError(400, 'Email is not a valid email address.', 'VALIDATION')
  return v
}

/** A password is never trimmed or changed. Only its length is checked. */
export function password(body, key, { required }) {
  const raw = body[key]
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw new HttpError(400, 'Password is required.', 'VALIDATION')
    return null
  }
  if (typeof raw !== 'string') throw new HttpError(400, 'Password must be text.', 'VALIDATION')
  if (raw.length > 1024) throw new HttpError(400, 'Password must be 1024 characters or fewer.', 'VALIDATION')
  return raw
}

export const LIMITS = { title: 200, description: 2000, category: 60, siteName: 200, username: 200, notes: 5000 }
