import { useState } from 'react'
import { AlertTriangle, Download, FileJson, FileText, ShieldCheck } from 'lucide-react'
import { ImportWorkflow } from '../components/ImportWorkflow'
import { useToast } from '../components/Toast'
import { backupToJson, promptsToMarkdown } from '../lib/exporters'
import { sortPrompts } from '../lib/search'
import { BACKUP_FORMAT, BACKUP_VERSION } from '../lib/types'
import { datestamp, daysSince, downloadFile, formatDateTime } from '../lib/util'
import { useVault } from '../store/VaultContext'

export default function Backup() {
  const { prompts, categories, settings, markBackupDone } = useVault()
  const toast = useToast()
  const [cat, setCat] = useState('')
  const names = categories.map((c) => c.name)
  const real = prompts.filter((p) => !p.isDemo)
  const d = daysSince(settings.lastBackupAt)
  const inCat = cat ? prompts.filter((p) => p.category === cat) : prompts

  const downloadBackup = () => {
    downloadFile(`prompt-vault-backup-${datestamp()}.json`, backupToJson(prompts, names), 'application/json')
    markBackupDone()
    toast(`Backup downloaded with ${prompts.length} prompts`)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title">Export and backup</h1>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden />
        <p>
          Your prompts are stored <strong>only in this browser on this device</strong>. They do not sync to your other devices, and they are lost if you clear browser data or reinstall the browser. Download a backup regularly and before changing devices or browsers.
        </p>
      </div>

      <section className="surface mt-6 p-5" aria-labelledby="bk-h">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="bk-h" className="font-display text-lg font-bold">Complete backup</h2>
            <p className="mt-1 text-sm text-muted">
              {prompts.length} prompt{prompts.length === 1 ? '' : 's'} and {categories.length} categories in one JSON file.{' '}
              {settings.lastBackupAt ? `Last backup: ${formatDateTime(settings.lastBackupAt)}${d !== null ? ` (${d} day${d === 1 ? '' : 's'} ago)` : ''}.` : 'You have not made a backup yet.'}
            </p>
            {real.length === 0 && prompts.length > 0 && <p className="mt-1 text-xs text-muted">Only demo prompts are saved right now.</p>}
          </div>
          <button className="btn btn-primary" onClick={downloadBackup} disabled={!prompts.length}><Download className="h-4 w-4" /> Download backup</button>
        </div>
      </section>

      <section className="surface mt-6 p-5" aria-labelledby="ex-h">
        <h2 id="ex-h" className="font-display text-lg font-bold">Export prompts</h2>
        <p className="mt-1 text-sm text-muted">To export hand-picked prompts, use <strong className="text-fg">Select</strong> on the All Prompts page. You can also export a whole category:</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ex-cat">Category to export</label>
          <select id="ex-cat" className="field !w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories ({prompts.length})</option>
            {categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({prompts.filter((p) => p.category === c.name).length})</option>)}
          </select>
          <button className="btn" disabled={!inCat.length} onClick={() => { downloadFile(`prompt-vault-${cat ? 'category' : 'all'}-${datestamp()}.json`, backupToJson(inCat, names), 'application/json'); toast(`Exported ${inCat.length} prompts as JSON`) }}><FileJson className="h-4 w-4" /> JSON</button>
          <button className="btn" disabled={!inCat.length} onClick={() => { downloadFile(`prompt-vault-${cat ? 'category' : 'all'}-${datestamp()}.md`, promptsToMarkdown(sortPrompts(inCat, 'alpha')), 'text/markdown'); toast(`Exported ${inCat.length} prompts as Markdown`) }}><FileText className="h-4 w-4" /> Markdown</button>
        </div>
        <p className="hint">Single prompts can be exported as .txt, .md or JSON from their detail page.</p>
      </section>

      <section className="surface mt-6 p-5" aria-labelledby="rs-h">
        <h2 id="rs-h" className="font-display text-lg font-bold">Restore from a backup</h2>
        <p className="mb-4 mt-1 flex items-start gap-1.5 text-sm text-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden /> The file is checked first, then you review it. Restoring only adds prompts. Your current vault is never erased, and saved prompts are replaced only if you tick that option.</p>
        <ImportWorkflow restoreOnly />
      </section>

      <section className="mt-6" aria-labelledby="fm-h">
        <details className="surface px-4 py-3">
          <summary id="fm-h" className="cursor-pointer text-sm font-medium">Backup file format (for migrating to another tool)</summary>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <p>Backups are plain JSON with <code className="font-mono">format: "{BACKUP_FORMAT}"</code> and <code className="font-mono">version: {BACKUP_VERSION}</code>. New versions will stay readable by adding fields rather than changing existing ones.</p>
            <pre className="overflow-x-auto rounded-lg border border-line bg-ink p-3 font-mono text-xs text-fg">{`{
  "format": "${BACKUP_FORMAT}",
  "version": ${BACKUP_VERSION},
  "exportedAt": "2026-01-31T10:00:00.000Z",
  "app": { "name": "Prompt Vault PK", "brand": "Prompt Vault PK" },
  "categories": ["AI Video Generation", "Uncategorized"],
  "prompts": [
    {
      "id": "unique-id",
      "title": "…",
      "content": "full prompt text, exactly as written",
      "description": "",
      "category": "AI Video Generation",
      "tags": ["video"],
      "platform": "Google Flow",
      "createdAt": "ISO date",
      "updatedAt": "ISO date",
      "lastUsedAt": "ISO date or null",
      "favorite": false,
      "notes": "",
      "version": ""
    }
  ]
}`}</pre>
          </div>
        </details>
      </section>
    </div>
  )
}
