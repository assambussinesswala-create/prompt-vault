import { useAuth } from '@clerk/clerk-react'
import { Loader2 } from 'lucide-react'
import { Navigate, Outlet } from 'react-router-dom'

/** Everything inside this route needs a signed-in user. (The server checks again on every request.) */
export function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) {
    return (
      <div className="flex min-h-full items-center justify-center" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin text-brass" aria-hidden />
      </div>
    )
  }
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return <Outlet />
}
