import type { Settings } from './types'

export const UNCATEGORIZED = 'Uncategorized'

/** "All Prompts" is a view, not a stored category. */
export const DEFAULT_CATEGORIES: string[] = [
  'AI Video Generation',
  'Google Flow Prompts',
  'Funny Pakistani Videos',
  'YouTube Thumbnail Prompts',
  'Image Generation',
  'Success Blueprint Interviews',
  'Interview Questions',
  'YouTube Descriptions',
  'English Learning',
  'Arabic Learning',
  'Turkish Learning',
  'Chinese Learning',
  'AI Agents and Instructions',
  'Business and Entrepreneurship',
  'Website and Coding',
  'Personal Projects',
  UNCATEGORIZED,
]

export const PLATFORM_SUGGESTIONS = [
  'Claude',
  'ChatGPT',
  'Google Flow',
  'Gemini',
  'Veo',
  'Sora',
  'Midjourney',
  'DALL·E',
  'Grok',
  'DeepSeek',
  'Perplexity',
  'Other',
]

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  defaultSort: 'newest',
  defaultCategory: '',
  viewMode: 'grid',
  lastBackupAt: null,
  backupReminderDays: 7,
}

export const IMPORT_SEPARATOR = '--- PROMPT BREAK ---'
