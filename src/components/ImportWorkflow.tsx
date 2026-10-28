import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, FileJson, FileText, FileUp, Merge, ShieldCheck, Trash2, X } from 'lucide-react'
import { buildDupIndex, findDuplicate } from '../lib/dedupe'
import { IMPORT_SEPARATOR } from '../lib/defaults'
import {
  SPLIT_MODE_LABELS,
  buildCandidates,
  detectSplitMode,
  parseJson,
  parseText,
  type ImportCandidate,
  type ImportSummary,
  type ParseResult,
  type SplitMode,
} from '../lib/importers'
import { formatDateTime, uid } from '../lib/util'
import { useVault } from '../store/VaultContext'
import { ConfirmDialog } from './Modal'
import { useToast } from './Toast'

interface Source {
  id: string
  name: string
  kind: 'text' | 'json'
  text: string
  mode: SplitMode
  custom: string
}

const PAGE = 40

function parseSource(s: Source, minChars: number): ParseResult {
  return s.kind === 'json' ? parseJson(s.text, { minChars }) : parseText(s.text, s.mode, s.custom)
}

function dupBadge(c: ImportCandidate) {
  if (c.dup.kind === 'exact') return { text: `Exact duplicate of ${c.dupLabel}`, tone: 'text-danger border-danger/50' }
  if (c.dup.kind === 'similar') return { text: `${Math.round((c.dup.score ?? 0) * 100)}% similar to ${c.dupLabel}`, tone: 'text-danger border-danger/50' }
  if (c.dup.kind === 'title') return { text: `Same title as ${c.dupLabel}`, tone: 'text-brass border-brass/50' }
  return null
}

