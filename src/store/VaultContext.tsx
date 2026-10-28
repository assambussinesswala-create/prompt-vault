import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, UNCATEGORIZED } from '../lib/defaults'
import { makeDemoPrompts } from '../lib/demo'
import { commitCandidates, type ImportCandidate, type ImportSummary } from '../lib/importers'
import { KEYS, clearEverything, loadAll, saveCategories, savePrompts, saveSettings } from '../lib/storage'
import type { Category, Prompt, Settings } from '../lib/types'
import { normalizeTags, nowIso, uid } from '../lib/util'

export interface PromptInput {
  title: string
  content: string
  description: string
  category: string
  tags: string[]
  platform: string
  notes: string
  version: string
}

export interface VaultApi {
  prompts: Prompt[]
  categories: Category[]
  settings: Settings
  loadWarnings: string[]
  storageError: string | null
  dismissStorageError: () => void
  counts: { total: number; favorites: number; categories: number; demo: number }
  getPrompt: (id: string) => Prompt | undefined
  createPrompt: (input: PromptInput) => Prompt
  updatePrompt: (id: string, input: PromptInput) => void
  deletePrompts: (ids: string[]) => void
  duplicatePrompt: (id: string) => Prompt | undefined
  toggleFavorite: (id: string) => void
  markUsed: (id: string) => void
  importCandidates: (cands: ImportCandidate[], parseErrors: string[], extraCategories?: string[]) => ImportSummary
  addCategory: (name: string) => string | null
  renameCategory: (oldName: string, newName: string) => string | null
  deleteCategory: (name: string, reassignTo: string) => void
  loadDemo: () => void
  removeDemo: () => number
  clearAll: () => void
  updateSettings: (patch: Partial<Settings>) => void
  markBackupDone: () => void
}

const Ctx = createContext<VaultApi | null>(null)

