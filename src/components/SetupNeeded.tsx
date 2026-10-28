import { VaultMark } from './Brand'

/** Shown instead of the app when the Clerk publishable key has not been configured yet. */
export function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-4 py-10">
      <div className="surface p-6">
        <VaultMark className="mb-4 h-12 w-12" />
        <h1 className="font-display text-2xl font-extrabold">One setup step is missing</h1>
        <p className="mt-2 text-sm text-muted">
          Prompt Vault PK needs a sign-in service before it can start. The environment variable <code className="rounded bg-raised px-1 font-mono text-fg">VITE_CLERK_PUBLISHABLE_KEY</code> is not set.
        </p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Create a free application at clerk.com and copy its Publishable key.</li>
          <li>Add it as <code className="rounded bg-raised px-1 font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> (in Vercel, or in a local <code className="rounded bg-raised px-1 font-mono">.env.local</code> file).</li>
          <li>Redeploy (or restart <code className="rounded bg-raised px-1 font-mono">npm run dev</code>).</li>
        </ol>
        <p className="mt-4 text-sm text-muted">The README has the full step-by-step guide.</p>
      </div>
    </div>
  )
}
