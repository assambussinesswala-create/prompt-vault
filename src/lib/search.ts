import type { Prompt, SortMode } from './types'

export interface Filters {
  q: string
  category: string
  tag: string
  platform: string
  favoritesOnly: boolean
}

export const EMPTY_FILTERS: Filters = { q: '', category: '', tag: '', platform: '', favoritesOnly: false }

export function haystack(p: Prompt): string {
  return [p.title, p.content, p.description, p.category, p.tags.join(' '), p.platform, p.notes].join('\n').toLowerCase()
}

/** Every word typed must appear somewhere in the prompt (case-insensitive). */
export function matchesQuery(hay: string, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  return terms.every((t) => hay.includes(t))
}

export function sortPrompts(list: Prompt[], sort: SortMode): Prompt[] {
  const copy = [...list]
  const t = (s: string) => new Date(s).getTime() || 0
  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => t(a.createdAt) - t(b.createdAt))
    case 'edited':
      return copy.sort((a, b) => t(b.updatedAt) - t(a.updatedAt))
    case 'alpha':
      return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }))
    default:
      return copy.sort((a, b) => t(b.createdAt) - t(a.createdAt))
  }
}

export function filterPrompts(
  prompts: Prompt[],
  f: Filters,
  sort: SortMode,
  hays?: Map<string, string>,
): Prompt[] {
  const out = prompts.filter((p) => {
    if (f.favoritesOnly && !p.favorite) return false
    if (f.category && p.category !== f.category) return false
    if (f.platform && p.platform.toLowerCase() !== f.platform.toLowerCase()) return false
    if (f.tag && !p.tags.some((t) => t.toLowerCase() === f.tag.toLowerCase())) return false
    if (f.q.trim()) {
      const h = hays?.get(p.id) ?? haystack(p)
      if (!matchesQuery(h, f.q)) return false
    }
    return true
  })
  return sortPrompts(out, sort)
}

export function relatedPrompts(target: Prompt, all: Prompt[], limit = 4): Prompt[] {
  const tags = new Set(target.tags.map((t) => t.toLowerCase()))
  return all
    .filter((p) => p.id !== target.id)
    .map((p) => {
      const shared = p.tags.filter((t) => tags.has(t.toLowerCase())).length
      const score = shared * 2 + (p.category === target.category ? 1 : 0)
      return { p, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.p.updatedAt).getTime() - new Date(a.p.updatedAt).getTime())
    .slice(0, limit)
    .map((x) => x.p)
}
