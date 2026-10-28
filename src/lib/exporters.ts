import { APP_BRAND, APP_NAME, BACKUP_FORMAT, BACKUP_VERSION, type BackupFile, type Prompt } from './types'
import { nowIso, slugify } from './util'

export function buildBackup(prompts: Prompt[], categories: string[]): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    app: { name: APP_NAME, brand: APP_BRAND },
    categories,
    prompts,
  }
}

export const backupToJson = (prompts: Prompt[], categories: string[]) =>
  JSON.stringify(buildBackup(prompts, categories), null, 2)

/** Plain text export is the prompt text only, byte-for-byte. */
export const promptToTxt = (p: Prompt) => p.content

export function promptToMarkdown(p: Prompt): string {
  const meta: string[] = []
  meta.push(`- **Category:** ${p.category}`)
  if (p.platform) meta.push(`- **Platform:** ${p.platform}`)
  if (p.tags.length) meta.push(`- **Tags:** ${p.tags.join(', ')}`)
  if (p.version) meta.push(`- **Version:** ${p.version}`)
  meta.push(`- **Created:** ${p.createdAt}`)
  meta.push(`- **Last edited:** ${p.updatedAt}`)
  const parts = [`# ${p.title}`, '', meta.join('\n')]
  if (p.description) parts.push('', `> ${p.description.replace(/\n+/g, ' ')}`)
  parts.push('', '## Prompt', '', p.content)
  if (p.notes.trim()) parts.push('', '## Notes', '', p.notes)
  return parts.join('\n') + '\n'
}

export const promptsToMarkdown = (list: Prompt[]) =>
  list.map(promptToMarkdown).join('\n\n---\n\n')

export const fileNameFor = (p: Prompt, ext: string) => `${slugify(p.title)}.${ext}`
