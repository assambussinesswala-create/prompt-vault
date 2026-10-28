import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, UNCATEGORIZED } from './defaults'
import type { Category, Prompt, Settings } from './types'
import { nowIso, normalizeTags, uid } from './util'

/**
 * All persistence goes through this file, so a future cloud-sync layer
 * (for example Supabase with authentication) only has to replace these functions.
 */
const NS = 'promptvault:v1:'
export const KEYS = {
  prompts: NS + 'prompts',
  categories: NS + 'categories',
  settings: NS + 'settings',
} as const

export interface LoadResult {
  prompts: Prompt[]
  categories: Category[]
  settings: Settings
  /** Human-readable problems found while loading. Never silently ignored. */
  warnings: string[]
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Keep a copy of unreadable data so nothing is ever destroyed by a later save. */
function preserveCorrupt(key: string, raw: string): void {
  try {
    localStorage.setItem(`${key}:corrupt-${Date.now()}`, raw)
  } catch {
    /* nothing more we can do */
  }
}

/** Coerce an unknown object into a valid Prompt without touching the prompt text. */
export function coercePrompt(o: unknown): Prompt | null {
  if (!o || typeof o !== 'object') return null
  const r = o as Record<string, unknown>
  const content = typeof r.content === 'string' ? r.content : ''
  if (!content.trim()) return null
  const created = typeof r.createdAt === 'string' && !isNaN(Date.parse(r.createdAt)) ? r.createdAt : nowIso()
  const updated = typeof r.updatedAt === 'string' && !isNaN(Date.parse(r.updatedAt)) ? r.updatedAt : created
  const used = typeof r.lastUsedAt === 'string' && !isNaN(Date.parse(r.lastUsedAt)) ? r.lastUsedAt : null
  const p: Prompt = {
    id: typeof r.id === 'string' && r.id ? r.id : uid(),
    title: (typeof r.title === 'string' && r.title.trim()) || 'Untitled prompt',
    content,
    description: typeof r.description === 'string' ? r.description : '',
    category: (typeof r.category === 'string' && r.category.trim()) || UNCATEGORIZED,
    tags: normalizeTags(r.tags),
    platform: typeof r.platform === 'string' ? r.platform.trim() : '',
    createdAt: created,
    updatedAt: updated,
    lastUsedAt: used,
    favorite: r.favorite === true,
    notes: typeof r.notes === 'string' ? r.notes : '',
    version: r.version === undefined || r.version === null ? '' : String(r.version),
  }
  if (r.isDemo === true) p.isDemo = true
  return p
}

export function loadAll(): LoadResult {
  const warnings: string[] = []

  let prompts: Prompt[] = []
  const rawPrompts = safeGet(KEYS.prompts)
  if (rawPrompts) {
    try {
      const parsed = JSON.parse(rawPrompts)
      if (!Array.isArray(parsed)) throw new Error('not an array')
      const seen = new Set<string>()
      for (const item of parsed) {
        const p = coercePrompt(item)
        if (!p) continue
        if (seen.has(p.id)) p.id = uid()
        seen.add(p.id)
        prompts.push(p)
      }
      if (prompts.length < parsed.length) warnings.push(`${parsed.length - prompts.length} saved item(s) were unreadable and skipped.`)
    } catch {
      preserveCorrupt(KEYS.prompts, rawPrompts)
      prompts = []
      warnings.push('Your saved prompts could not be read. A raw copy was kept in browser storage. Do not clear site data yet, and contact support or inspect the key that ends in ":corrupt-…".')
    }
  }

  let categories: Category[] = DEFAULT_CATEGORIES.map((name) => ({ name, builtIn: true }))
  const rawCats = safeGet(KEYS.categories)
  if (rawCats) {
    try {
      const parsed = JSON.parse(rawCats)
      if (!Array.isArray(parsed)) throw new Error('not an array')
      const list: Category[] = []
      for (const c of parsed) {
        if (c && typeof c.name === 'string' && c.name.trim()) list.push({ name: c.name.trim(), builtIn: c.builtIn === true })
      }
      if (list.length) categories = list
    } catch {
      preserveCorrupt(KEYS.categories, rawCats)
      warnings.push('The saved category list was unreadable, so defaults were restored.')
    }
  }
  if (!categories.some((c) => c.name === UNCATEGORIZED)) categories.push({ name: UNCATEGORIZED, builtIn: true })
  // Make sure every category used by a prompt exists.
  for (const p of prompts) {
    if (!categories.some((c) => c.name === p.category)) categories.push({ name: p.category, builtIn: false })
  }

  let settings: Settings = { ...DEFAULT_SETTINGS }
  const rawSettings = safeGet(KEYS.settings)
  if (rawSettings) {
    try {
      const s = JSON.parse(rawSettings)
      settings = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) }
    } catch {
      preserveCorrupt(KEYS.settings, rawSettings)
    }
  }
  return { prompts, categories, settings, warnings }
}

export interface SaveResult {
  ok: boolean
  error?: string
}

function write(key: string, value: unknown): SaveResult {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    const full = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    return {
      ok: false,
      error: full
        ? 'Browser storage is full. Export a backup, then delete prompts you no longer need.'
        : 'Browser storage is unavailable (private mode or blocked by settings). Changes will be lost when you close this tab. Export a backup now.',
    }
  }
}

export const savePrompts = (p: Prompt[]) => write(KEYS.prompts, p)
export const saveCategories = (c: Category[]) => write(KEYS.categories, c)
export const saveSettings = (s: Settings) => write(KEYS.settings, s)

export function clearEverything(): SaveResult {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(NS)) toRemove.push(k)
    }
    toRemove.forEach((k) => localStorage.removeItem(k))
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not clear browser storage.' }
  }
}

export interface StorageUsage {
  bytes: number
  limit: number
  keys: number
}

/** Approximate size (UTF-16, 2 bytes/char) of everything this app stores. Typical browser limit is about 5 MB. */
export function storageUsage(): StorageUsage {
  let chars = 0
  let keys = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(NS)) {
        keys++
        chars += k.length + (localStorage.getItem(k)?.length ?? 0)
      }
    }
  } catch {
    /* ignore */
  }
  return { bytes: chars * 2, limit: 5 * 1024 * 1024, keys }
}
