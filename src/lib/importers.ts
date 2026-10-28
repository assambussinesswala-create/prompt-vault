import { UNCATEGORIZED, IMPORT_SEPARATOR } from './defaults'
import { buildDupIndex, findDuplicate, normalizeForCompare, type DupResult } from './dedupe'
import { BACKUP_FORMAT, BACKUP_VERSION, type Prompt } from './types'
import { normalizeTags, nowIso, uid } from './util'
import { coercePrompt } from './storage'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** A prompt found in an import source, before the user has reviewed it. */
export interface ParsedPrompt {
  id?: string
  title: string
  content: string
  description: string
  category: string
  tags: string[]
  platform: string
  notes: string
  version: string
  favorite: boolean
  createdAt?: string
  updatedAt?: string
  lastUsedAt?: string | null
}

export type SourceKind = 'text' | 'json' | 'backup' | 'chatgpt'

export interface ParseResult {
  kind: SourceKind
  items: ParsedPrompt[]
  errors: string[]
  /** Backup files only */
  categories?: string[]
}

export type SplitMode = 'separator' | 'headings' | 'rules' | 'blank' | 'single' | 'custom'

export const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  separator: `Separator line (${IMPORT_SEPARATOR})`,
  headings: 'Markdown headings (each heading starts a prompt)',
  rules: 'Horizontal rules (--- or ***)',
  blank: 'Two or more blank lines',
  custom: 'Custom separator line',
  single: 'Treat everything as one prompt',
}

/* ------------------------------------------------------------------ */
/* Text / Markdown splitting                                           */
/* ------------------------------------------------------------------ */

export const normalizeNewlines = (s: string) => s.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '')

interface Line {
  text: string
  inFence: boolean
}

