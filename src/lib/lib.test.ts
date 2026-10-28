import { describe, expect, it } from 'vitest'
import { buildCandidates, commitCandidates, detectSplitMode, parseJson, parseText, splitText, validateBackup } from './importers'
import { backupToJson, promptToMarkdown, promptToTxt } from './exporters'
import { filterPrompts, matchesQuery, relatedPrompts } from './search'
import { findDuplicate, buildDupIndex } from './dedupe'
import { makeDemoPrompts } from './demo'
import { normalizeTags } from './util'
import type { Prompt } from './types'

const P = (o: Partial<Prompt>): Prompt => ({
  id: o.id ?? 'x', title: 'T', content: 'C body', description: '', category: 'Uncategorized', tags: [], platform: '',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastUsedAt: null, favorite: false, notes: '', version: '', ...o,
})

describe('text import', () => {
  const text = 'First prompt\nline two\n\n--- PROMPT BREAK ---\n\nTitle: Second\nBody of second\n  indented line\n\n--- prompt break ---\nThird one only'
  it('splits on the separator', () => {
    expect(detectSplitMode(text)).toBe('separator')
    const r = parseText(text, 'separator')
    expect(r.items).toHaveLength(3)
    expect(r.items[0].title).toBe('First prompt')
    expect(r.items[0].content).toBe('First prompt\nline two')
    expect(r.items[1].title).toBe('Second')
    expect(r.items[1].content).toBe('Body of second\n  indented line')
    expect(r.items[2].content).toBe('Third one only')
  })
  it('splits on markdown headings and keeps fenced code intact', () => {
    const md = '# My prompts\n\n## One\nHello\n```\n## not a heading\n```\n\n## Two\nWorld\n'
    expect(detectSplitMode(md)).toBe('headings')
    const r = parseText(md, 'headings')
    expect(r.items.map((i) => i.title)).toEqual(['One', 'Two'])
    expect(r.items[0].content).toContain('## not a heading')
  })
  it('preserves CRLF-normalised content, emoji and markdown exactly', () => {
    const c = '🚀 Heading\r\n1. step\r\n2. step\r\n```js\r\nconst a = 1\r\n```'
    const r = parseText(c, 'single')
    expect(r.items[0].content).toBe(c.replace(/\r\n/g, '\n'))
  })
  it('supports custom separator, hr and blank modes', () => {
    expect(splitText('a\n===\nb', 'custom', '===')).toEqual(['a', 'b'])
    expect(splitText('a\n---\nb', 'rules')).toEqual(['a', 'b'])
    expect(splitText('a\n\n\nb', 'blank')).toEqual(['a', 'b'])
  })
  it('reports empty input', () => {
    expect(parseText('   ', 'single').errors.length).toBe(1)
  })
})

describe('json import', () => {
  it('imports an array with aliases and reports bad items', () => {
    const r = parseJson(JSON.stringify([{ title: 'A', prompt: 'hello', tags: 'x, y', tool: 'Claude' }, { title: 'bad' }, 'plain string prompt', 5]))
    expect(r.items).toHaveLength(2)
    expect(r.items[0].tags).toEqual(['x', 'y'])
    expect(r.items[0].platform).toBe('Claude')
    expect(r.errors).toHaveLength(2)
  })
  it('reports invalid JSON', () => {
    expect(parseJson('{oops').errors[0]).toMatch(/not valid JSON/)
  })
  it('extracts user messages from a ChatGPT export', () => {
    const convo = [{ title: 'Trip', mapping: {
      a: { message: { author: { role: 'user' }, content: { parts: ['x'.repeat(100)] }, create_time: 10 } },
      b: { message: { author: { role: 'assistant' }, content: { parts: ['reply'.repeat(30)] }, create_time: 11 } },
      c: { message: { author: { role: 'user' }, content: { parts: ['short'] }, create_time: 12 } },
    } }]
    const r = parseJson(JSON.stringify(convo))
    expect(r.kind).toBe('chatgpt')
    expect(r.items).toHaveLength(1)
    expect(r.items[0].platform).toBe('ChatGPT')
  })
})

