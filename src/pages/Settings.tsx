import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClerk, useUser } from '@clerk/clerk-react'
import { HardDrive, LogOut, Moon, ShieldCheck, Sun, Trash2, UserCog } from 'lucide-react'
import { VaultMark } from '../components/Brand'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'
import { backupToJson } from '../lib/exporters'
import { storageUsage, KEYS } from '../lib/storage'
import { APP_BRAND, APP_NAME, APP_TAGLINE, APP_VERSION, BACKUP_VERSION, type SortMode } from '../lib/types'
import { datestamp, downloadFile, formatBytes, formatDateTime } from '../lib/util'
import { useVault } from '../store/VaultContext'

export default function SettingsPage() {
  const { prompts, categories, settings, updateSettings, clearAll, markBackupDone, counts, removeDemo } = useVault()
  const toast = useToast()
  const { user } = useUser()
  const clerk = useClerk()
  const [confirmClear, setConfirmClear] = useState(false)
  const usage = storageUsage()
  const pct = Math.min(100, (usage.bytes / usage.limit) * 100)

  const section = 'surface p-5'
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="page-title">Settings</h1>

      <section className={section} aria-labelledby="s-brand">
        <h2 id="s-brand" className="sr-only">Branding</h2>
        <div className="flex items-center gap-4">
          <VaultMark className="h-14 w-14" />
          <div>
            <p className="font-display text-xl font-extrabold tracking-tight text-navy">{APP_BRAND}</p>
            <p className="mt-1 text-sm">{APP_TAGLINE}</p>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="s-account">
        <h2 id="s-account" className="mb-3 font-display text-lg font-bold">Account and security</h2>
        <p className="text-sm">
          Signed in as <strong>{user?.primaryEmailAddress?.emailAddress ?? user?.username ?? 'your account'}</strong>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={() => clerk.openUserProfile()}><UserCog className="h-4 w-4" /> Manage account and password</button>
          <button className="btn" onClick={() => void clerk.signOut({ redirectUrl: '/sign-in' })}><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-raised px-3 py-2.5 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden />
          <p>Saved links and passwords are stored in the cloud database under your account and can be used on any device. Passwords and notes are encrypted on the server. Your prompt library is stored only in this browser (see below).</p>
        </div>
      </section>

      <section className={section} aria-labelledby="s-pref">
        <h2 id="s-pref" className="mb-4 font-display text-lg font-bold">Preferences</h2>
        <div className="space-y-5">
          <fieldset>
            <legend className="label">Theme</legend>
            <div className="flex gap-2">
              <button className={`btn ${settings.theme === 'dark' ? '!border-brass' : ''}`} aria-pressed={settings.theme === 'dark'} onClick={() => updateSettings({ theme: 'dark' })}><Moon className="h-4 w-4" /> Dark</button>
              <button className={`btn ${settings.theme === 'light' ? '!border-brass' : ''}`} aria-pressed={settings.theme === 'light'} onClick={() => updateSettings({ theme: 'light' })}><Sun className="h-4 w-4" /> Light</button>
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="sort">Default prompt sorting</label>
              <select id="sort" className="field" value={settings.defaultSort} onChange={(e) => updateSettings({ defaultSort: e.target.value as SortMode })}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="edited">Recently edited</option>
                <option value="alpha">A to Z</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="defcat">Default category for new prompts</label>
              <select id="defcat" className="field" value={settings.defaultCategory} onChange={(e) => updateSettings({ defaultCategory: e.target.value })}>
                <option value="">Uncategorized</option>
                {categories.filter((c) => c.name !== 'Uncategorized').map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="remind">Remind me to back up after</label>
              <select id="remind" className="field" value={settings.backupReminderDays} onChange={(e) => updateSettings({ backupReminderDays: Number(e.target.value) })}>
                {[1, 3, 7, 14, 30].map((n) => <option key={n} value={n}>{n} day{n === 1 ? '' : 's'}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby="s-data">
        <h2 id="s-data" className="mb-3 font-display text-lg font-bold">Backup, import and export</h2>
        <p className="text-sm text-muted">Last backup: {formatDateTime(settings.lastBackupAt)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={!prompts.length} onClick={() => { downloadFile(`prompt-vault-backup-${datestamp()}.json`, backupToJson(prompts, categories.map((c) => c.name)), 'application/json'); markBackupDone(); toast('Backup downloaded') }}>Download backup</button>
          <Link to="/backup" className="btn">Export and restore</Link>
          <Link to="/import" className="btn">Import old prompts</Link>
          {counts.demo > 0 && <button className="btn" onClick={() => toast(`Removed ${removeDemo()} demo prompts`, 'info')}>Remove {counts.demo} demo prompts</button>}
        </div>
      </section>

      <section className={section} aria-labelledby="s-store">
        <h2 id="s-store" className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><HardDrive className="h-4 w-4 text-brass" /> Local storage</h2>
        <div className="mb-1 flex justify-between text-sm"><span>{formatBytes(usage.bytes)} used</span><span className="text-muted">about {formatBytes(usage.limit)} available in most browsers</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
          <div className={`h-full ${pct > 80 ? 'bg-danger' : 'bg-brass'}`} style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">{prompts.length} prompts · {categories.length} categories · stored under {Object.values(KEYS).length} keys beginning with “promptvault:v1:”</p>
        <div className="mt-4 space-y-2 text-sm text-muted">
          <h3 className="font-medium text-fg">Data safety</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Everything is stored in this browser on this device. There is no account, server or cloud copy.</li>
            <li>Prompts do not sync between devices or browsers. Move them with a backup file.</li>
            <li>Clearing site data, using private windows or uninstalling the browser can erase the vault.</li>
            <li>Saving never overwrites silently, and imports and restores only add prompts unless you choose otherwise.</li>
            <li>No data is sent anywhere, and the app contains no API keys.</li>
          </ul>
        </div>
      </section>

      <section className={section} aria-labelledby="s-about">
        <h2 id="s-about" className="mb-3 font-display text-lg font-bold">About</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted">Application</dt><dd>{APP_NAME}</dd>
          <dt className="text-muted">Version</dt><dd>{APP_VERSION}</dd>
          <dt className="text-muted">Backup format</dt><dd>{BACKUP_VERSION}</dd>
          <dt className="text-muted">Brand</dt><dd>{APP_BRAND}</dd>
          <dt className="text-muted">Storage</dt><dd>Browser local storage (no cloud sync in this version)</dd>
        </dl>
      </section>

      <section className="rounded-xl border border-danger/40 p-5" aria-labelledby="s-danger">
        <h2 id="s-danger" className="font-display text-lg font-bold text-danger">Danger zone</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Permanently delete every prompt, custom category and setting stored in this browser.</p>
        <button className="btn btn-danger" onClick={() => setConfirmClear(true)}><Trash2 className="h-4 w-4" /> Clear all data</button>
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Delete everything in this vault?"
        confirmLabel="Delete everything"
        danger
        requireText="DELETE"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => { clearAll(); setConfirmClear(false); toast('Vault cleared', 'info') }}
      >
        <p>All {prompts.length} prompts, categories and settings will be erased from this browser. This cannot be undone.</p>
        <button className="btn btn-sm" disabled={!prompts.length} onClick={() => { downloadFile(`prompt-vault-backup-${datestamp()}.json`, backupToJson(prompts, categories.map((c) => c.name)), 'application/json'); markBackupDone(); toast('Backup downloaded') }}>Download a backup first</button>
      </ConfirmDialog>
    </div>
  )
}
