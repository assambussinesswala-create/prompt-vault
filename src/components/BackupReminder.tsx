import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, X } from 'lucide-react'
import { daysSince } from '../lib/util'
import { useVault } from '../store/VaultContext'

/** Shown when there are prompts and no recent backup. Dismissal lasts until the page is reloaded. */
export function BackupReminder() {
  const { prompts, settings } = useVault()
  const [hidden, setHidden] = useState(false)
  const real = prompts.filter((p) => !p.isDemo)
  if (hidden || real.length === 0) return null
  const d = daysSince(settings.lastBackupAt)
  const latest = Math.max(...real.map((p) => new Date(p.updatedAt).getTime() || 0))
  const changedSince = !settings.lastBackupAt || latest > new Date(settings.lastBackupAt).getTime()
  const due = d === null || (changedSince && d >= settings.backupReminderDays)
  if (!due) return null
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm" role="note">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden />
      <p className="flex-1">
        {d === null ? 'You have not backed up this vault yet.' : `Your last backup was ${d} day${d === 1 ? '' : 's'} ago.`} Prompts live only in this browser, so download a backup file you can restore later.{' '}
        <Link to="/backup" className="font-medium underline">Back up now</Link>
      </p>
      <button className="icon-btn -my-1 h-7 w-7" onClick={() => setHidden(true)} aria-label="Hide backup reminder">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
