import { Download } from 'lucide-react'
import { ImportWorkflow } from '../components/ImportWorkflow'
import { IMPORT_SEPARATOR } from '../lib/defaults'
import { downloadFile } from '../lib/util'

const EXAMPLE = [
  {
    title: 'Cinematic street chai stall',
    content: 'Create an 8-second cinematic shot of a roadside chai stall at golden hour...',
    description: 'Establishing shot for a comedy video',
    category: 'AI Video Generation',
    tags: ['video', 'cinematic'],
    platform: 'Google Flow',
  },
  { title: 'Only the required fields', content: 'The prompt text is the only required field.' },
]

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title">Import old prompts</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted">
        Bring in prompts you already have. Only files and text that you provide here are read, and nothing is saved until you have reviewed it.
      </p>

      <ImportWorkflow />

      <section className="mt-10" aria-labelledby="fmt-h">
        <h2 id="fmt-h" className="mb-3 font-display text-lg font-bold">Supported formats</h2>
        <div className="space-y-3">
          <details className="surface px-4 py-3" open>
            <summary className="cursor-pointer text-sm font-medium">Text and Markdown (.txt, .md) and pasted text</summary>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <p>Put this line between prompts and the app will split them for you:</p>
              <pre className="overflow-x-auto rounded-lg border border-line bg-ink p-3 font-mono text-xs text-fg">{IMPORT_SEPARATOR}</pre>
              <p>Without that line, the app looks for Markdown headings, then horizontal rules (<code className="font-mono">---</code>). You can also pick another split method, or merge and edit sections on the review screen.</p>
              <p>A first line like <code className="font-mono">Title: My prompt</code> becomes the title. Otherwise the title is guessed from the first line, and your text is left untouched.</p>
            </div>
          </details>
          <details className="surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">JSON (.json)</summary>
            <div className="mt-3 space-y-3 text-sm text-muted">
              <p>An array of objects. Only <code className="font-mono">content</code> is required. Accepted field names: <code className="font-mono">title</code>, <code className="font-mono">content</code> (or <code className="font-mono">prompt</code>, <code className="font-mono">text</code>), <code className="font-mono">description</code>, <code className="font-mono">category</code>, <code className="font-mono">tags</code> (array or comma-separated text), <code className="font-mono">platform</code>, <code className="font-mono">notes</code>, <code className="font-mono">version</code>, <code className="font-mono">favorite</code>.</p>
              <pre className="overflow-x-auto rounded-lg border border-line bg-ink p-3 font-mono text-xs text-fg">{JSON.stringify(EXAMPLE, null, 2)}</pre>
              <button className="btn btn-sm" onClick={() => downloadFile('prompt-vault-import-template.json', JSON.stringify(EXAMPLE, null, 2), 'application/json')}><Download className="h-3.5 w-3.5" /> Download this template</button>
            </div>
          </details>
          <details className="surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">ChatGPT data export</summary>
            <p className="mt-3 text-sm text-muted">In ChatGPT, open Settings, then Data controls, then Export data. Unzip the email attachment and add <code className="font-mono">conversations.json</code> here. The messages you wrote are listed as prompts and you choose which to keep. The app cannot see your chat history on its own.</p>
          </details>
          <details className="surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">Prompt Vault backup (.json)</summary>
            <p className="mt-3 text-sm text-muted">Backups made by this app also work here. For a clear validation step, use <strong className="text-fg">Restore</strong> on the Export and Backup page.</p>
          </details>
        </div>
      </section>
    </div>
  )
}
