import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, CheckSquare, Clock, Download, LayoutGrid, Library, List, Plus, SearchX, Star, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { PromptCard } from '../components/PromptCard'
import { useToast } from '../components/Toast'
import { backupToJson, promptsToMarkdown } from '../lib/exporters'
import { filterPrompts, haystack, sortPrompts } from '../lib/search'
import type { SortMode } from '../lib/types'
import { datestamp, downloadFile } from '../lib/util'
import { useVault } from '../store/VaultContext'

export type ListMode = 'all' | 'favorites' | 'recent'
const TITLES: Record<ListMode, string> = { all: 'All Prompts', favorites: 'Favorites', recent: 'Recently Used' }

export default function Prompts({ mode }: { mode: ListMode }) {
  const { prompts, categories, settings, updateSettings, deletePrompts, markBackupDone } = useVault()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const tag = params.get('tag') ?? ''
  const platform = params.get('platform') ?? ''
  const sort = (params.get('sort') as SortMode) || settings.defaultSort
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const hays = useMemo(() => new Map(prompts.map((p) => [p.id, haystack(p)])), [prompts])
  const allTags = useMemo(() => [...new Set(prompts.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b)), [prompts])
  const allPlatforms = useMemo(() => [...new Set(prompts.map((p) => p.platform).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [prompts])

  const base = useMemo(() => {
    if (mode === 'recent') return prompts.filter((p) => p.lastUsedAt)
    return prompts
  }, [prompts, mode])

  const results = useMemo(() => {
    const out = filterPrompts(base, { q, category, tag, platform, favoritesOnly: mode === 'favorites' }, sort, hays)
    if (mode === 'recent') return out.sort((a, b) => +new Date(b.lastUsedAt!) - +new Date(a.lastUsedAt!))
    return out
  }, [base, q, category, tag, platform, sort, mode, hays])

  const hasFilters = !!(q || category || tag || platform)
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n, { replace: true })
  }
  const clear = () => setParams(new URLSearchParams(), { replace: true })
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const chosen = results.filter((p) => selected.has(p.id))
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  const exportJson = () => {
    downloadFile(`prompt-vault-selected-${datestamp()}.json`, backupToJson(chosen, categories.map((c) => c.name)), 'application/json')
    toast(`Exported ${chosen.length} prompt${chosen.length === 1 ? '' : 's'} as JSON`)
  }
  const exportMd = () => {
    downloadFile(`prompt-vault-selected-${datestamp()}.md`, promptsToMarkdown(sortPrompts(chosen, 'alpha')), 'text/markdown')
    toast(`Exported ${chosen.length} prompt${chosen.length === 1 ? '' : 's'} as Markdown`)
  }

  const heading = category && mode === 'all' ? category : TITLES[mode]
  const select = 'field !w-auto !py-1.5 text-[13px]'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{heading}</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {results.length} {results.length === 1 ? 'prompt' : 'prompts'}
            {hasFilters ? ` match${results.length === 1 ? 'es' : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`btn btn-sm ${selecting ? '!border-brass' : ''}`} onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting}>
            <CheckSquare className="h-3.5 w-3.5" /> {selecting ? 'Done selecting' : 'Select'}
          </button>
          <div className="flex rounded-lg border border-line" role="group" aria-label="Layout">
            <button className={`icon-btn !h-8 !w-8 ${settings.viewMode === 'grid' ? '!bg-raised !text-fg' : ''}`} onClick={() => updateSettings({ viewMode: 'grid' })} aria-label="Card layout" aria-pressed={settings.viewMode === 'grid'}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button className={`icon-btn !h-8 !w-8 ${settings.viewMode === 'list' ? '!bg-raised !text-fg' : ''}`} onClick={() => updateSettings({ viewMode: 'list' })} aria-label="Compact list layout" aria-pressed={settings.viewMode === 'list'}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <select className={select} value={category} onChange={(e) => setParam('category', e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <select className={select} value={platform} onChange={(e) => setParam('platform', e.target.value)} aria-label="Filter by platform">
          <option value="">All platforms</option>
          {allPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={select} value={tag} onChange={(e) => setParam('tag', e.target.value)} aria-label="Filter by tag">
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </select>
        <select className={select} value={mode === 'recent' ? 'used' : sort} disabled={mode === 'recent'} onChange={(e) => setParam('sort', e.target.value)} aria-label="Sort prompts">
          {mode === 'recent' ? (
            <option value="used">Last used</option>
          ) : (
            <>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="edited">Recently edited</option>
              <option value="alpha">A to Z</option>
            </>
          )}
        </select>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clear}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {selecting && (
        <div className="surface sticky top-[68px] z-20 mb-4 flex flex-wrap items-center gap-2 px-3 py-2.5 shadow-lg">
          <span className="mr-auto text-sm">{chosen.length} selected</span>
          <button className="btn btn-sm" onClick={() => setSelected(new Set(results.map((p) => p.id)))}>Select all {results.length}</button>
          <button className="btn btn-sm" onClick={() => setSelected(new Set())} disabled={!chosen.length}>Clear</button>
          <button className="btn btn-sm" disabled={!chosen.length} onClick={() => { exportJson(); markBackupDone() }}><Download className="h-3.5 w-3.5" /> JSON</button>
          <button className="btn btn-sm" disabled={!chosen.length} onClick={exportMd}><Download className="h-3.5 w-3.5" /> Markdown</button>
          <button className="btn btn-sm btn-danger" disabled={!chosen.length} onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>
      )}

      {prompts.length === 0 ? (
        <EmptyState icon={<Library className="h-6 w-6" />} title="No prompts yet" actions={<Link to="/new" className="btn btn-primary"><Plus className="h-4 w-4" /> New Prompt</Link>}>
          Write a prompt or import old ones to fill your vault.
        </EmptyState>
      ) : results.length === 0 ? (
        mode === 'favorites' && !hasFilters ? (
          <EmptyState icon={<Star className="h-6 w-6" />} title="No favorites yet">Tap the star on any prompt to keep it here for quick access.</EmptyState>
        ) : mode === 'recent' && !hasFilters ? (
          <EmptyState icon={<Clock className="h-6 w-6" />} title="Nothing used yet">Copy a prompt and it will appear here with the date you last used it.</EmptyState>
        ) : (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No prompts match"
            actions={<button className="btn" onClick={clear}>Clear filters</button>}
          >
            {q ? <>Nothing found for “{q}”. Check the spelling, try fewer words, or clear the filters.</> : 'Try removing a filter to see more prompts.'}
          </EmptyState>
        )
      ) : (
        <div className={settings.viewMode === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>
          {results.map((p) => (
            <PromptCard key={p.id} prompt={p} variant={settings.viewMode} selecting={selecting} selected={selected.has(p.id)} onToggleSelect={toggle} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${chosen.length} prompt${chosen.length === 1 ? '' : 's'}?`}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deletePrompts(chosen.map((p) => p.id))
          toast(`Deleted ${chosen.length} prompt${chosen.length === 1 ? '' : 's'}`, 'info')
          setConfirmDelete(false)
          stopSelecting()
        }}
      >
        <p>This permanently removes the selected prompts from this browser. <Archive className="inline h-3.5 w-3.5" /> Export a backup first if you might need them again.</p>
      </ConfirmDialog>
    </div>
  )
}
