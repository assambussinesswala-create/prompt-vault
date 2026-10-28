import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Copy, ExternalLink, Globe, Link2, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { ConfirmDialog, Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { errorMessage, useApi, useLinks } from '../lib/api'
import { hostOf, isSafeHref, matches, normalizeUrl, sortItems, type SaverSort, type SavedLink } from '../lib/saver'
import { copyText, formatDate } from '../lib/util'

interface FormState {
  title: string
  url: string
  description: string
  category: string
}
const EMPTY: FormState = { title: '', url: '', description: '', category: '' }

function LinkForm({ link, categories, onClose, onSaved }: { link: SavedLink | null; categories: string[]; onClose: () => void; onSaved: (l: SavedLink, isNew: boolean) => void }) {
  const api = useApi()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(link ? { title: link.title, url: link.url, description: link.description, category: link.category } : EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy.current) return
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.title.trim()) errs.title = 'Enter a title.'
    if (!form.url.trim()) errs.url = 'Enter the website address.'
    else if (!normalizeUrl(form.url)) errs.url = 'This is not a valid web address. Use something like https://example.com'
    setErrors(errs)
    setFormError('')
    if (Object.keys(errs).length) return
    busy.current = true
    setSaving(true)
    try {
      const body = { title: form.title, url: form.url, description: form.description, category: form.category }
      const res = link
        ? await api<{ link: SavedLink }>(`/api/links?id=${encodeURIComponent(link.id)}`, { method: 'PUT', body })
        : await api<{ link: SavedLink }>('/api/links', { method: 'POST', body })
      toast(link ? 'Link updated' : 'Link saved')
      onSaved(res.link, !link)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  return (
    <Modal open title={link ? 'Edit link' : 'Add a link'} onClose={onClose} wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <div role="alert" className="alert-error">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <p>{formError}</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="l-title">Title</label>
          <input id="l-title" className="field" value={form.title} onChange={set('title')} maxLength={200} data-autofocus aria-invalid={!!errors.title} aria-describedby={errors.title ? 'l-title-err' : undefined} />
          {errors.title && <p id="l-title-err" className="mt-1 text-xs text-danger">{errors.title}</p>}
        </div>
        <div>
          <label className="label" htmlFor="l-url">Website URL</label>
          <input id="l-url" className="field" inputMode="url" autoComplete="off" placeholder="https://example.com" value={form.url} onChange={set('url')} maxLength={2048} aria-invalid={!!errors.url} aria-describedby={errors.url ? 'l-url-err' : undefined} />
          {errors.url && <p id="l-url-err" className="mt-1 text-xs text-danger">{errors.url}</p>}
        </div>
        <div>
          <label className="label" htmlFor="l-desc">Description <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="l-desc" className="field min-h-[84px]" value={form.description} onChange={set('description')} maxLength={2000} />
        </div>
        <div>
          <label className="label" htmlFor="l-cat">Category <span className="font-normal text-muted">(optional)</span></label>
          <input id="l-cat" className="field" list="link-categories" value={form.category} onChange={set('category')} maxLength={60} placeholder="For example: Work, Learning, Tools" />
          <datalist id="link-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {saving ? 'Saving…' : link ? 'Save changes' : 'Save link'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function LinksPage() {
  const api = useApi()
  const toast = useToast()
  const { items: links, setItems, status, error, reload } = useLinks()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<SaverSort>('newest')
  const [editing, setEditing] = useState<SavedLink | 'new' | null>(null)
  const [deleting, setDeleting] = useState<SavedLink | null>(null)
  const deleteBusy = useRef(false)

  // "?new=1" (from the dashboard's quick action) opens the Add dialog once.
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing('new')
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const categories = useMemo(() => [...new Set(links.map((l) => l.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [links])
  const visible = useMemo(
    () => sortItems(links.filter((l) => (!category || l.category === category) && matches([l.title, l.url, l.description], q)), sort, (l) => l.title),
    [links, category, q, sort],
  )

  const onSaved = (l: SavedLink, isNew: boolean) => {
    setItems((cur) => (isNew ? [l, ...cur] : cur.map((x) => (x.id === l.id ? l : x))))
    setEditing(null)
  }

  const doDelete = async () => {
    if (!deleting || deleteBusy.current) return
    deleteBusy.current = true
    const target = deleting
    try {
      await api(`/api/links?id=${encodeURIComponent(target.id)}`, { method: 'DELETE' })
      setItems((cur) => cur.filter((x) => x.id !== target.id))
      toast('Link deleted')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      deleteBusy.current = false
      setDeleting(null)
    }
  }

  const copyUrl = async (l: SavedLink) => {
    const ok = await copyText(l.url)
    toast(ok ? 'URL copied' : 'Copy failed. Select the address and copy it manually.', ok ? 'success' : 'error')
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Link Saver</h1>
          <p className="mt-1 text-muted" aria-live="polite">
            {status === 'ready' ? `${links.length} saved ${links.length === 1 ? 'link' : 'links'}` : 'Keep every important website in one place.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Add link
        </button>
      </div>

      {status === 'loading' && (
        <div className="surface flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your links…
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="alert-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Your links could not be loaded.</p>
            <p className="text-muted">{error}</p>
          </div>
          <button className="btn btn-sm" onClick={() => void reload()}>Try again</button>
        </div>
      )}

      {status === 'ready' && links.length === 0 && (
        <EmptyState
          icon={<Link2 className="h-6 w-6" />}
          title="No saved links yet"
          actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add your first link</button>}
        >
          Save the websites you come back to often, then find them again by title, address or category.
        </EmptyState>
      )}

      {status === 'ready' && links.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_190px_170px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" className="field pl-9" placeholder="Search title, URL or description" aria-label="Search links" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="field" aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className="field" aria-label="Sort links" value={sort} onChange={(e) => setSort(e.target.value as SaverSort)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="alpha">Title A to Z</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={<Search className="h-6 w-6" />} title="No links match" actions={<button className="btn" onClick={() => { setQ(''); setCategory('') }}>Clear search and filters</button>}>
              Try a different word, or clear the filters.
            </EmptyState>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">Showing {visible.length} of {links.length}</p>
              <ul className="space-y-3">
                {visible.map((l) => (
                  <li key={l.id} className="surface p-4">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-raised text-brass" aria-hidden>
                        <Globe className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words font-display text-base font-bold">{l.title}</h2>
                          {l.category && <span className="chip">{l.category}</span>}
                        </div>
                        <p className="break-all text-sm text-muted">{hostOf(l.url)}</p>
                        {l.description && <p className="mt-1.5 line-clamp-2 break-words text-sm">{l.description}</p>}
                        <p className="mt-1.5 text-xs text-muted">Saved {formatDate(l.createdAt)}{l.updatedAt !== l.createdAt ? ` · Updated ${formatDate(l.updatedAt)}` : ''}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      {isSafeHref(l.url) && (
                        <a className="btn btn-sm" href={l.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> Open<span className="sr-only"> {l.title} in a new tab</span>
                        </a>
                      )}
                      <button className="btn btn-sm" onClick={() => void copyUrl(l)} aria-label={`Copy URL for ${l.title}`}>
                        <Copy className="h-3.5 w-3.5" /> Copy URL
                      </button>
                      <div className="flex-1" />
                      <button className="btn btn-sm" onClick={() => setEditing(l)} aria-label={`Edit ${l.title}`}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleting(l)} aria-label={`Delete ${l.title}`}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {editing && <LinkForm link={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} onSaved={onSaved} />}

      <ConfirmDialog open={!!deleting} title="Delete this link?" confirmLabel="Delete link" danger onConfirm={() => void doDelete()} onCancel={() => setDeleting(null)}>
        <p>
          “{deleting?.title}” will be permanently removed. This cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  )
}
