export type ThemeMode = 'dark' | 'light'
export type SortMode = 'newest' | 'oldest' | 'edited' | 'alpha'
export type ViewMode = 'grid' | 'list'

/** A single saved prompt. Dates are ISO-8601 strings. */
export interface Prompt {
  id: string
  title: string
  /** The full prompt text. Never trimmed, rewritten or normalised by the app. */
  content: string
  description: string
  /** Category name. Must match a Category.name, otherwise it is shown as "Uncategorized". */
  category: string
  tags: string[]
  /** AI tool or platform, e.g. "Claude", "ChatGPT", "Google Flow". Free text. */
  platform: string
  createdAt: string
  updatedAt: string
  /** Set whenever the prompt is copied. null = never used. */
  lastUsedAt: string | null
  favorite: boolean
  notes: string
  version: string
  /** true only for the built-in demonstration prompts. Cleared as soon as you edit one. */
  isDemo?: boolean
}

export interface Category {
  name: string
  builtIn: boolean
}

export interface Settings {
  theme: ThemeMode
  defaultSort: SortMode
  /** "" means All Prompts. */
  defaultCategory: string
  viewMode: ViewMode
  lastBackupAt: string | null
  backupReminderDays: number
}

export const BACKUP_FORMAT = 'prompt-vault-backup'
export const BACKUP_VERSION = 1

/** Versioned, documented backup file. See README "Backup format". */
export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  app: { name: string; brand: string }
  categories: string[]
  prompts: Prompt[]
}

export const APP_NAME = 'Prompt Vault PK'
export const APP_BRAND = 'Prompt Vault PK'
export const APP_TAGLINE = 'Links, passwords and prompts in one secure vault.'
export const APP_VERSION = '1.0.0'
