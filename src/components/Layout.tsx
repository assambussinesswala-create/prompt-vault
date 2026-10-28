import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'
import { AlertTriangle, Archive, Clock, KeyRound, LayoutDashboard, Library, Link2, Menu, Plus, Search, Settings as SettingsIcon, Star, Tags, Upload, X } from 'lucide-react'
import { useVault } from '../store/VaultContext'
import { BrandLockup } from './Brand'
import { CategoryIcon } from './CategoryIcon'

const LIST_ROUTES = ['/prompts', '/favorites', '/recent']

function NavItem({ to, icon, children, count, end }: { to: string; icon: ReactNode; children: ReactNode; count?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-raised font-semibold text-brass' : 'text-muted hover:bg-raised/70 hover:text-fg'}`
      }
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {count !== undefined && <span className="text-xs text-muted">{count}</span>}
    </NavLink>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { prompts, categories, counts } = useVault()
  const loc = useLocation()
  const [params] = useSearchParams()
  const activeCat = loc.pathname === '/prompts' ? params.get('category') : null
  const perCat = new Map<string, number>()
  prompts.forEach((p) => perCat.set(p.category, (perCat.get(p.category) ?? 0) + 1))
  const usedCount = prompts.filter((p) => p.lastUsedAt).length
  const icon = 'h-4 w-4 shrink-0'
  return (
    <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}>
      <div className="px-4 pb-4 pt-5">
        <Link to="/" aria-label="Prompt Vault PK home">
          <BrandLockup />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4" aria-label="Main">
        <NavItem to="/" end icon={<LayoutDashboard className={icon} />}>Dashboard</NavItem>
        <NavItem to="/links" icon={<Link2 className={icon} />}>Link Saver</NavItem>
        <NavItem to="/passwords" icon={<KeyRound className={icon} />}>Password Saver</NavItem>
        <div className="my-3 border-t border-line" />
        <p className="px-3 pb-1 text-xs font-medium text-muted">Prompt library</p>
        <NavItem to="/prompts" icon={<Library className={icon} />} count={counts.total}>All Prompts</NavItem>
        <NavItem to="/favorites" icon={<Star className={icon} />} count={counts.favorites}>Favorites</NavItem>
        <NavItem to="/recent" icon={<Clock className={icon} />} count={usedCount}>Recently Used</NavItem>
        <NavItem to="/categories" icon={<Tags className={icon} />}>Categories</NavItem>
        <NavItem to="/import" icon={<Upload className={icon} />}>Import Old Prompts</NavItem>
        <NavItem to="/backup" icon={<Archive className={icon} />}>Export and Backup</NavItem>
        <div className="my-3 border-t border-line" />
        <NavItem to="/settings" icon={<SettingsIcon className={icon} />}>Settings</NavItem>
        <div className="my-3 border-t border-line" />
        <p className="px-3 pb-1 text-xs font-medium text-muted">Browse by category</p>
        {categories.map((c) => (
          <Link
            key={c.name}
            to={`/prompts?category=${encodeURIComponent(c.name)}`}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${activeCat === c.name ? 'bg-raised font-semibold text-brass' : 'text-muted hover:bg-raised/70 hover:text-fg'}`}
          >
            <CategoryIcon name={c.name} className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="text-xs">{perCat.get(c.name) ?? 0}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const loc = useLocation()
  const [params, setParams] = useSearchParams()
  const onList = LIST_ROUTES.includes(loc.pathname)
  const urlQ = onList ? params.get('q') ?? '' : ''
  const [q, setQ] = useState(urlQ)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => setQ(urlQ), [urlQ])
  useEffect(() => {
    if (!onList) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onList])

  const update = (value: string) => {
    setQ(value)
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-panel/90 px-3 py-3 backdrop-blur sm:px-6">
      <button className="icon-btn lg:hidden" onClick={onMenu} aria-label="Open navigation menu">
        <Menu className="h-5 w-5" />
      </button>
      {onList ? (
        <div className="relative max-w-2xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={input}
            type="search"
            className="field !rounded-xl !py-2.5 pl-9 pr-10"
            placeholder="Search titles, prompts, tags, platforms…"
            aria-label="Search prompts"
            value={q}
            onChange={(e) => update(e.target.value)}
          />
          {q ? (
            <button className="icon-btn absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => { update(''); input.current?.focus() }} aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-xs text-muted sm:block">/</kbd>
          )}
        </div>
      ) : (
        <Link to="/" className="lg:hidden" aria-label="Prompt Vault PK home">
          <BrandLockup compact />
        </Link>
      )}
      <div className="flex-1" />
      {onList && (
        <Link to="/new" className="btn btn-primary shrink-0" aria-label="New prompt">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Prompt</span>
        </Link>
      )}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <UserButton />
      </div>
    </header>
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const { storageError, dismissStorageError, loadWarnings } = useVault()
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  return (
    <div className="min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-lg focus:bg-brass focus:px-3 focus:py-2 focus:text-brass-ink">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-line bg-panel lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[290px] max-w-[85vw] border-r border-line bg-panel shadow-2xl">
            <button className="icon-btn absolute right-2 top-3" onClick={() => setOpen(false)} aria-label="Close navigation menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-[272px]">
        <TopBar onMenu={() => setOpen(true)} />
        {storageError && (
          <div role="alert" className="flex items-start gap-3 border-b border-danger/40 bg-danger/10 px-4 py-3 text-sm sm:px-6">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <p className="flex-1">
              <strong>Your changes are not being saved.</strong> {storageError}{' '}
              <Link to="/backup" className="underline">Export a backup</Link>
            </p>
            <button className="icon-btn -my-1 h-7 w-7" onClick={dismissStorageError} aria-label="Dismiss warning">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {loadWarnings.length > 0 && (
          <div role="alert" className="border-b border-brass/40 bg-brass/10 px-4 py-3 text-sm sm:px-6">
            {loadWarnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
