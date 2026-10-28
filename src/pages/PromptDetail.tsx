import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronDown, Copy, CopyPlus, Download, FileQuestion, Maximize2, Minimize2, Pencil, Star, Trash2 } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { DemoBadge } from '../components/PromptCard'
import { ConfirmDialog } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useCopyPrompt } from '../components/useCopy'
import { backupToJson, fileNameFor, promptToMarkdown, promptToTxt } from '../lib/exporters'
import { Markdown } from '../lib/markdown'
import { relatedPrompts } from '../lib/search'
import { downloadFile, formatDateTime, relativeTime } from '../lib/util'
import { useVault } from '../store/VaultContext'

const LONG_CHARS = 1500
const LONG_LINES = 24

export default function PromptDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const copy = useCopyPrompt()
  const { prompts, categories, getPrompt, toggleFavorite, duplicatePrompt, deletePrompts } = useVault()
  const p = prompts.find((x) => x.id === id) ?? getPrompt(id)
  const [expanded, setExpanded] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const related = useMemo(() => (p ? relatedPrompts(p, prompts) : []), [p, prompts])

  if (!p) {
    return (
      <EmptyState icon={<FileQuestion className="h-6 w-6" />} title="Prompt not found" actions={<Link to="/prompts" className="btn btn-primary">Back to the vault</Link>}>
        It may have been deleted, or the link is wrong.
      </EmptyState>
    )
  }

  const isLong = p.content.length > LONG_CHARS || p.content.split('\n').length > LONG_LINES
  const collapsed = isLong && !expanded
  const cat = categories.some((c) => c.name === p.category) ? p.category : 'Uncategorized'

  const exportAs = (kind: 'txt' | 'md' | 'json') => {
    if (kind === 'txt') downloadFile(fileNameFor(p, 'txt'), promptToTxt(p))
    else if (kind === 'md') downloadFile(fileNameFor(p, 'md'), promptToMarkdown(p), 'text/markdown')
    else downloadFile(fileNameFor(p, 'json'), backupToJson([p], categories.map((c) => c.name)), 'application/json')
    toast(`Exported as .${kind}`)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <div>
      <Link to="/prompts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to the vault
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title break-words">{p.title}</h1>
          {p.description && <p className="mt-1.5 max-w-2xl text-muted">{p.description}</p>}
        </div>
        <button
          className={`icon-btn border border-line ${p.favorite ? '!text-brass' : ''}`}
          onClick={() => toggleFavorite(p.id)}
          aria-pressed={p.favorite}
          aria-label={p.favorite ? 'Remove from favorites' : 'Add to favorites'}
          title={p.favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className="h-4 w-4" fill={p.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => copy(p)}><Copy className="h-4 w-4" /> Copy prompt</button>
        <Link to={`/edit/${p.id}`} className="btn"><Pencil className="h-4 w-4" /> Edit</Link>
        <button className="btn" onClick={() => { const c = duplicatePrompt(p.id); if (c) { toast('Duplicated. You are now viewing the copy.'); nav(`/prompt/${c.id}`) } }}>
          <CopyPlus className="h-4 w-4" /> Duplicate
        </button>
        <details className="relative">
          <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden"><Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" /></summary>
          <div className="surface absolute left-0 z-20 mt-1 w-56 p-1 shadow-xl">
            <button className="btn btn-ghost w-full !justify-start" onClick={() => exportAs('txt')}>Text file (.txt)</button>
            <button className="btn btn-ghost w-full !justify-start" onClick={() => exportAs('md')}>Markdown (.md)</button>
            <button className="btn btn-ghost w-full !justify-start" onClick={() => exportAs('json')}>JSON (importable)</button>
          </div>
        </details>
        <button className="btn btn-danger" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Delete</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <section aria-label="Prompt content" className="min-w-0">
          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <div className="flex rounded-lg border border-line text-xs" role="group" aria-label="Content view">
                <button className={`px-2.5 py-1 ${!rendered ? 'rounded-l-lg bg-raised font-medium' : 'text-muted'}`} onClick={() => setRendered(false)} aria-pressed={!rendered}>Exact text</button>
                <button className={`px-2.5 py-1 ${rendered ? 'rounded-r-lg bg-raised font-medium' : 'text-muted'}`} onClick={() => setRendered(true)} aria-pressed={rendered}>Markdown</button>
              </div>
              <span className="text-xs text-muted">{p.content.length.toLocaleString()} characters</span>
            </div>
            <div className={`relative px-4 py-4 ${collapsed ? 'max-h-[26rem] overflow-hidden' : ''}`}>
              {rendered ? <Markdown text={p.content} /> : <div className="prompt-text" data-testid="prompt-content">{p.content}</div>}
              {collapsed && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-panel to-transparent" />}
            </div>
            {isLong && (
              <div className="border-t border-line px-4 py-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
                  {expanded ? <><Minimize2 className="h-3.5 w-3.5" /> Collapse</> : <><Maximize2 className="h-3.5 w-3.5" /> Show full prompt</>}
                </button>
              </div>
            )}
          </div>

          {p.notes.trim() && (
            <div className="surface mt-4 px-4 py-3">
              <h2 className="mb-1 font-display text-sm font-bold">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-muted">{p.notes}</p>
            </div>
          )}
        </section>

        <aside className="space-y-5 text-sm">
          <dl className="surface divide-y divide-line">
            <div className="px-4 py-2.5">
              <dt className="text-xs text-muted">Category</dt>
              <dd><Link to={`/prompts?category=${encodeURIComponent(cat)}`} className="inline-flex items-center gap-1.5 hover:text-brass"><CategoryIcon name={cat} className="h-3.5 w-3.5" />{cat}</Link></dd>
            </div>
            <div className="px-4 py-2.5">
              <dt className="text-xs text-muted">AI platform</dt>
              <dd>{p.platform ? <Link to={`/prompts?platform=${encodeURIComponent(p.platform)}`} className="hover:text-brass">{p.platform}</Link> : <span className="text-muted">Not set</span>}</dd>
            </div>
            <div className="px-4 py-2.5">
              <dt className="text-xs text-muted">Tags</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {p.tags.length ? p.tags.map((t) => <Link key={t} to={`/prompts?tag=${encodeURIComponent(t)}`} className="chip hover:text-fg">#{t}</Link>) : <span className="text-muted">None</span>}
              </dd>
            </div>
            {p.version && (
              <div className="px-4 py-2.5"><dt className="text-xs text-muted">Version</dt><dd>{p.version}</dd></div>
            )}
            <div className="px-4 py-2.5">
              <dt className="flex items-center gap-1 text-xs text-muted"><Calendar className="h-3 w-3" /> Dates</dt>
              <dd className="mt-0.5 space-y-0.5 text-[13px]">
                <div>Added {formatDateTime(p.createdAt)}</div>
                <div>Edited {formatDateTime(p.updatedAt)}</div>
                <div>Last used {p.lastUsedAt ? `${relativeTime(p.lastUsedAt)}` : 'never'}</div>
              </dd>
            </div>
            {p.isDemo && <div className="px-4 py-2.5"><DemoBadge /> <span className="text-xs text-muted">sample prompt</span></div>}
          </dl>

          {related.length > 0 && (
            <section aria-labelledby="rel-h">
              <h2 id="rel-h" className="mb-2 font-display text-sm font-bold">Related prompts</h2>
              <ul className="surface divide-y divide-line overflow-hidden">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/prompt/${r.id}`} className="block px-4 py-2.5 transition-colors hover:bg-raised/60">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="block truncate text-xs text-muted">{r.category}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Delete this prompt?"
        confirmLabel="Delete prompt"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => { deletePrompts([p.id]); toast(`Deleted "${p.title}"`, 'info'); nav('/prompts', { replace: true }) }}
      >
        <p>“{p.title}” will be removed from this browser. This cannot be undone unless you have a backup.</p>
      </ConfirmDialog>
    </div>
  )
}
