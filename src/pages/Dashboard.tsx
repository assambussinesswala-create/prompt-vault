import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { AlertTriangle, FlaskConical, KeyRound, Library, Link2, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { BackupReminder } from '../components/BackupReminder'
import { CategoryIcon } from '../components/CategoryIcon'
import { DemoBadge } from '../components/PromptCard'
import { useToast } from '../components/Toast'
import { useLinks, usePasswords, type LoadStatus } from '../lib/api'
import { hostOf } from '../lib/saver'
import { APP_TAGLINE } from '../lib/types'
import { relativeTime } from '../lib/util'
import { useVault } from '../store/VaultContext'

function statValue(status: LoadStatus, n: number): string {
  // Counts always come from real records. While loading, or if loading failed, no number is shown.
  return status === 'ready' ? String(n) : status === 'loading' ? '…' : '–'
}

function StatCard({ to, icon, label, value, note }: { to: string; icon: ReactNode; label: string; value: string; note?: string }) {
  return (
    <Link to={to} className="surface flex items-center gap-4 p-4 transition-colors hover:border-brass/50">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-raised text-brass" aria-hidden>{icon}</div>
      <div className="min-w-0">
        <p className="font-display text-3xl font-extrabold tabular-nums text-navy">{value}</p>
        <p className="text-sm text-muted">{label}</p>
        {note && <p className="text-xs text-danger">{note}</p>}
      </div>
    </Link>
  )
}

function Section({ title, to, linkLabel, children }: { title: string; to: string; linkLabel: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <Link to={to} className="text-sm font-medium text-brass hover:underline">{linkLabel}</Link>
      </div>
      <div className="surface overflow-hidden">{children}</div>
    </section>
  )
}

function Empty({ text, to, action }: { text: string; to: string; action: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm text-muted">{text}</p>
      <Link to={to} className="btn btn-sm mt-3"><Plus className="h-3.5 w-3.5" /> {action}</Link>
    </div>
  )
}

const rowClass = 'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/70'

export default function Dashboard() {
  const { user } = useUser()
  const nav = useNavigate()
  const toast = useToast()
  const { prompts, counts, loadDemo, removeDemo } = useVault()
  const links = useLinks()
  const passwords = usePasswords()
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('/links')

  const recentLinks = links.items.slice(0, 5) // the server returns newest first
  const recentPasswords = passwords.items.slice(0, 5)
  const recentPrompts = [...prompts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5)
  const loadFailed = links.status === 'error' || passwords.status === 'error'

  const search = (e: FormEvent) => {
    e.preventDefault()
    nav(q.trim() ? `${scope}?q=${encodeURIComponent(q.trim())}` : scope)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">{user?.firstName ? `Welcome back, ${user.firstName}` : 'Welcome back'}</h1>
        <p className="mt-1 text-muted">{APP_TAGLINE} Here is a quick look at what you have saved.</p>
      </div>

      <BackupReminder />

      {loadFailed && (
        <div role="alert" className="alert-error mb-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <p className="flex-1">
            Some of your saved data could not be loaded.{' '}
            {(links.status === 'error' ? links.error : passwords.error)}
          </p>
          <button className="btn btn-sm" onClick={() => { void links.reload(); void passwords.reload() }}>Try again</button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard to="/links" icon={<Link2 className="h-5 w-5" />} label="Saved links" value={statValue(links.status, links.items.length)} />
        <StatCard to="/passwords" icon={<KeyRound className="h-5 w-5" />} label="Saved passwords" value={statValue(passwords.status, passwords.items.length)} />
        <StatCard to="/prompts" icon={<Library className="h-5 w-5" />} label="Saved prompts (this device)" value={String(counts.total)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-wrap gap-2">
          <Link to="/links?new=1" className="btn btn-primary"><Plus className="h-4 w-4" /> Add link</Link>
          <Link to="/passwords?new=1" className="btn btn-primary"><Plus className="h-4 w-4" /> Add password</Link>
          <Link to="/new" className="btn"><Plus className="h-4 w-4" /> New prompt</Link>
        </div>
        <form onSubmit={search} className="flex gap-2" role="search">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" className="field pl-9" placeholder="Quick search" aria-label="Quick search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="field !w-auto" aria-label="Search in" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="/links">Links</option>
            <option value="/passwords">Passwords</option>
            <option value="/prompts">Prompts</option>
          </select>
          <button className="btn" type="submit">Search</button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Recently added links" to="/links" linkLabel="View all">
          {links.status === 'loading' ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : recentLinks.length === 0 ? (
            links.status === 'ready' ? <Empty text="You have not saved any links yet." to="/links?new=1" action="Add a link" /> : <p className="px-4 py-8 text-center text-sm text-muted">Unavailable right now.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentLinks.map((l) => (
                <li key={l.id}>
                  <Link to="/links" className={rowClass}>
                    <Link2 className="h-4 w-4 shrink-0 text-brass" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{l.title}</span>
                      <span className="block truncate text-xs text-muted">{hostOf(l.url)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{relativeTime(l.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recently added passwords" to="/passwords" linkLabel="View all">
          {passwords.status === 'loading' ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : recentPasswords.length === 0 ? (
            passwords.status === 'ready' ? <Empty text="You have not saved any passwords yet." to="/passwords?new=1" action="Add a password" /> : <p className="px-4 py-8 text-center text-sm text-muted">Unavailable right now.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentPasswords.map((p) => (
                <li key={p.id}>
                  <Link to="/passwords" className={rowClass}>
                    <KeyRound className="h-4 w-4 shrink-0 text-brass" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.siteName}</span>
                      <span className="block truncate text-xs text-muted">{p.username || p.email || hostOf(p.siteUrl)}</span>
                    </span>
                    <span className="shrink-0 text-xs tracking-wider text-muted" aria-label="Password hidden">••••••••</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-6">
        {counts.demo > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-raised px-4 py-3 text-sm">
            <FlaskConical className="h-4 w-4 shrink-0 text-brass" aria-hidden />
            <p className="flex-1">
              {counts.demo} sample prompt{counts.demo === 1 ? ' is' : 's are'} marked <DemoBadge /> so you can try the library. Your own prompts are never marked.
            </p>
            <button className="btn btn-sm" onClick={() => toast(`Removed ${removeDemo()} demo prompts`, 'info')}>
              <Trash2 className="h-3.5 w-3.5" /> Remove demo prompts
            </button>
          </div>
        )}
        <Section title="Prompt library" to="/prompts" linkLabel="Open library">
          {recentPrompts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted">Your prompt library is empty. Prompts are stored in this browser only.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Link to="/new" className="btn btn-sm btn-primary"><Plus className="h-3.5 w-3.5" /> Write a prompt</Link>
                <Link to="/import" className="btn btn-sm">Import old prompts</Link>
                <button className="btn btn-sm" onClick={() => { loadDemo(); toast('Added 5 demo prompts') }}><Sparkles className="h-3.5 w-3.5" /> Try demo prompts</button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recentPrompts.map((p) => (
                <li key={p.id}>
                  <Link to={`/prompt/${p.id}`} className={rowClass}>
                    <CategoryIcon name={p.category} className="h-4 w-4 shrink-0 text-brass" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      <span className="block truncate text-xs text-muted">{p.category}{p.platform ? ` · ${p.platform}` : ''}</span>
                    </span>
                    {p.isDemo && <DemoBadge />}
                    <span className="shrink-0 text-xs text-muted">{relativeTime(p.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
