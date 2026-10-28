import { Link, Route, Routes } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from './components/EmptyState'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { SignInPage, SignUpPage } from './pages/AuthPages'
import Backup from './pages/Backup'
import Categories from './pages/Categories'
import Dashboard from './pages/Dashboard'
import ImportPage from './pages/Import'
import LinksPage from './pages/Links'
import PasswordsPage from './pages/Passwords'
import PromptDetail from './pages/PromptDetail'
import PromptEditor from './pages/PromptEditor'
import Prompts from './pages/Prompts'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="links" element={<LinksPage />} />
          <Route path="passwords" element={<PasswordsPage />} />
          <Route path="prompts" element={<Prompts mode="all" />} />
          <Route path="favorites" element={<Prompts mode="favorites" />} />
          <Route path="recent" element={<Prompts mode="recent" />} />
          <Route path="categories" element={<Categories />} />
          <Route path="new" element={<PromptEditor />} />
          <Route path="edit/:id" element={<PromptEditor />} />
          <Route path="prompt/:id" element={<PromptDetail />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="backup" element={<Backup />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <EmptyState icon={<Compass className="h-6 w-6" />} title="Page not found" actions={<Link to="/" className="btn btn-primary">Go to dashboard</Link>}>
                That address does not exist in Prompt Vault PK.
              </EmptyState>
            }
          />
        </Route>
      </Route>
    </Routes>
  )
}
