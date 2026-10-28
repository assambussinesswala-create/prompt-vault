export function VaultMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Prompt Vault PK logo">
      <rect width="64" height="64" rx="14" fill="rgb(var(--c-brass))" />
      <rect x="15" y="17" width="34" height="30" rx="6" fill="none" stroke="rgb(var(--c-brass-ink))" strokeWidth="4" />
      <circle cx="32" cy="31" r="5.5" fill="rgb(var(--c-brass-ink))" />
      <path d="M32 36v6" stroke="rgb(var(--c-brass-ink))" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <VaultMark className={compact ? 'h-8 w-8' : 'h-9 w-9'} />
      <div className="flex items-baseline gap-1.5 font-display text-[17px] font-extrabold leading-none tracking-tight text-navy">
        Prompt Vault
        <span className="rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-bold leading-none text-brass">PK</span>
      </div>
    </div>
  )
}
