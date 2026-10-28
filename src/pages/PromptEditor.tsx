import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Copy, Eye, FileQuestion, Pencil, Save } from 'lucide-react'
import { ConfirmDialog } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { TagInput } from '../components/TagInput'
import { useToast } from '../components/Toast'
import { PLATFORM_SUGGESTIONS } from '../lib/defaults'
import { Markdown } from '../lib/markdown'
import { copyText } from '../lib/util'
import { useVault, type PromptInput } from '../store/VaultContext'

const NEW = '__new__'

export default function PromptEditor() {
  const { id } = useParams()
  const editing = !!id
  const nav = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const { prompts, categories, settings, createPrompt, updatePrompt } = useVault()
  const existing = editing ? prompts.find((p) => p.id === id) : undefined

  const initial = useMemo<PromptInput>(
    () =>
      existing
        ? { title: existing.title, content: existing.content, description: existing.description, category: existing.category, tags: existing.tags, platform: existing.platform, notes: existing.notes, version: existing.version }
        : { title: '', content: '', description: '', category: params.get('category') || settings.defaultCategory || 'Uncategorized', tags: [], platform: '', notes: '', version: '' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existing?.id],
  )
  const [f, setF] = useState<PromptInput>(initial)
  const [newCat, setNewCat] = useState('')
  const [catChoice, setCatChoice] = useState(initial.category)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [errors, setErrors] = useState<{ title?: string; content?: string; category?: string }>({})
  const [confirmLeave, setConfirmLeave] = useState(false)
  const saved = useRef(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(initial) && !saved.current

  useEffect(() => {
    setF(initial)
    setCatChoice(initial.category)
  }, [initial])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const set = <K extends keyof PromptInput>(k: K, v: PromptInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const allTags = useMemo(() => [...new Set(prompts.flatMap((p) => p.tags))], [prompts])
  const platforms = useMemo(() => [...new Set([...PLATFORM_SUGGESTIONS, ...prompts.map((p) => p.platform).filter(Boolean)])], [prompts])

  const save = () => {
    const category = catChoice === NEW ? newCat.trim() : catChoice
    const e: typeof errors = {}
    if (!f.title.trim()) e.title = 'Give this prompt a title.'
    if (!f.content.trim()) e.content = 'The prompt text cannot be empty.'
    if (catChoice === NEW && !category) e.category = 'Enter a name for the new category.'
    if (catChoice === NEW && category.toLowerCase() === 'all prompts') e.category = '"All Prompts" is reserved. Choose another name.'
    setErrors(e)
    if (Object.keys(e).length) {
      toast('Fix the highlighted fields to save.', 'error')
      return
    }
    saved.current = true
    const input = { ...f, category }
    if (editing && existing) {
      updatePrompt(existing.id, input)
      toast('Changes saved')
      nav(`/prompt/${existing.id}`)
    } else {
      const p = createPrompt(input)
      toast('Prompt saved to your vault')
      nav(`/prompt/${p.id}`)
    }
  }
  const cancel = () => {
    if (dirty) setConfirmLeave(true)
    else nav(editing && existing ? `/prompt/${existing.id}` : '/prompts')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (editing && !existing) {
    return (
      <EmptyState icon={<FileQuestion className="h-6 w-6" />} title="Prompt not found" actions={<Link to="/prompts" className="btn btn-primary">Back to the vault</Link>}>
        It may have been deleted.
      </EmptyState>
    )
  }

  const words = f.content.trim() ? f.content.trim().split(/\s+/).length : 0
  const lines = f.content ? f.content.split('\n').length : 0

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title mb-5">{editing ? 'Edit prompt' : 'New prompt'}</h1>

      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className={`field ${errors.title ? '!border-danger' : ''}`} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Cinematic street chai stall" aria-invalid={!!errors.title} aria-describedby={errors.title ? 'title-err' : undefined} autoFocus={!editing} />
          {errors.title && <p id="title-err" className="mt-1 text-xs text-danger">{errors.title}</p>}
        </div>

        <div>
          <label className="label" htmlFor="desc">Short description <span className="font-normal text-muted">(optional)</span></label>
          <input id="desc" className="field" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="One line about what this prompt does" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="label !mb-0" htmlFor="content">Prompt</label>
            <div className="flex items-center gap-1">
              <div className="flex rounded-lg border border-line text-xs" role="group" aria-label="Editor mode">
                <button type="button" className={`flex items-center gap-1 px-2.5 py-1.5 ${mode === 'write' ? 'rounded-l-lg bg-raised font-medium' : 'text-muted'}`} onClick={() => setMode('write')} aria-pressed={mode === 'write'}><Pencil className="h-3 w-3" /> Write</button>
                <button type="button" className={`flex items-center gap-1 px-2.5 py-1.5 ${mode === 'preview' ? 'rounded-r-lg bg-raised font-medium' : 'text-muted'}`} onClick={() => setMode('preview')} aria-pressed={mode === 'preview'}><Eye className="h-3 w-3" /> Preview</button>
              </div>
              <button type="button" className="btn btn-sm" disabled={!f.content} onClick={async () => {
                  const ok = await copyText(f.content)
                  toast(ok ? 'Prompt text copied' : 'Copy failed. Select the text and copy it manually.', ok ? 'success' : 'error')
                }}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
          {mode === 'write' ? (
            <textarea
              id="content"
              className={`field prompt-text min-h-[22rem] resize-y !whitespace-pre-wrap p-4 ${errors.content ? '!border-danger' : ''}`}
              value={f.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="Paste or write your full prompt here. Line breaks, Markdown and emojis are kept exactly as typed."
              spellCheck={false}
              aria-invalid={!!errors.content}
              aria-describedby="content-hint"
            />
          ) : (
            <div className="field min-h-[22rem] overflow-auto p-4" aria-label="Markdown preview">
              {f.content.trim() ? <Markdown text={f.content} /> : <p className="text-muted">Nothing to preview yet.</p>}
            </div>
          )}
          <div id="content-hint" className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted">
            <span className={errors.content ? 'text-danger' : ''}>{errors.content ?? 'Your text is saved exactly as written. Nothing is rewritten or trimmed.'}</span>
            <span>{f.content.length.toLocaleString()} characters · {words.toLocaleString()} words · {lines.toLocaleString()} lines</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" className="field" value={catChoice} onChange={(e) => setCatChoice(e.target.value)}>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              {!categories.some((c) => c.name === catChoice) && catChoice !== NEW && <option value={catChoice}>{catChoice}</option>}
              <option value={NEW}>+ New category…</option>
            </select>
            {catChoice === NEW && (
              <>
                <input className={`field mt-2 ${errors.category ? '!border-danger' : ''}`} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" aria-label="New category name" />
                {errors.category && <p className="mt-1 text-xs text-danger">{errors.category}</p>}
              </>
            )}
          </div>
          <div>
            <label className="label" htmlFor="platform">AI tool or platform</label>
            <input id="platform" list="platform-list" className="field" value={f.platform} onChange={(e) => set('platform', e.target.value)} placeholder="Claude, ChatGPT, Google Flow…" />
            <datalist id="platform-list">{platforms.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor="version">Version <span className="font-normal text-muted">(optional)</span></label>
            <input id="version" className="field" value={f.version} onChange={(e) => set('version', e.target.value)} placeholder="e.g. 1.2" />
          </div>
        </div>

        <TagInput value={f.tags} onChange={(t) => set('tags', t)} suggestions={allTags} />

        <div>
          <label className="label" htmlFor="notes">Notes <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="notes" className="field min-h-[6rem] resize-y" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Settings used, results you got, ideas to improve it…" />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-end gap-2 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {dirty && <span className="mr-auto text-xs text-muted">Unsaved changes</span>}
        <button className="btn" onClick={cancel}>Cancel</button>
        <button className="btn btn-primary" onClick={save}><Save className="h-4 w-4" /> {editing ? 'Save changes' : 'Save prompt'}</button>
      </div>

      <ConfirmDialog open={confirmLeave} title="Discard your changes?" confirmLabel="Discard" danger onCancel={() => setConfirmLeave(false)} onConfirm={() => { saved.current = true; setConfirmLeave(false); nav(editing && existing ? `/prompt/${existing.id}` : '/prompts') }}>
        <p>You have unsaved edits. If you leave now they will be lost.</p>
      </ConfirmDialog>
    </div>
  )
}
