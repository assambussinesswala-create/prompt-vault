import { useCallback } from 'react'
import { useVault } from '../store/VaultContext'
import type { Prompt } from '../lib/types'
import { copyText } from '../lib/util'
import { useToast } from './Toast'

/** Copies the full prompt, records the last-used date and confirms to the user. */
export function useCopyPrompt() {
  const { markUsed } = useVault()
  const toast = useToast()
  return useCallback(
    async (p: Prompt) => {
      const ok = await copyText(p.content)
      if (ok) {
        markUsed(p.id)
        toast(`Copied "${p.title.length > 40 ? p.title.slice(0, 40) + '…' : p.title}" to clipboard`)
      } else {
        toast('Copy failed. Select the text and copy it manually.', 'error')
      }
    },
    [markUsed, toast],
  )
}
