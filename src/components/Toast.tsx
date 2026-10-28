import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  kind: Kind
}
const Ctx = createContext<(message: string, kind?: Kind) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)
  const push = useCallback((message: string, kind: Kind = 'success') => {
    const id = ++counter.current
    setItems((x) => [...x.slice(-3), { id, message, kind }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 2800)
  }, [])
  const value = useMemo(() => push, [push])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border border-line bg-raised px-3.5 py-2.5 text-sm shadow-lg"
          >
            {t.kind === 'success' && <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />}
            {t.kind === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />}
            {t.kind === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