export function useVault(): VaultApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useVault must be used inside <VaultProvider>')
  return v
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadAll(), [])
  const [prompts, setPromptsState] = useState<Prompt[]>(initial.prompts)
  const [categories, setCategoriesState] = useState<Category[]>(initial.categories)
  const [settings, setSettingsState] = useState<Settings>(initial.settings)
  const [storageError, setStorageError] = useState<string | null>(null)

  // Refs always hold the latest data so several actions in one tick never overwrite each other.
  const pRef = useRef(prompts)
  const cRef = useRef(categories)
  const sRef = useRef(settings)

  const commitPrompts = useCallback((next: Prompt[]) => {
    pRef.current = next
    setPromptsState(next)
    const r = savePrompts(next)
    setStorageError(r.ok ? null : r.error ?? 'Could not save.')
  }, [])
  const commitCategories = useCallback((next: Category[]) => {
    cRef.current = next
    setCategoriesState(next)
    const r = saveCategories(next)
    if (!r.ok) setStorageError(r.error ?? 'Could not save.')
  }, [])
  const commitSettings = useCallback((next: Settings) => {
    sRef.current = next
    setSettingsState(next)
    const r = saveSettings(next)
    if (!r.ok) setStorageError(r.error ?? 'Could not save.')
  }, [])

  // Apply theme.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', settings.theme === 'dark' ? '#14181f' : '#f4f3f0')
  }, [settings.theme])

  // Pick up changes made in another tab of the same browser.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && !Object.values(KEYS).includes(e.key as never)) return
      const fresh = loadAll()
      pRef.current = fresh.prompts
      cRef.current = fresh.categories
      sRef.current = fresh.settings
      setPromptsState(fresh.prompts)
      setCategoriesState(fresh.categories)
      setSettingsState(fresh.settings)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const ensureCategory = useCallback(
    (name: string) => {
      if (!name) return
      if (!cRef.current.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        commitCategories([...cRef.current, { name, builtIn: false }])
      }
    },
    [commitCategories],
  )

  const api = useMemo<VaultApi>(() => {
    const cleanInput = (i: PromptInput): PromptInput => ({
      title: i.title.trim(),
      content: i.content, // never trimmed or rewritten
      description: i.description.trim(),
      category: i.category.trim() || UNCATEGORIZED,
      tags: normalizeTags(i.tags),
      platform: i.platform.trim(),
      notes: i.notes,
      version: i.version.trim(),
    })

    return {
      prompts,
      categories,
      settings,
      loadWarnings: initial.warnings,
      storageError,
      dismissStorageError: () => setStorageError(null),
      counts: {
        total: prompts.length,
        favorites: prompts.filter((p) => p.favorite).length,
        categories: categories.length,
        demo: prompts.filter((p) => p.isDemo).length,
      },
      getPrompt: (id) => pRef.current.find((p) => p.id === id),

      createPrompt: (input) => {
        const i = cleanInput(input)
        const now = nowIso()
        const p: Prompt = { id: uid(), ...i, createdAt: now, updatedAt: now, lastUsedAt: null, favorite: false }
        ensureCategory(p.category)
        commitPrompts([p, ...pRef.current])
        return p
      },
      updatePrompt: (id, input) => {
        const i = cleanInput(input)
        ensureCategory(i.category)
        commitPrompts(
          pRef.current.map((p) => (p.id === id ? { ...p, ...i, updatedAt: nowIso(), isDemo: undefined } : p)),
        )
      },
      deletePrompts: (ids) => {
        const s = new Set(ids)
        commitPrompts(pRef.current.filter((p) => !s.has(p.id)))
      },
      duplicatePrompt: (id) => {
        const src = pRef.current.find((p) => p.id === id)
        if (!src) return undefined
        const now = nowIso()
        const copy: Prompt = {
          ...src,
          id: uid(),
          title: `${src.title} (copy)`,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: null,
          favorite: false,
          isDemo: undefined,
        }
        commitPrompts([copy, ...pRef.current])
        return copy
      },
      toggleFavorite: (id) => {
        commitPrompts(pRef.current.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)))
      },
      markUsed: (id) => {
        commitPrompts(pRef.current.map((p) => (p.id === id ? { ...p, lastUsedAt: nowIso() } : p)))
      },

      importCandidates: (cands, parseErrors, extraCategories = []) => {
        const { prompts: next, summary } = commitCandidates(
          cands,
          pRef.current,
          cRef.current.map((c) => c.name),
          parseErrors,
        )
        const wanted = [...summary.newCategories]
        for (const c of extraCategories) {
          if (!cRef.current.some((x) => x.name.toLowerCase() === c.toLowerCase()) && !wanted.some((x) => x.toLowerCase() === c.toLowerCase())) wanted.push(c)
        }
        if (wanted.length) commitCategories([...cRef.current, ...wanted.map((name) => ({ name, builtIn: false }))])
        if (summary.imported || summary.overwritten) commitPrompts(next)
        return summary
      },

      addCategory: (name) => {
        const n = name.trim()
        if (!n) return 'Enter a category name.'
        if (n.toLowerCase() === 'all prompts') return '"All Prompts" is a built-in view and cannot be used as a category name.'
        if (cRef.current.some((c) => c.name.toLowerCase() === n.toLowerCase())) return 'A category with this name already exists.'
        commitCategories([...cRef.current, { name: n, builtIn: false }])
        return null
      },
      renameCategory: (oldName, newName) => {
        const n = newName.trim()
        if (oldName === UNCATEGORIZED) return 'Uncategorized is required and cannot be renamed.'
        if (!n) return 'Enter a category name.'
        if (n.toLowerCase() === 'all prompts') return '"All Prompts" is a built-in view and cannot be used as a category name.'
        if (n.toLowerCase() !== oldName.toLowerCase() && cRef.current.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
          return 'A category with this name already exists.'
        }
        commitCategories(cRef.current.map((c) => (c.name === oldName ? { ...c, name: n } : c)))
        commitPrompts(pRef.current.map((p) => (p.category === oldName ? { ...p, category: n } : p)))
        if (sRef.current.defaultCategory === oldName) commitSettings({ ...sRef.current, defaultCategory: n })
        return null
      },
      deleteCategory: (name, reassignTo) => {
        if (name === UNCATEGORIZED) return
        const target = reassignTo && reassignTo !== name ? reassignTo : UNCATEGORIZED
        commitPrompts(pRef.current.map((p) => (p.category === name ? { ...p, category: target } : p)))
        commitCategories(cRef.current.filter((c) => c.name !== name))
        if (sRef.current.defaultCategory === name) commitSettings({ ...sRef.current, defaultCategory: '' })
      },

      loadDemo: () => {
        const have = new Set(pRef.current.map((p) => p.id))
        const fresh = makeDemoPrompts().filter((p) => !have.has(p.id))
        for (const p of fresh) ensureCategory(p.category)
        commitPrompts([...fresh, ...pRef.current])
      },
      removeDemo: () => {
        const n = pRef.current.filter((p) => p.isDemo).length
        commitPrompts(pRef.current.filter((p) => !p.isDemo))
        return n
      },
      clearAll: () => {
        clearEverything()
        const fresh = loadAll()
        pRef.current = []
        cRef.current = fresh.categories
        sRef.current = { ...DEFAULT_SETTINGS }
        setPromptsState([])
        setCategoriesState(fresh.categories)
        setSettingsState({ ...DEFAULT_SETTINGS })
        savePrompts([])
        saveCategories(fresh.categories)
        saveSettings({ ...DEFAULT_SETTINGS })
      },
      updateSettings: (patch) => commitSettings({ ...sRef.current, ...patch }),
      markBackupDone: () => commitSettings({ ...sRef.current, lastBackupAt: nowIso() }),
    }
  }, [prompts, categories, settings, storageError, initial.warnings, commitPrompts, commitCategories, commitSettings, ensureCategory])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