function scanLines(text: string): Line[] {
  const lines = normalizeNewlines(text).split('\n')
  let fence = false
  return lines.map((t) => {
    const isFenceLine = /^\s*(```|~~~)/.test(t)
    const out = { text: t, inFence: fence || isFenceLine }
    if (isFenceLine) fence = !fence
    return out
  })
}

const isRule = (t: string) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(t)
const headingLevel = (t: string): number => {
  const m = /^(#{1,6})\s+\S/.exec(t)
  return m ? m[1].length : 0
}

/** Picks the most plausible split mode for the given text. */
export function detectSplitMode(text: string): SplitMode {
  const lines = scanLines(text)
  const sep = IMPORT_SEPARATOR.toLowerCase()
  if (lines.some((l) => l.text.trim().toLowerCase() === sep)) return 'separator'
  const counts = new Map<number, number>()
  for (const l of lines) {
    if (l.inFence) continue
    const lv = headingLevel(l.text)
    if (lv) counts.set(lv, (counts.get(lv) ?? 0) + 1)
  }
  if ([...counts.values()].some((c) => c >= 2)) return 'headings'
  if (lines.some((l) => !l.inFence && isRule(l.text) && l.text.trim() !== '')) {
    const parts = splitText(text, 'rules')
    if (parts.length >= 2) return 'rules'
  }
  return 'single'
}

/** Splits text into raw chunks. Never alters text inside a chunk. */
export function splitText(text: string, mode: SplitMode, customSeparator = ''): string[] {
  const norm = normalizeNewlines(text)
  if (mode === 'single') return [norm]
  if (mode === 'blank') return norm.split(/\n[ \t]*\n(?:[ \t]*\n)+/)

  const lines = scanLines(norm)
  const chunks: string[][] = [[]]
  const push = (t: string) => chunks[chunks.length - 1].push(t)
  const next = () => chunks.push([])

  if (mode === 'separator' || mode === 'custom') {
    const sep = (mode === 'custom' ? customSeparator : IMPORT_SEPARATOR).trim().toLowerCase()
    if (!sep) return [norm]
    for (const l of lines) {
      if (!l.inFence && l.text.trim().toLowerCase() === sep) next()
      else push(l.text)
    }
  } else if (mode === 'rules') {
    for (const l of lines) {
      if (!l.inFence && isRule(l.text)) next()
      else push(l.text)
    }
  } else if (mode === 'headings') {
    const counts = new Map<number, number>()
    for (const l of lines) {
      if (l.inFence) continue
      const lv = headingLevel(l.text)
      if (lv) counts.set(lv, (counts.get(lv) ?? 0) + 1)
    }
    let level = 0
    for (let lv = 1; lv <= 6; lv++) if ((counts.get(lv) ?? 0) >= 2) { level = lv; break }
    if (!level) for (let lv = 1; lv <= 6; lv++) if (counts.get(lv)) { level = lv; break }
    if (!level) return [norm]
    for (const l of lines) {
      if (!l.inFence && headingLevel(l.text) === level) next()
      push(l.text)
    }
  }
  return chunks.map((c) => c.join('\n'))
}

const stripEdgeBlankLines = (s: string) => s.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '')

function cleanTitle(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*(\*\*|__)(.*?)\1\s*:?\s*$/, '$2')
    .replace(/^\s*(?:prompt|title)\s*#?\d*\s*[:.\-–—]\s*/i, '')
    .replace(/[:：]\s*$/, '')
    .replace(/\*\*/g, '')
    .trim()
}

function fallbackTitle(content: string): string {
  const words = content.trim().split(/\s+/).slice(0, 8).join(' ')
  return words.length < content.trim().length ? words + '…' : words
}

/**
 * Turns a raw chunk into a prompt.
 * The prompt text is only altered when an explicit title line ("Title: …", or a heading in
 * heading mode) is lifted out of it. Otherwise the text is kept exactly as it was found.
 */
export function chunkToPrompt(chunk: string, mode: SplitMode): ParsedPrompt | null {
  const body = stripEdgeBlankLines(chunk)
  if (!body.trim()) return null
  const lines = body.split('\n')
  const first = lines[0]
  let title = ''
  let content = body
  const rest = () => stripEdgeBlankLines(lines.slice(1).join('\n'))

  const explicit = /^\s*(?:title|name)\s*[:：]\s*(.+)$/i.exec(first)
  if (explicit && rest()) {
    title = explicit[1].trim()
    content = rest()
  } else if (mode === 'headings' && headingLevel(first) && rest()) {
    title = cleanTitle(first)
    content = rest()
  } else if (lines.length > 1 && first.trim().length <= 90 && first.trim().length > 0) {
    title = cleanTitle(first)
  }
  if (!title) title = fallbackTitle(content)
  return {
    title: title.slice(0, 160) || 'Untitled prompt',
    content,
    description: '',
    category: '',
    tags: [],
    platform: '',
    notes: '',
    version: '',
    favorite: false,
  }
}

export function parseText(text: string, mode: SplitMode, customSeparator = ''): ParseResult {
  const items: ParsedPrompt[] = []
  const errors: string[] = []
  if (!text.trim()) return { kind: 'text', items, errors: ['There is no text to import.'] }
  let chunks = splitText(text, mode, customSeparator)
  if (mode === 'headings') {
    // Drop an intro made only of higher-level headings (e.g. a document title).
    chunks = chunks.filter((c) => !c.split('\n').every((l) => !l.trim() || headingLevel(l) > 0 || /^#{1,6}\s*$/.test(l)) || chunks.length === 1)
  }
  chunks.forEach((c, i) => {
    const p = chunkToPrompt(c, mode)
    if (p) items.push(p)
    else if (chunks.length > 1) errors.push(`Section ${i + 1} was empty and was skipped.`)
  })
  return { kind: 'text', items, errors }
}

/* ------------------------------------------------------------------ */
/* JSON                                                                */
/* ------------------------------------------------------------------ */

const pick = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]
  return undefined
}
const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))
const validDate = (v: unknown): string | undefined => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v : undefined)

function objectToParsed(o: Record<string, unknown>): ParsedPrompt | null {
  const content = pick(o, ['content', 'prompt', 'text', 'body', 'promptText'])
  if (typeof content !== 'string' || !content.trim()) return null
  const titleRaw = pick(o, ['title', 'name', 'heading'])
  const title = (typeof titleRaw === 'string' && titleRaw.trim()) || fallbackTitle(content)
  return {
    id: typeof o.id === 'string' && o.id ? o.id : undefined,
    title: title.slice(0, 160),
    content,
    description: str(pick(o, ['description', 'summary'])),
    category: str(pick(o, ['category', 'folder'])).trim(),
    tags: normalizeTags(pick(o, ['tags', 'labels', 'keywords'])),
    platform: str(pick(o, ['platform', 'tool', 'model', 'aiTool', 'ai'])).trim(),
    notes: str(o.notes),
    version: str(o.version),
    favorite: pick(o, ['favorite', 'favourite', 'starred']) === true,
    createdAt: validDate(o.createdAt),
    updatedAt: validDate(o.updatedAt),
    lastUsedAt: validDate(o.lastUsedAt) ?? null,
  }
}

export interface JsonOptions {
  /** ChatGPT exports only: ignore user messages shorter than this. */
  minChars?: number
}

function extractChatGpt(convos: unknown[], minChars: number): ParseResult {
  const items: ParsedPrompt[] = []
  const errors: string[] = []
  convos.forEach((c, ci) => {
    const convo = c as { title?: unknown; mapping?: Record<string, { message?: unknown }> }
    if (!convo || typeof convo !== 'object' || !convo.mapping || typeof convo.mapping !== 'object') {
      errors.push(`Conversation ${ci + 1} has no readable messages.`)
      return
    }
    type Msg = { author?: { role?: string }; content?: { parts?: unknown[] }; create_time?: number | null }
    const msgs: { text: string; time: number }[] = []
    for (const node of Object.values(convo.mapping)) {
      const m = node?.message as Msg | undefined
      if (!m || m.author?.role !== 'user') continue
      const parts = m.content?.parts
      if (!Array.isArray(parts)) continue
      const text = parts.filter((p) => typeof p === 'string').join('\n')
      if (text.trim().length >= minChars) msgs.push({ text, time: typeof m.create_time === 'number' ? m.create_time : 0 })
    }
    msgs.sort((a, b) => a.time - b.time)
    const convoTitle = (typeof convo.title === 'string' && convo.title.trim()) || 'ChatGPT conversation'
    msgs.forEach((m, i) => {
      const created = m.time ? new Date(m.time * 1000).toISOString() : undefined
      items.push({
        title: (msgs.length > 1 ? `${convoTitle} (message ${i + 1})` : convoTitle).slice(0, 160),
        content: m.text,
        description: '',
        category: '',
        tags: ['chatgpt-import'],
        platform: 'ChatGPT',
        notes: `Imported from ChatGPT conversation "${convoTitle}".`,
        version: '',
        favorite: false,
        createdAt: created,
        updatedAt: created,
      })
    })
  })
  return { kind: 'chatgpt', items, errors }
}

export function parseJson(text: string, opts: JsonOptions = {}): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(normalizeNewlines(text))
  } catch (e) {
    return { kind: 'json', items: [], errors: [`This is not valid JSON: ${(e as Error).message}`] }
  }

  // Versioned backup file
  if (data && typeof data === 'object' && !Array.isArray(data) && (data as Record<string, unknown>).format === BACKUP_FORMAT) {
    return parseBackupObject(data as Record<string, unknown>)
  }

  let list: unknown[] | null = null
  if (Array.isArray(data)) list = data
  else if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).prompts)) list = (data as { prompts: unknown[] }).prompts

  if (!list) {
    return { kind: 'json', items: [], errors: ['Expected a JSON array of prompt objects, or an object with a "prompts" array. See the format shown on this page.'] }
  }
  if (list.length && list.every((x) => x && typeof x === 'object' && 'mapping' in (x as object))) {
    return extractChatGpt(list, opts.minChars ?? 80)
  }

  const items: ParsedPrompt[] = []
  const errors: string[] = []
  list.forEach((entry, i) => {
    if (typeof entry === 'string') {
      if (entry.trim()) items.push({ title: fallbackTitle(entry), content: entry, description: '', category: '', tags: [], platform: '', notes: '', version: '', favorite: false })
      else errors.push(`Item ${i + 1} is empty.`)
      return
    }
    if (!entry || typeof entry !== 'object') {
      errors.push(`Item ${i + 1} is not a prompt object.`)
      return
    }
    const p = objectToParsed(entry as Record<string, unknown>)
    if (p) items.push(p)
    else errors.push(`Item ${i + 1} has no "content" text, so it was skipped.`)
  })
  return { kind: 'json', items, errors }
}

/* ------------------------------------------------------------------ */
/* Backup validation                                                   */
/* ------------------------------------------------------------------ */

function parseBackupObject(o: Record<string, unknown>): ParseResult {
  const errors: string[] = []
  const version = o.version
  if (typeof version !== 'number') {
    return { kind: 'backup', items: [], errors: ['Backup is missing a numeric "version" field.'] }
  }
  if (version > BACKUP_VERSION) {
    return { kind: 'backup', items: [], errors: [`This backup uses format version ${version}, which is newer than this app understands (version ${BACKUP_VERSION}). Update the app before restoring.`] }
  }
  if (!Array.isArray(o.prompts)) {
    return { kind: 'backup', items: [], errors: ['Backup is missing its "prompts" list.'] }
  }
  const items: ParsedPrompt[] = []
  o.prompts.forEach((raw, i) => {
    const p = coercePrompt(raw)
    if (!p) {
      errors.push(`Prompt ${i + 1} in the backup has no content and was skipped.`)
      return
    }
    items.push({
      id: p.id,
      title: p.title,
      content: p.content,
      description: p.description,
      category: p.category,
      tags: p.tags,
      platform: p.platform,
      notes: p.notes,
      version: p.version,
      favorite: p.favorite,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lastUsedAt: p.lastUsedAt,
    })
  })
  const categories = Array.isArray(o.categories) ? o.categories.filter((c): c is string => typeof c === 'string' && !!c.trim()) : []
  return { kind: 'backup', items, errors, categories }
}

/** Validates a backup file without importing anything. */
export function validateBackup(text: string): { ok: boolean; result: ParseResult } {
  const result = parseJson(text)
  return { ok: result.kind === 'backup' && result.items.length > 0, result }
}

/* ------------------------------------------------------------------ */
/* Review step: duplicates and commit                                  */
/* ------------------------------------------------------------------ */

export interface ImportCandidate extends ParsedPrompt {
  key: string
  selected: boolean
  dup: DupResult
  /** Text describing where the duplicate lives. */
  dupLabel: string
  /** Existing prompt with the same id (backups only). */
  idConflict?: Prompt
  /** Explicit opt-in: replace the existing prompt that has the same id. */
  overwrite: boolean
}

export function buildCandidates(parsed: ParsedPrompt[], existing: Prompt[], defaultCategory: string): ImportCandidate[] {
  const idx = buildDupIndex(existing)
  const byId = new Map(existing.map((p) => [p.id, p]))
  const seenInBatch = new Map<string, string>()
  return parsed.map((p) => {
    let dup = findDuplicate(p.title, p.content, idx)
    let dupLabel = dup.match ? `"${dup.match.title}"` : ''
    const norm = normalizeForCompare(p.content)
    if (dup.kind !== 'exact' && seenInBatch.has(norm)) {
      dup = { kind: 'exact' }
      dupLabel = `"${seenInBatch.get(norm)}" (earlier in this import)`
    }
    if (!seenInBatch.has(norm)) seenInBatch.set(norm, p.title)
    const idConflict = p.id ? byId.get(p.id) : undefined
    return {
      ...p,
      key: uid(),
      category: p.category || defaultCategory || UNCATEGORIZED,
      // Exact and near duplicates are skipped by default; the user can opt in.
      selected: dup.kind !== 'exact' && dup.kind !== 'similar',
      dup,
      dupLabel,
      idConflict,
      overwrite: false,
    }
  })
}

export interface ImportSummary {
  imported: number
  overwritten: number
  skippedDuplicates: number
  notSelected: number
  errors: string[]
  newCategories: string[]
}

/** Pure function: returns the new prompt list. Existing prompts are never removed. */
export function commitCandidates(
  cands: ImportCandidate[],
  existing: Prompt[],
  existingCategories: string[],
  parseErrors: string[] = [],
  now = nowIso(),
): { prompts: Prompt[]; summary: ImportSummary } {
  const list = [...existing]
  const ids = new Set(existing.map((p) => p.id))
  const known = new Set(existingCategories.map((c) => c.toLowerCase()))
  const summary: ImportSummary = { imported: 0, overwritten: 0, skippedDuplicates: 0, notSelected: 0, errors: [...parseErrors], newCategories: [] }

  for (const c of cands) {
    if (!c.selected) {
      if (c.dup.kind === 'exact' || c.dup.kind === 'similar') summary.skippedDuplicates++
      else summary.notSelected++
      continue
    }
    if (!c.content.trim()) {
      summary.errors.push(`"${c.title || 'Untitled'}" has no content and was not imported.`)
      continue
    }
    const category = c.category.trim() || UNCATEGORIZED
    if (!known.has(category.toLowerCase())) {
      known.add(category.toLowerCase())
      summary.newCategories.push(category)
    }
    const base = {
      title: c.title.trim() || fallbackTitle(c.content),
      content: c.content,
      description: c.description,
      category,
      tags: c.tags,
      platform: c.platform,
      notes: c.notes,
      version: c.version,
      favorite: c.favorite,
    }
    if (c.overwrite && c.idConflict) {
      const i = list.findIndex((p) => p.id === c.idConflict!.id)
      if (i >= 0) {
        list[i] = { ...list[i], ...base, updatedAt: now, isDemo: undefined }
        summary.overwritten++
        continue
      }
    }
    const id = c.id && !ids.has(c.id) ? c.id : uid()
    ids.add(id)
    const created = c.createdAt ?? now
    list.push({ id, ...base, createdAt: created, updatedAt: c.updatedAt ?? created, lastUsedAt: c.lastUsedAt ?? null })
    summary.imported++
  }
  return { prompts: list, summary }
}
