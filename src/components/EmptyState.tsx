import type { ReactNode } from 'react'

export function EmptyState({ icon, title, children, actions }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-raised text-brass">{icon}</div>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}
