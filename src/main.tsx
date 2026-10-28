import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import { SetupNeeded } from './components/SetupNeeded'
import { ToastProvider } from './components/Toast'
import { VaultProvider } from './store/VaultContext'
import './index.css'

// The publishable key is designed to be public. The secret key lives only on the server.
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

function Root() {
  const navigate = useNavigate()
  return (
    <ClerkProvider
      publishableKey={publishableKey as string}
      routerPush={(to: string) => navigate(to)}
      routerReplace={(to: string) => navigate(to, { replace: true })}
      afterSignOutUrl="/sign-in"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{ variables: { colorPrimary: '#2563EB', colorText: '#1E293B', borderRadius: '0.5rem' } }}
    >
      <VaultProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </VaultProvider>
    </ClerkProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publishableKey ? (
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    ) : (
      <SetupNeeded />
    )}
  </StrictMode>,
)
