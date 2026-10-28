import { SignIn, SignUp } from '@clerk/clerk-react'
import type { ReactNode } from 'react'
import { BrandLockup } from '../components/Brand'

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-ink px-4 py-10">
      <BrandLockup />
      {children}
      <p className="max-w-sm text-center text-xs text-muted">Your saved passwords are encrypted on the server. Only you can view them after you sign in.</p>
    </div>
  )
}

export function SignInPage() {
  return (
    <AuthShell>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </AuthShell>
  )
}

export function SignUpPage() {
  return (
    <AuthShell>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthShell>
  )
}
