import { useId, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

export function TagInput({ value, onChange, suggestions = [], label = 'Tags' }: { value: string[]; onChange: (t: string[]) => void; suggestions?: string[]; label?: string }) {
  const [draft, setDraft] = useState('')
  const id = useId()
  const listId = useId()
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p)
    onChange(next)
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="field flex flex-wrap items-center gap-1.5 !py-1.5 focus-within:border-brass">
        {value.map((t) => (
          <span key={t} className="chip !text-fg">
            {t}
            <button type="button" className="rounded p-0.5 hover:text-danger" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={listId}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted/70"
          placeholder={value.length ? '' : 'Type a tag, press Enter'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => add(draft)}
        />
        <datalist id={listId}>
          {suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 50).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <p className="hint">Press Enter or comma to add a tag.</p>
    </div>
  )
}
