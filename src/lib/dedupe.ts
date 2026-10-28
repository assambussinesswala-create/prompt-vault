import type { Prompt } from './types'

export type DupKind = 'exact' | 'similar' | 'title' | null

export interface DupResult {
  kind: DupKind
  match?: Prompt
  /** 0..1, only for "similar" */
  score?: number
}

export const normalizeForCompare = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

function shingles(s: string, n = 3): Set<string> {
  const words = normalizeForCompare(s).split(' ').filter(Boolean)
  const out = new Set<string>()
  if (words.length <= n) {
    out.add(words.join(' '))
    return out
  }
  for (let i = 0; i <= words.length - n; i++) out.add(words.slice(i, i + n).join(' '))
  return out
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  const [small, big] = a.size < b.size ? [a, b] : [b, a]
  small.forEach((x) => {
    if (big.has(x)) inter++
  })
  return inter / (a.size + b.size - inter)
}

export interface DupIndex {
  byContent: Map<string, Prompt>
  byTitle: Map<string, Prompt>
  shingles: { p: Prompt; s: Set<string> }[]
}

export function buildDupIndex(existing: Prompt[]): DupIndex {
  const byContent = new Map<string, Prompt>()
  const byTitle = new Map<string, Prompt>()
  const sh: DupIndex['shingles'] = []
  for (const p of existing) {
    byContent.set(normalizeForCompare(p.content), p)
    byTitle.set(normalizeForCompare(p.title), p)
    sh.push({ p, s: shingles(p.content) })
  }
  return { byContent, byTitle, shingles: sh }
}

export const SIMILAR_THRESHOLD = 0.85

/** Looks for an exact copy, a near-copy (85%+ overlap) or a prompt with the same title. */
export function findDuplicate(title: string, content: string, idx: DupIndex): DupResult {
  const exact = idx.byContent.get(normalizeForCompare(content))
  if (exact) return { kind: 'exact', match: exact }
  const mine = shingles(content)
  let best: { p: Prompt; score: number } | null = null
  for (const e of idx.shingles) {
    const sc = jaccard(mine, e.s)
    if (sc >= SIMILAR_THRESHOLD && (!best || sc > best.score)) best = { p: e.p, score: sc }
  }
  if (best) return { kind: 'similar', match: best.p, score: best.score }
  const t = idx.byTitle.get(normalizeForCompare(title))
  if (t) return { kind: 'title', match: t }
  return { kind: null }
}
