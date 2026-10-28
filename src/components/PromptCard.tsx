import { Link } from 'react-router-dom'
import { Check, Copy, Star } from 'lucide-react'
import type { Prompt } from '../lib/types'
import { relativeTime } from '../lib/util'
import { useVault } from '../store/VaultContext'
import { CategoryIcon } from './CategoryIcon'
import { useCopyPrompt } from './useCopy'

export function DemoBadge() {
  return <span className="rounded border border-brass/50 px-1.5 py-px text-[11px] font-medium text-brass" title="Sample prompt. Remove all demo prompts from the dashboard or Settings.">Demo</span>
}

function preview(p: Prompt, n: number) {
  const src = p.description || p.content
  const flat = src.replace(/\s+/g, ' ').trim()
  return flat.length > n ? flat.slice(0, n) + '…' : flat
}

export function PromptCard({
  prompt: p,
  variant = 'grid',
  selecting,
  selected,
  onToggleSelect,
}: {
  prompt: Prompt
  variant?: 'grid' | 'list'
  selecting?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const { toggleFavorite } = useVault()
  const copy = useCopyPrompt()
  const isList = variant === 'list'
  return (
    <article
      className={`surface group relative flex gap-3 p-4 transition-colors hover:border-muted/60 ${isList ? 'items-center' : 'flex-col'} ${selected ? '!border-brass' : ''}`}
    >
      <div className={`flex min-w-0 flex-1 ${isList ? 'items-center gap-3' : 'flex-col gap-2'}`}>
        <div className="flex min-w-0 items-start gap-2">
          {selecting && (
            <input
              type="checkbox"
              className="relative z-10 mt-1 h-4 w-4 accent-[rgb(var(--c-brass))]"
              checked={!!selected}
              onChange={() => onToggleSelect?.(p.id)}
              aria-label={`Select ${p.title}`}
            />
          )}
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-bold leading-snug">
              <Link to={`/prompt/${p.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                {p.title}
              </Link>
            </h3>
            <p className={`mt-1 text-[13px] text-muted ${isList ? 'line-clamp-1' : 'line-clamp-3'}`}>{preview(p, 220)}</p>
          </div>
        </div>
        <div className={`flex flex-wrap items-center gap-1.5 ${isList ? 'hidden md:flex md:w-72 md:shrink-0' : ''}`}>
          <span className="chip">
            <CategoryIcon name={p.category} className="h-3 w-3" />
            {p.category}
          </span>
          {p.platform && <span className="chip">{p.platform}</span>}
          {p.tags.slice(0, isList ? 1 : 3).map((t) => (
            <span key={t} className="text-xs text-muted">
              #{t}
            </span>
          ))}
          {p.tags.length > (isList ? 1 : 3) && <span className="text-xs text-muted">+{p.tags.length - (isList ? 1 : 3)}</span>}
        </div>
      </div>
      <div className={`relative z-10 flex items-center gap-1 ${isList ? '' : 'justify-between border-t border-line pt-2.5'}`}>
        <span className="flex items-center gap-2 text-xs text-muted">
          {p.isDemo && <DemoBadge />}
          {!isList && <span>{p.lastUsedAt ? `Used ${relativeTime(p.lastUsedAt)}` : `Added ${relativeTime(p.createdAt)}`}</span>}
        </span>
        <span className="flex items-center">
          <button className="icon-btn" onClick={() => copy(p)} aria-label={`Copy ${p.title}`} title="Copy prompt">
            <Copy className="h-4 w-4" />
          </button>
          <button
            className={`icon-btn ${p.favorite ? '!text-brass' : ''}`}
            onClick={() => toggleFavorite(p.id)}
            aria-label={p.favorite ? `Remove ${p.title} from favorites` : `Add ${p.title} to favorites`}
            aria-pressed={p.favorite}
            title={p.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className="h-4 w-4" fill={p.favorite ? 'currentColor' : 'none'} />
          </button>
        </span>
      </div>
      {selected && <Check className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-brass" aria-hidden />}
    </article>
  )
}
