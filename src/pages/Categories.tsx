import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FolderPlus, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { Modal, ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'
import { DEFAULT_CATEGORIES, UNCATEGORIZED } from '../lib/defaults'
import { useVault } from '../store/VaultContext'

export default function Categories() {
  const { prompts, categories, addCategory, renameCategory, deleteCategory } = useVault()
  const toast = useToast()
  const [name, setName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState(UNCATEGORIZED)

  const count = (c: string) => prompts.filter((p) => p.category === c).length
  const missingDefaults = DEFAULT_CATEGORIES.filter((d) => !categories.some((c) => c.name === d))

  const add = (e: FormEvent) => {
    e.preventDefault()
    const err = addCategory(name)
    setAddError(err)
    if (!err) {
      toast(`Category "${name.trim()}" created`)
      setName('')
    }
  }
  const doRename = (e: FormEvent) => {
    e.preventDefault()
    if (!renaming) return
    const err = renameCategory(renaming, renameValue)
    setRenameError(err)
    if (!err) {
      toast('Category renamed. Its prompts moved with it.')
      setRenaming(null)
    }
  }
  const n = deleting ? count(deleting) : 0

  return (
    <div>
      <h1 className="page-title">Categories</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Group prompts by project or purpose. Uncategorized always exists as a safe place for prompts without a home.</p>

      <form onSubmit={add} className="mb-6 flex max-w-xl flex-wrap items-start gap-2">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="new-cat" className="sr-only">New category name</label>
          <input id="new-cat" className="field" placeholder="New category name" value={name} onChange={(e) => { setName(e.target.value); setAddError(null) }} aria-invalid={!!addError} />
          {addError && <p className="mt-1 text-xs text-danger">{addError}</p>}
        </div>
        <button className="btn btn-primary" type="submit"><FolderPlus className="h-4 w-4" /> Add category</button>
      </form>

      <ul className="surface divide-y divide-line overflow-hidden">
        {categories.map((c) => (
          <li key={c.name} className="flex items-center gap-3 px-4 py-3">
            <CategoryIcon name={c.name} className="h-4 w-4 shrink-0 text-brass" />
            <Link to={`/prompts?category=${encodeURIComponent(c.name)}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brass">{c.name}</Link>
            <span className="text-xs text-muted">{count(c.name)} prompt{count(c.name) === 1 ? '' : 's'}</span>
            {c.name !== UNCATEGORIZED && (
              <span className="flex">
                <button className="icon-btn" aria-label={`Rename ${c.name}`} title="Rename" onClick={() => { setRenaming(c.name); setRenameValue(c.name); setRenameError(null) }}><Pencil className="h-4 w-4" /></button>
                <button className="icon-btn hover:!text-danger" aria-label={`Delete ${c.name}`} title="Delete" onClick={() => { setDeleting(c.name); setMoveTo(UNCATEGORIZED) }}><Trash2 className="h-4 w-4" /></button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {missingDefaults.length > 0 && (
        <button className="btn mt-4" onClick={() => { missingDefaults.forEach((d) => addCategory(d)); toast(`Restored ${missingDefaults.length} default categor${missingDefaults.length === 1 ? 'y' : 'ies'}`) }}>
          <RotateCcw className="h-4 w-4" /> Restore {missingDefaults.length} missing default categor{missingDefaults.length === 1 ? 'y' : 'ies'}
        </button>
      )}

      <Modal open={!!renaming} title="Rename category" onClose={() => setRenaming(null)}>
        <form onSubmit={doRename}>
          <label className="label" htmlFor="rename">New name</label>
          <input id="rename" data-autofocus className="field" value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError(null) }} />
          {renameError && <p className="mt-1 text-xs text-danger">{renameError}</p>}
          <p className="hint">Prompts in this category keep their place under the new name.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setRenaming(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Rename</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete "${deleting ?? ''}"?`}
        confirmLabel="Delete category"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          deleteCategory(deleting, moveTo)
          toast(n ? `Deleted "${deleting}" and moved ${n} prompt${n === 1 ? '' : 's'} to "${moveTo}"` : `Deleted "${deleting}"`, 'info')
          setDeleting(null)
        }}
      >
        {n > 0 ? (
          <>
            <p><strong className="text-fg">{n} prompt{n === 1 ? '' : 's'}</strong> use this category. No prompts are deleted. Choose where they should go:</p>
            <div>
              <label className="label" htmlFor="move-to">Move prompts to</label>
              <select id="move-to" className="field" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {categories.filter((c) => c.name !== deleting).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </>
        ) : (
          <p>This category is empty. Deleting it does not affect any prompts.</p>
        )}
      </ConfirmDialog>
    </div>
  )
}