describe('backup round trip', () => {
  it('exports and validates a versioned backup', () => {
    const prompts = [P({ id: 'a', title: 'A', content: 'Line1\n\nLine3 🚀' }), P({ id: 'b', title: 'B', content: 'other' })]
    const json = backupToJson(prompts, ['Uncategorized'])
    const v = validateBackup(json)
    expect(v.ok).toBe(true)
    expect(v.result.items).toHaveLength(2)
    expect(v.result.items[0].content).toBe('Line1\n\nLine3 🚀')
  })
  it('rejects newer versions and broken files', () => {
    expect(validateBackup(JSON.stringify({ format: 'prompt-vault-backup', version: 99, prompts: [] })).ok).toBe(false)
    expect(validateBackup(JSON.stringify({ format: 'prompt-vault-backup', version: 1 })).ok).toBe(false)
    expect(validateBackup('nope').ok).toBe(false)
  })
  it('restoring never removes existing prompts and flags duplicates', () => {
    const existing = [P({ id: 'a', title: 'A', content: 'same text' }), P({ id: 'z', title: 'Z', content: 'keep me' })]
    const backup = validateBackup(backupToJson([P({ id: 'a', title: 'A', content: 'same text' }), P({ id: 'n', title: 'N', content: 'brand new' })], ['Uncategorized'])).result
    const cands = buildCandidates(backup.items, existing, '')
    expect(cands[0].dup.kind).toBe('exact')
    expect(cands[0].selected).toBe(false)
    expect(cands[1].selected).toBe(true)
    const { prompts, summary } = commitCandidates(cands, existing, ['Uncategorized'])
    expect(prompts).toHaveLength(3)
    expect(prompts.find((p) => p.id === 'z')).toBeTruthy()
    expect(summary).toMatchObject({ imported: 1, skippedDuplicates: 1, overwritten: 0 })
  })
  it('overwrite only happens when explicitly opted in', () => {
    const existing = [P({ id: 'a', title: 'A', content: 'old text here' })]
    const parsed = [{ id: 'a', title: 'A2', content: 'new text there', description: '', category: '', tags: [], platform: '', notes: '', version: '', favorite: false }]
    let c = buildCandidates(parsed, existing, '')
    expect(c[0].idConflict).toBeTruthy()
    let r = commitCandidates(c, existing, [])
    expect(r.prompts).toHaveLength(2)
    expect(r.prompts[0].content).toBe('old text here')
    c = buildCandidates(parsed, existing, '')
    c[0].overwrite = true
    r = commitCandidates(c, existing, [])
    expect(r.prompts).toHaveLength(1)
    expect(r.prompts[0].content).toBe('new text there')
    expect(r.summary.overwritten).toBe(1)
  })
  it('detects duplicates inside one import batch and creates new categories', () => {
    const parsed = [
      { title: 'A', content: 'dup text', description: '', category: 'Fresh Cat', tags: [], platform: '', notes: '', version: '', favorite: false },
      { title: 'B', content: 'dup   TEXT', description: '', category: '', tags: [], platform: '', notes: '', version: '', favorite: false },
    ]
    const c = buildCandidates(parsed, [], '')
    expect(c[1].dup.kind).toBe('exact')
    const { summary } = commitCandidates(c, [], ['Uncategorized'])
    expect(summary.imported).toBe(1)
    expect(summary.skippedDuplicates).toBe(1)
    expect(summary.newCategories).toEqual(['Fresh Cat'])
  })
})

describe('duplicates', () => {
  it('finds exact, similar and same-title', () => {
    const base = 'one two three four five six seven eight nine ten eleven twelve'
    const idx = buildDupIndex([P({ id: '1', title: 'Alpha', content: base })])
    expect(findDuplicate('x', '  ONE two three four five six seven eight nine ten eleven twelve ', idx).kind).toBe('exact')
    expect(findDuplicate('x', base + ' thirteen', idx).kind).toBe('similar')
    expect(findDuplicate('alpha', 'completely different', idx).kind).toBe('title')
    expect(findDuplicate('beta', 'completely different', idx).kind).toBe(null)
  })
})

describe('search and export', () => {
  const list = [
    P({ id: '1', title: 'Chai video', content: 'steam rising', tags: ['video'], category: 'AI Video Generation', platform: 'Google Flow', favorite: true }),
    P({ id: '2', title: 'Urdu lesson', content: 'teach me', tags: ['video', 'lesson'], category: 'AI Video Generation' }),
    P({ id: '3', title: 'Thumbnail', content: 'bold text', tags: [], category: 'Image Generation', platform: 'ChatGPT' }),
  ]
  it('searches case-insensitively across fields', () => {
    expect(filterPrompts(list, { q: 'CHAI', category: '', tag: '', platform: '', favoritesOnly: false }, 'alpha').map((p) => p.id)).toEqual(['1'])
    expect(filterPrompts(list, { q: 'google flow', category: '', tag: '', platform: '', favoritesOnly: false }, 'alpha').map((p) => p.id)).toEqual(['1'])
    expect(filterPrompts(list, { q: '', category: '', tag: 'LESSON', platform: '', favoritesOnly: false }, 'alpha').map((p) => p.id)).toEqual(['2'])
    expect(filterPrompts(list, { q: '', category: '', tag: '', platform: '', favoritesOnly: true }, 'alpha')).toHaveLength(1)
    expect(matchesQuery('hello world', 'world hello')).toBe(true)
  })
  it('finds related prompts by shared tags or category', () => {
    expect(relatedPrompts(list[0], list).map((p) => p.id)).toEqual(['2'])
  })
  it('exports text exactly and markdown with metadata', () => {
    const p = P({ title: 'Hi', content: '  keep\n\n  spacing  ' })
    expect(promptToTxt(p)).toBe('  keep\n\n  spacing  ')
    expect(promptToMarkdown(p)).toContain('## Prompt\n\n  keep\n\n  spacing  ')
  })
  it('demo prompts are flagged and tags normalise', () => {
    expect(makeDemoPrompts().every((p) => p.isDemo)).toBe(true)
    expect(normalizeTags('#a, b ,A,,c')).toEqual(['a', 'b', 'c'])
  })
})
