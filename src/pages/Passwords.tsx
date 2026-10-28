import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, RefreshCw, Search, ShieldCheck, StickyNote, Trash2 } from 'lucide-react'
import { ConfirmDialog, Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { errorMessage, useApi, usePasswords } from '../lib/api'
import { generatePassword, hostOf, isSafeHref, matches, normalizeUrl, sortItems, type PasswordMeta, type SaverSort } from '../lib/saver'
import { copyText, formatDate } from '../lib/util'

const MASK = '••••••••••••'
const AUTO_HIDE_MS = 30_000

/** One labelled value with its own copy button. */
function ValueRow({ label, children, copyLabel, onCopy }: { label: string; children: ReactNode; copyLabel: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <span className="min-w-0 flex-1 break-all text-sm">{children}</span>
      <button className="icon-btn h-8 w-8 shrink-0" onClick={onCopy} aria-label={copyLabel} title={copyLabel}>
        <Copy className="h-4 w-4" />
      </button>
    </div>
  )
}

function EntryCard({ entry, onEdit, onDelete }: { entry: PasswordMeta; onEdit: () => void; onDelete: () => void }) {
  const api = useApi()
  const toast = useToast()
  const [shown, setShown] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState<string | null>(null)
  const [notesLoading, setNotesLoading] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const clearTimer = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current)
    timer.current = undefined
  }
  useEffect(() => clearTimer, [])

  const fetchSecret = useCallback(
    async (field: 'password' | 'notes'): Promise<string> => {
      const r = await api<{ value: string }>('/api/reveal', { method: 'POST', body: { id: entry.id, field } })
      return r.value
    },
    [api, entry.id],
  )

  const togglePassword = async () => {
    if (shown !== null) {
      clearTimer()
      setShown(null)
      return
    }
    setLoading(true)
    try {
      const value = await fetchSecret('password')
      setShown(value)
      clearTimer()
      timer.current = window.setTimeout(() => setShown(null), AUTO_HIDE_MS)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  const copyPlain = async (value: string, what: string) => {
    const ok = await copyText(value)
    toast(ok ? `${what} copied` : `Could not copy the ${what.toLowerCase()}. Select it and copy manually.`, ok ? 'success' : 'error')
  }

  const copyPassword = async () => {
    try {
      // The password is fetched, copied and immediately dropped. It is not kept in state.
      const ok = await copyText(await fetchSecret('password'))
      toast(ok ? 'Password copied' : 'Could not copy the password.', ok ? 'success' : 'error')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const toggleNotes = async () => {
    if (notes !== null) {
      setNotes(null)
      return
    }
    setNotesLoading(true)
    try {
      setNotes(await fetchSecret('notes'))
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setNotesLoading(false)
    }
  }

  return (
    <li className="surface p-4">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-raised text-brass" aria-hidden>
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-display text-base font-bold">{entry.siteName}</h2>
          <p className="break-all text-sm text-muted">{hostOf(entry.siteUrl)}</p>
        </div>
      </div>

      <div className="mt-3 divide-y divide-line rounded-lg border border-line px-3">
        <ValueRow label="Website" copyLabel={`Copy website URL for ${entry.siteName}`} onCopy={() => void copyPlain(entry.siteUrl, 'Website URL')}>
          <span className="text-muted">{entry.siteUrl}</span>
        </ValueRow>
        {entry.username && (
          <ValueRow label="Username" copyLabel={`Copy username for ${entry.siteName}`} onCopy={() => void copyPlain(entry.username, 'Username')}>
            {entry.username}
          </ValueRow>
        )}
        {entry.email && (
          <ValueRow label="Email" copyLabel={`Copy email for ${entry.siteName}`} onCopy={() => void copyPlain(entry.email, 'Email')}>
            {entry.email}
          </ValueRow>
        )}
        <div className="flex items-center gap-2 py-1.5">
          <span className="w-20 shrink-0 text-xs text-muted">Password</span>
          <span className={`min-w-0 flex-1 break-all text-sm ${shown !== null ? 'font-mono' : 'tracking-wider'}`} aria-live="polite">
            {shown !== null ? shown || '(empty)' : MASK}
          </span>
          <button className="icon-btn h-8 w-8 shrink-0" onClick={() => void togglePassword()} disabled={loading} aria-pressed={shown !== null} aria-label={shown !== null ? `Hide password for ${entry.siteName}` : `Show password for ${entry.siteName}`} title={shown !== null ? 'Hide password' : 'Show password'}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : shown !== null ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button className="icon-btn h-8 w-8 shrink-0" onClick={() => void copyPassword()} aria-label={`Copy password for ${entry.siteName}`} title="Copy password">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {notes !== null && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-raised px-3 py-2 text-sm">{notes || 'No notes.'}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {isSafeHref(entry.siteUrl) && (
          <a className="btn btn-sm" href={entry.siteUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Open website<span className="sr-only"> {entry.siteName} in a new tab</span>
          </a>
        )}
        {entry.hasNotes && (
          <button className="btn btn-sm" onClick={() => void toggleNotes()} disabled={notesLoading} aria-expanded={notes !== null}>
            {notesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />} {notes !== null ? 'Hide notes' : 'Show notes'}
          </button>
        )}
        <span className="text-xs text-muted">Saved {formatDate(entry.createdAt)}{entry.updatedAt !== entry.createdAt ? ` · Updated ${formatDate(entry.updatedAt)}` : ''}</span>
        <div className="flex-1" />
        <button className="btn btn-sm" onClick={onEdit} aria-label={`Edit ${entry.siteName}`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button className="btn btn-sm btn-danger" onClick={onDelete} aria-label={`Delete ${entry.siteName}`}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </li>
  )
}

interface FormState {
  siteName: string
  siteUrl: string
  username: string
  email: string
  password: string
  notes: string
}

function PasswordForm({ entry, onClose, onSaved }: { entry: PasswordMeta | null; onClose: () => void; onSaved: (e: PasswordMeta, isNew: boolean) => void }) {
  const api = useApi()
  const toast = useToast()
  const [form, setForm] = useState<FormState>({
    siteName: entry?.siteName ?? '',
    siteUrl: entry?.siteUrl ?? '',
    username: entry?.username ?? '',
    email: entry?.email ?? '',
    password: '',
    notes: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  // When editing, existing notes are loaded from the server so they can be edited.
  const [notesState, setNotesState] = useState<'ready' | 'loading' | 'error'>(entry?.hasNotes ? 'loading' : 'ready')

  useEffect(() => {
    if (!entry || !entry.hasNotes) return
    let cancelled = false
    api<{ value: string }>('/api/reveal', { method: 'POST', body: { id: entry.id, field: 'notes' } })
      .then((r) => {
        if (cancelled) return
        setForm((f) => ({ ...f, notes: r.value }))
        setNotesState('ready')
      })
      .catch(() => {
        if (!cancelled) setNotesState('error')
      })
    return () => {
      cancelled = true
    }
  }, [api, entry])

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy.current) return
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.siteName.trim()) errs.siteName = 'Enter the website or service name.'
    if (!form.siteUrl.trim()) errs.siteUrl = 'Enter the website address.'
    else if (!normalizeUrl(form.siteUrl)) errs.siteUrl = 'This is not a valid web address. Use something like https://example.com/login'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'This is not a valid email address.'
    if (!entry && !form.password) errs.password = 'Enter a password.'
    setErrors(errs)
    setFormError('')
    if (Object.keys(errs).length) return

    const body: Record<string, string> = { siteName: form.siteName, siteUrl: form.siteUrl, username: form.username, email: form.email }
    if (form.password) body.password = form.password // blank when editing = keep the current password
    if (!entry || notesState === 'ready') body.notes = form.notes // never overwrite notes that failed to load

    busy.current = true
    setSaving(true)
    try {
      const res = entry
        ? await api<{ entry: PasswordMeta }>(`/api/passwords?id=${encodeURIComponent(entry.id)}`, { method: 'PUT', body })
        : await api<{ entry: PasswordMeta }>('/api/passwords', { method: 'POST', body })
      toast(entry ? 'Password entry updated' : 'Password entry saved')
      onSaved(res.entry, !entry)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  return (
    <Modal open title={entry ? 'Edit password entry' : 'Add a password'} onClose={onClose} wide>
      <form onSubmit={submit} noValidate className="space-y-4" autoComplete="off">
        {formError && (
          <div role="alert" className="alert-error">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <p>{formError}</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="p-name">Website or service name</label>
          <input id="p-name" className="field" value={form.siteName} onChange={set('siteName')} maxLength={200} data-autofocus aria-invalid={!!errors.siteName} />
          {errors.siteName && <p className="mt-1 text-xs text-danger">{errors.siteName}</p>}
        </div>
        <div>
          <label className="label" htmlFor="p-url">Website URL</label>
          <input id="p-url" className="field" inputMode="url" placeholder="https://example.com/login" value={form.siteUrl} onChange={set('siteUrl')} maxLength={2048} aria-invalid={!!errors.siteUrl} />
          {errors.siteUrl && <p className="mt-1 text-xs text-danger">{errors.siteUrl}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-user">Username <span className="font-normal text-muted">(optional)</span></label>
            <input id="p-user" className="field" autoComplete="off" value={form.username} onChange={set('username')} maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="p-email">Email <span className="font-normal text-muted">(optional)</span></label>
            <input id="p-email" type="email" className="field" autoComplete="off" value={form.email} onChange={set('email')} maxLength={254} aria-invalid={!!errors.email} />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="p-pw">Password</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="p-pw"
                type={showPw ? 'text' : 'password'}
                className="field pr-11 font-mono"
                autoComplete="new-password"
                spellCheck={false}
                placeholder={entry ? 'Leave blank to keep the current password' : ''}
                value={form.password}
                onChange={set('password')}
                maxLength={1024}
                aria-invalid={!!errors.password}
              />
              <button type="button" className="icon-btn absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button type="button" className="btn" onClick={() => { setForm((f) => ({ ...f, password: generatePassword() })); setShowPw(true) }} title="Create a strong random password">
              <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Generate</span>
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-danger">{errors.password}</p>}
          {entry && !errors.password && <p className="hint">The saved password is not shown here. Type a new one only if you want to change it.</p>}
        </div>
        <div>
          <label className="label" htmlFor="p-notes">Notes <span className="font-normal text-muted">(optional, encrypted)</span></label>
          <textarea id="p-notes" className="field min-h-[84px]" value={form.notes} onChange={set('notes')} maxLength={5000} disabled={notesState === 'loading'} placeholder={notesState === 'loading' ? 'Loading notes…' : ''} />
          {notesState === 'error' && <p className="mt-1 text-xs text-danger">Existing notes could not be loaded, so they will be left unchanged.</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || notesState === 'loading'}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {saving ? 'Saving…' : entry ? 'Save changes' : 'Save password'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function PasswordsPage() {
  const api = useApi()
  const toast = useToast()
  const { items: entries, setItems, status, error, reload } = usePasswords()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [sort, setSort] = useState<SaverSort>('newest')
  const [editing, setEditing] = useState<PasswordMeta | 'new' | null>(null)
  const [deleting, setDeleting] = useState<PasswordMeta | null>(null)
  const deleteBusy = useRef(false)

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing('new')
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const visible = useMemo(
    () => sortItems(entries.filter((e) => matches([e.siteName, e.siteUrl, e.username, e.email], q)), sort, (e) => e.siteName),
    [entries, q, sort],
  )

  const onSaved = (e: PasswordMeta, isNew: boolean) => {
    setItems((cur) => (isNew ? [e, ...cur] : cur.map((x) => (x.id === e.id ? e : x))))
    setEditing(null)
  }

  const doDelete = async () => {
    if (!deleting || deleteBusy.current) return
    deleteBusy.current = true
    const target = deleting
    try {
      await api(`/api/passwords?id=${encodeURIComponent(target.id)}`, { method: 'DELETE' })
      setItems((cur) => cur.filter((x) => x.id !== target.id))
      toast('Password entry deleted')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      deleteBusy.current = false
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Password Saver</h1>
          <p className="mt-1 text-muted" aria-live="polite">
            {status === 'ready' ? `${entries.length} saved ${entries.length === 1 ? 'password entry' : 'password entries'}` : 'Store your website logins securely.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Add password
        </button>
      </div>

      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-raised px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden />
        <p>Passwords and notes are encrypted on the server before they are stored. They stay hidden until you choose to show or copy one.</p>
      </div>

      {status === 'loading' && (
        <div className="surface flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your saved accounts…
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="alert-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Your password entries could not be loaded.</p>
            <p className="text-muted">{error}</p>
          </div>
          <button className="btn btn-sm" onClick={() => void reload()}>Try again</button>
        </div>
      )}

      {status === 'ready' && entries.length === 0 && (
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title="No saved passwords yet"
          actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add your first password</button>}
        >
          Save the website, username, email and password for an account. You will be able to copy each part with one click.
        </EmptyState>
      )}

      {status === 'ready' && entries.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" className="field pl-9" placeholder="Search website, URL, username or email" aria-label="Search saved accounts" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="field" aria-label="Sort password entries" value={sort} onChange={(e) => setSort(e.target.value as SaverSort)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="alpha">Name A to Z</option>
            </select>
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={<Search className="h-6 w-6" />} title="No accounts match" actions={<button className="btn" onClick={() => setQ('')}>Clear search</button>}>
              Try a different word.
            </EmptyState>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">Showing {visible.length} of {entries.length}</p>
              <ul className="space-y-3">
                {visible.map((e) => (
                  <EntryCard key={e.id + e.updatedAt} entry={e} onEdit={() => setEditing(e)} onDelete={() => setDeleting(e)} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {editing && <PasswordForm entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={onSaved} />}

      <ConfirmDialog open={!!deleting} title="Delete this password entry?" confirmLabel="Delete entry" danger onConfirm={() => void doDelete()} onCancel={() => setDeleting(null)}>
        <p>
          The saved login for “{deleting?.siteName}” will be permanently removed, including its password and notes. This cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  )
}
