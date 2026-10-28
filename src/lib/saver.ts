// Types and helpers shared by the Link Saver and Password Saver pages.

export interface SavedLink {
  id: string
  title: string
  url: string
  description: string
  category: string
  createdAt: string
  updatedAt: string
}

/** Password list entries never contain the password or the notes. */
export interface PasswordMeta {
  id: string
  siteName: string
  siteUrl: string
  username: string
  email: string
  hasNotes: boolean
  createdAt: string
  updatedAt: string
}

export type SaverSort = 'newest' | 'oldest' | 'alpha'

/**
 * Returns a clean http(s) address, or null when the text is not a usable web address.
 * Mirrors the check done on the server (the server is the one that really enforces it).
 */
export function normalizeUrl(input: string): string | null {
  let s = input.trim()
  if (!s || s.length > 2048 || /\s/.test(s)) return null
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
    const looksLikeHostPort = /^[^\s/?#:]+:\d+([/?#]|$)/.test(s)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) && !looksLikeHostPort) return null
    s = 'https://' + s
  }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  const host = u.hostname
  if (!host || !(host.includes('.') || host === 'localhost' || host.startsWith('['))) return null
  return u.href
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** True only for addresses that are safe to put in an <a href>. */
export function isSafeHref(url: string): boolean {
  return normalizeUrl(url) !== null
}

export function sortItems<T extends { createdAt: string }>(items: T[], sort: SaverSort, label: (item: T) => string): T[] {
  const copy = [...items]
  if (sort === 'alpha') copy.sort((a, b) => label(a).localeCompare(label(b), undefined, { sensitivity: 'base' }))
  else if (sort === 'oldest') copy.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
  else copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  return copy
}

export function matches(haystack: Array<string | undefined>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return haystack.some((h) => (h ?? '').toLowerCase().includes(q))
}

/** Creates a random password using the browser's secure random generator. */
export function generatePassword(length = 20): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?'
  const out: string[] = []
  const buf = new Uint32Array(length)
  // Rejection sampling keeps every character equally likely.
  const limit = Math.floor(0x100000000 / chars.length) * chars.length
  while (out.length < length) {
    crypto.getRandomValues(buf)
    for (const n of buf) {
      if (n < limit && out.length < length) out.push(chars[n % chars.length])
    }
  }
  return out.join('')
}