export function ImportWorkflow({ restoreOnly = false }: { restoreOnly?: boolean }) {
  const { prompts, categories, settings, importCandidates } = useVault()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'sources' | 'review' | 'done'>('sources')
  const [sources, setSources] = useState<Source[]>([])
  const [paste, setPaste] = useState('')
  const [pasteMode, setPasteMode] = useState<SplitMode>('separator')
  const [pasteCustom, setPasteCustom] = useState('')
  const [minChars, setMinChars] = useState(80)
  const [readErrors, setReadErrors] = useState<string[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const [cands, setCands] = useState<ImportCandidate[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [extraCats, setExtraCats] = useState<string[]>([])
  const [shown, setShown] = useState(PAGE)
  const [bulkCat, setBulkCat] = useState('')
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const parsed = useMemo(() => sources.map((s) => parseSource(s, minChars)), [sources, minChars])
  const pasteParsed = useMemo(() => (!restoreOnly && paste.trim() ? parseText(paste, pasteMode, pasteCustom) : null), [paste, pasteMode, pasteCustom, restoreOnly])
  const hasChatGpt = parsed.some((r) => r.kind === 'chatgpt')

  /* ---------------- reading files ---------------- */
  const readFiles = async (files: FileList | File[]) => {
    const errs: string[] = []
    const next: Source[] = []
    for (const f of Array.from(files)) {
      const lower = f.name.toLowerCase()
      const isJson = lower.endsWith('.json')
      const isText = /\.(txt|md|markdown)$/.test(lower)
      if (restoreOnly && !isJson) {
        errs.push(`${f.name}: a backup must be a .json file.`)
        continue
      }
      if (!isJson && !isText) {
        errs.push(`${f.name}: unsupported file type. Use .txt, .md or .json.`)
        continue
      }
      try {
        const text = await f.text()
        if (!text.trim()) {
          errs.push(`${f.name}: the file is empty.`)
          continue
        }
        next.push({ id: uid(), name: f.name, kind: isJson ? 'json' : 'text', text, mode: isJson ? 'single' : detectSplitMode(text), custom: '' })
      } catch {
        errs.push(`${f.name}: the file could not be read.`)
      }
    }
    setReadErrors(errs)
    setProblem(null)
    setSources((s) => (restoreOnly ? next.slice(0, 1) : [...s, ...next]))
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files)
  }

  /* ---------------- build the review list ---------------- */
  const startReview = () => {
    const items = []
    const errs: string[] = []
    const cats: string[] = []
    sources.forEach((s, i) => {
      const r = parsed[i]
      if (restoreOnly && r.kind !== 'backup') {
        errs.push(`${s.name}: this is not a Prompt Vault backup file.`)
        return
      }
      items.push(...r.items)
      r.errors.forEach((e) => errs.push(`${s.name}: ${e}`))
      if (r.categories) cats.push(...r.categories)
    })
    if (pasteParsed) {
      items.push(...pasteParsed.items)
      pasteParsed.errors.forEach((e) => errs.push(`Pasted text: ${e}`))
    }
    if (!items.length) {
      setProblem(errs.length ? errs.join(' ') : restoreOnly ? 'Choose a backup file first.' : 'Add a file or paste some text first.')
      return
    }
    setProblem(null)
    setParseErrors(errs)
    setExtraCats(cats)
    setCands(buildCandidates(items, prompts, settings.defaultCategory))
    setShown(PAGE)
    setStep('review')
  }

  const patch = (key: string, p: Partial<ImportCandidate>) => setCands((c) => c.map((x) => (x.key === key ? { ...x, ...p } : x)))
  const dupIndex = useMemo(() => buildDupIndex(prompts), [prompts])
  const recheck = (key: string) =>
    setCands((list) =>
      list.map((x) => {
        if (x.key !== key) return x
        const d = findDuplicate(x.title, x.content, dupIndex)
        return { ...x, dup: d, dupLabel: d.match ? `"${d.match.title}"` : '' }
      }),
    )
  const mergeUp = (i: number) =>
    setCands((list) => {
      if (i < 1) return list
      const prev = list[i - 1]
      const cur = list[i]
      const merged = { ...prev, content: `${prev.content}\n\n${cur.content}`, selected: true }
      const d = findDuplicate(merged.title, merged.content, dupIndex)
      return [...list.slice(0, i - 1), { ...merged, dup: d, dupLabel: d.match ? `"${d.match.title}"` : '' }, ...list.slice(i + 1)]
    })
  const remove = (key: string) => setCands((c) => c.filter((x) => x.key !== key))

  const selected = cands.filter((c) => c.selected)
  const overwriteCount = selected.filter((c) => c.overwrite && c.idConflict).length
  const dupCount = cands.filter((c) => c.dup.kind === 'exact' || c.dup.kind === 'similar').length

  const doImport = () => {
    const s = importCandidates(cands, parseErrors, extraCats)
    setSummary(s)
    setStep('done')
    setConfirmOverwrite(false)
    toast(`Imported ${s.imported + s.overwritten} prompt${s.imported + s.overwritten === 1 ? '' : 's'}`)
  }
  const reset = () => {
    setStep('sources')
    setSources([])
    setPaste('')
    setCands([])
    setSummary(null)
    setReadErrors([])
    setProblem(null)
  }

  /* ---------------- step 3 ---------------- */
  if (step === 'done' && summary) {
    const total = summary.imported + summary.overwritten
    return (
      <div className="surface p-6" aria-live="polite">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-ok" aria-hidden />
          <h2 className="font-display text-lg font-bold">{restoreOnly ? 'Restore finished' : 'Import finished'}</h2>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li><strong>{summary.imported}</strong> new prompt{summary.imported === 1 ? '' : 's'} added</li>
          {summary.overwritten > 0 && <li><strong>{summary.overwritten}</strong> existing prompt{summary.overwritten === 1 ? '' : 's'} overwritten</li>}
          <li><strong>{summary.skippedDuplicates}</strong> duplicate{summary.skippedDuplicates === 1 ? '' : 's'} skipped</li>
          {summary.notSelected > 0 && <li><strong>{summary.notSelected}</strong> left out by you</li>}
          {summary.newCategories.length > 0 && <li>New categories created: {summary.newCategories.join(', ')}</li>}
          <li className={summary.errors.length ? 'text-danger' : ''}><strong>{summary.errors.length}</strong> error{summary.errors.length === 1 ? '' : 's'}</li>
        </ul>
        {summary.errors.length > 0 && (
          <ul className="mt-3 max-h-48 list-disc space-y-1 overflow-auto rounded-lg border border-line bg-ink p-3 pl-7 text-xs text-muted">
            {summary.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted">Existing prompts were not removed. {total > 0 && 'Back up your vault now so these are safe.'}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/prompts" className="btn btn-primary">View all prompts</Link>
          {total > 0 && <Link to="/backup" className="btn">Back up now</Link>}
          <button className="btn" onClick={reset}>{restoreOnly ? 'Restore another file' : 'Import more'}</button>
        </div>
      </div>
    )
  }

  /* ---------------- step 2 ---------------- */
  if (step === 'review') {
    const shownList = cands.slice(0, shown)
    return (
      <div>
        <button className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg" onClick={() => setStep('sources')}>
          <ArrowLeft className="h-4 w-4" /> Back to sources
        </button>
        <h2 className="font-display text-xl font-bold">Review before saving</h2>
        <p className="mt-1 text-sm text-muted">
          {cands.length} prompt{cands.length === 1 ? '' : 's'} found{dupCount ? `, ${dupCount} look like duplicates (unticked for you)` : ''}. Nothing is saved until you press Import. Fix titles and categories, edit the text, or merge a wrongly split section into the one above.
        </p>

        {parseErrors.length > 0 && (
          <div className="mt-3 rounded-lg border border-brass/40 bg-brass/10 p-3 text-xs">
            <p className="mb-1 font-medium text-fg">{parseErrors.length} warning{parseErrors.length === 1 ? '' : 's'} from reading your files</p>
            <ul className="max-h-28 list-disc space-y-0.5 overflow-auto pl-5 text-muted">{parseErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        <div className="surface sticky top-[68px] z-20 mt-4 flex flex-wrap items-center gap-2 px-3 py-2.5 shadow-lg">
          <span className="mr-auto text-sm">{selected.length} of {cands.length} selected</span>
          <button className="btn btn-sm" onClick={() => setCands((c) => c.map((x) => ({ ...x, selected: true })))}>All</button>
          <button className="btn btn-sm" onClick={() => setCands((c) => c.map((x) => ({ ...x, selected: x.dup.kind !== 'exact' && x.dup.kind !== 'similar' })))}>Skip duplicates</button>
          <button className="btn btn-sm" onClick={() => setCands((c) => c.map((x) => ({ ...x, selected: false })))}>None</button>
          <label className="sr-only" htmlFor="bulk-cat">Category for selected prompts</label>
          <input id="bulk-cat" list="cat-list" className="field !w-44 !py-1.5 text-[13px]" placeholder="Set category for selected" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} />
          <button className="btn btn-sm" disabled={!bulkCat.trim() || !selected.length} onClick={() => { setCands((c) => c.map((x) => (x.selected ? { ...x, category: bulkCat.trim() } : x))); toast(`Category set on ${selected.length} prompts`, 'info') }}>Apply</button>
        </div>
        <datalist id="cat-list">{categories.map((c) => <option key={c.name} value={c.name} />)}</datalist>

        <ul className="mt-4 space-y-3">
          {shownList.map((c, i) => {
            const badge = dupBadge(c)
            return (
              <li key={c.key} className={`surface p-4 ${c.selected ? '' : 'opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-2.5 h-4 w-4 accent-[rgb(var(--c-brass))]" checked={c.selected} onChange={(e) => patch(c.key, { selected: e.target.checked })} aria-label={`Import "${c.title}"`} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_14rem]">
                      <div>
                        <label className="sr-only" htmlFor={`t-${c.key}`}>Title</label>
                        <input id={`t-${c.key}`} className="field font-medium" value={c.title} onChange={(e) => patch(c.key, { title: e.target.value })} onBlur={() => recheck(c.key)} />
                      </div>
                      <div>
                        <label className="sr-only" htmlFor={`c-${c.key}`}>Category</label>
                        <input id={`c-${c.key}`} list="cat-list" className="field" value={c.category} onChange={(e) => patch(c.key, { category: e.target.value })} />
                      </div>
                    </div>
                    {(badge || c.idConflict) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {badge && <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${badge.tone}`}><AlertTriangle className="h-3 w-3" /> {badge.text}</span>}
                        {c.idConflict && (
                          <label className="inline-flex items-center gap-1.5 text-muted">
                            <input type="checkbox" className="accent-[rgb(var(--c-danger))]" checked={c.overwrite} onChange={(e) => patch(c.key, { overwrite: e.target.checked, selected: e.target.checked ? true : c.selected })} />
                            Replace the saved prompt "{c.idConflict.title}" that has the same ID (otherwise a separate copy is added)
                          </label>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {c.platform && <span className="chip">{c.platform}</span>}
                      {c.tags.map((t) => <span key={t}>#{t}</span>)}
                      <span>{c.content.length.toLocaleString()} characters</span>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-xs text-muted hover:text-fg">View and edit text</summary>
                      <textarea className="field prompt-text mt-2 min-h-[10rem] resize-y p-3" value={c.content} onChange={(e) => patch(c.key, { content: e.target.value })} onBlur={() => recheck(c.key)} aria-label={`Text of ${c.title}`} spellCheck={false} />
                    </details>
                  </div>
                  <div className="flex flex-col">
                    {i > 0 && <button className="icon-btn" title="Merge into the prompt above" aria-label={`Merge "${c.title}" into the prompt above`} onClick={() => mergeUp(i)}><Merge className="h-4 w-4" /></button>}
                    <button className="icon-btn hover:!text-danger" title="Remove from this list" aria-label={`Remove "${c.title}" from the list`} onClick={() => remove(c.key)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {cands.length > shown && (
          <div className="mt-4 text-center">
            <button className="btn" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, cands.length - shown)} more ({cands.length - shown} hidden)</button>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <span className="mr-auto text-xs text-muted">Existing prompts are never deleted by an import.</span>
          <button className="btn" onClick={() => setStep('sources')}>Back</button>
          <button className="btn btn-primary" disabled={!selected.length} onClick={() => (overwriteCount ? setConfirmOverwrite(true) : doImport())}>
            <Check className="h-4 w-4" /> Import {selected.length} prompt{selected.length === 1 ? '' : 's'}
          </button>
        </div>

        <ConfirmDialog open={confirmOverwrite} title="Replace saved prompts?" confirmLabel={`Replace ${overwriteCount}`} danger onCancel={() => setConfirmOverwrite(false)} onConfirm={doImport}>
          <p>{overwriteCount} saved prompt{overwriteCount === 1 ? '' : 's'} will be replaced with the version from this file. The old text cannot be recovered afterwards unless you have a backup.</p>
        </ConfirmDialog>
      </div>
    )
  }

  /* ---------------- step 1 ---------------- */
  const sourceItemCount = parsed.reduce((n, r) => n + r.items.length, 0) + (pasteParsed?.items.length ?? 0)
  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`surface flex flex-col items-center gap-2 border-dashed px-4 py-8 text-center ${dragging ? '!border-brass bg-raised/60' : ''}`}
      >
        <FileUp className="h-6 w-6 text-brass" aria-hidden />
        <p className="text-sm">{restoreOnly ? 'Drop a Prompt Vault backup (.json) here' : 'Drop files here: .txt, .md or .json'}</p>
        <input ref={fileInput} id={restoreOnly ? 'restore-file' : 'import-file'} type="file" multiple={!restoreOnly} accept={restoreOnly ? '.json,application/json' : '.txt,.md,.markdown,.json,text/plain,text/markdown,application/json'} className="sr-only" onChange={(e) => { if (e.target.files) readFiles(e.target.files); e.target.value = '' }} />
        <button className="btn" onClick={() => fileInput.current?.click()}>{restoreOnly ? 'Choose backup file' : 'Choose files'}</button>
      </div>

      {readErrors.length > 0 && (
        <ul className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {readErrors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      {sources.length > 0 && (
        <ul className="space-y-3" aria-label="Files added">
          {sources.map((s, i) => {
            const r = parsed[i]
            const isBackup = r.kind === 'backup'
            return (
              <li key={s.id} className="surface p-4">
                <div className="flex items-start gap-3">
                  {s.kind === 'json' ? <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-brass" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brass" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    {restoreOnly && (
                      isBackup && r.items.length ? (
                        <p className="mt-1 flex items-start gap-1.5 text-sm text-ok"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Valid backup: {r.items.length} prompt{r.items.length === 1 ? '' : 's'}, {r.categories?.length ?? 0} categories. Nothing has been changed yet.</p>
                      ) : (
                        <p className="mt-1 text-sm text-danger">{r.kind === 'backup' ? r.errors[0] ?? 'This backup contains no prompts.' : /not valid JSON/.test(r.errors[0] ?? '') ? r.errors[0] : 'This is not a Prompt Vault backup file. Use Import old prompts for other JSON, text or Markdown files.'}</p>
                      )
                    )}
                    {!restoreOnly && (
                      <p className="mt-0.5 text-xs text-muted">
                        {r.kind === 'chatgpt' ? 'ChatGPT conversation export: your own messages are listed as prompts. ' : r.kind === 'backup' ? 'Prompt Vault backup. ' : ''}
                        {r.items.length} prompt{r.items.length === 1 ? '' : 's'} found{r.errors.length ? `, ${r.errors.length} problem${r.errors.length === 1 ? '' : 's'}` : ''}
                      </p>
                    )}
                    {s.kind === 'text' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`m-${s.id}`}>How to split {s.name}</label>
                        <select id={`m-${s.id}`} className="field !w-auto !py-1.5 text-[13px]" value={s.mode} onChange={(e) => setSources((x) => x.map((y) => (y.id === s.id ? { ...y, mode: e.target.value as SplitMode } : y)))}>
                          {(Object.keys(SPLIT_MODE_LABELS) as SplitMode[]).map((m) => <option key={m} value={m}>{SPLIT_MODE_LABELS[m]}</option>)}
                        </select>
                        {s.mode === 'custom' && <input className="field !w-44 !py-1.5 text-[13px]" aria-label="Custom separator line" placeholder="e.g. ====" value={s.custom} onChange={(e) => setSources((x) => x.map((y) => (y.id === s.id ? { ...y, custom: e.target.value } : y)))} />}
                        <button className="btn btn-sm" onClick={() => { setPaste(s.text); setPasteMode(s.mode); setPasteCustom(s.custom); setSources((x) => x.filter((y) => y.id !== s.id)) }}>Edit as text</button>
                      </div>
                    )}
                  </div>
                  <button className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => setSources((x) => x.filter((y) => y.id !== s.id))}><X className="h-4 w-4" /></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {hasChatGpt && (
        <div className="surface p-4 text-sm">
          <label className="label" htmlFor="minchars">Ignore messages shorter than (characters)</label>
          <input id="minchars" type="number" min={0} max={5000} className="field !w-32" value={minChars} onChange={(e) => setMinChars(Math.max(0, Number(e.target.value) || 0))} />
          <p className="hint">Chat exports contain every message you ever sent. Raise this number to keep only longer, prompt-like messages. You can untick items on the next screen.</p>
        </div>
      )}

      {!restoreOnly && (
        <div>
          <label className="label" htmlFor="paste">Or paste prompts here</label>
          <textarea
            id="paste"
            className="field prompt-text min-h-[14rem] resize-y p-4"
            placeholder={`Paste one or many prompts.\nPut ${IMPORT_SEPARATOR} on its own line between prompts.`}
            value={paste}
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value
              if (!paste.trim() && v.trim()) setPasteMode(detectSplitMode(v))
              setPaste(v)
              setProblem(null)
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm" htmlFor="paste-mode">Split by</label>
            <select id="paste-mode" className="field !w-auto !py-1.5 text-[13px]" value={pasteMode} onChange={(e) => setPasteMode(e.target.value as SplitMode)}>
              {(Object.keys(SPLIT_MODE_LABELS) as SplitMode[]).map((m) => <option key={m} value={m}>{SPLIT_MODE_LABELS[m]}</option>)}
            </select>
            {pasteMode === 'custom' && <input className="field !w-44 !py-1.5 text-[13px]" aria-label="Custom separator line" placeholder="e.g. ====" value={pasteCustom} onChange={(e) => setPasteCustom(e.target.value)} />}
            <button className="btn btn-sm" disabled={!paste.trim()} onClick={() => setPasteMode(detectSplitMode(paste))}>Auto-detect</button>
            {paste.trim() && <span className="text-xs text-muted">{pasteParsed?.items.length ?? 0} prompt{pasteParsed?.items.length === 1 ? '' : 's'} found</span>}
          </div>
        </div>
      )}

      {problem && <p className="text-sm text-danger" role="alert">{problem}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={startReview} disabled={!sources.length && !pasteParsed}>
          Preview {sourceItemCount > 0 ? `${sourceItemCount} prompt${sourceItemCount === 1 ? '' : 's'}` : restoreOnly ? 'restore' : 'import'}
        </button>
        <span className="text-xs text-muted">You will review everything before anything is saved.</span>
      </div>
      {restoreOnly && sources.length > 0 && <p className="text-xs text-muted">Last backup made by this browser: {formatDateTime(settings.lastBackupAt)}</p>}
    </div>
  )
}
