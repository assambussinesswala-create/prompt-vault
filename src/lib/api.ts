import { useAuth } from '@clerk/clerk-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PasswordMeta, SavedLink } from './saver'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  return 'Something went wrong. Please try again.'
}

interface CallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

/**
 * Returns a function that calls our own /api endpoints with the signed-in user's
 * session token. The token is fetched fresh for every request (Clerk keeps it short-lived).
 */
export function useApi() {
  const { getToken } = useAuth()
  const tokenRef = useRef(getToken)
  tokenRef.current = getToken
  return useCallback(async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
    const token = await tokenRef.current()
    if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401)
    const hasBody = options.body !== undefined
    let res: Response
    try {
      res = await fetch(path, {
        method: options.method ?? 'GET',
        headers: hasBody ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { Authorization: `Bearer ${token}` },
        body: hasBody ? JSON.stringify(options.body) : undefined,
        cache: 'no-store',
      })
    } catch {
      throw new ApiError('Could not reach the server. Check your internet connection and try again.', 0)
    }
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    if (!res.ok) {
      const msg = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : 'The request failed. Please try again.'
      throw new ApiError(res.status === 401 ? 'Your session has expired. Please sign in again.' : msg, res.status)
    }
    return data as T
  }, [])
}

export type LoadStatus = 'loading' | 'ready' | 'error'

function useList<T>(path: string, pick: (data: never) => T[]) {
  const api = useApi()
  const [items, setItems] = useState<T[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState('')
  const pickRef = useRef(pick)
  pickRef.current = pick
  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await api<never>(path)
      setItems(pickRef.current(data))
      setStatus('ready')
    } catch (e) {
      setError(errorMessage(e))
      setStatus('error')
    }
  }, [api, path])
  useEffect(() => {
    void load()
  }, [load])
  return { items, setItems, status, error, reload: load }
}

export function useLinks() {
  return useList<SavedLink>('/api/links', (d: { links: SavedLink[] }) => d.links)
}

export function usePasswords() {
  return useList<PasswordMeta>('/api/passwords', (d: { entries: PasswordMeta[] }) => d.entries)
}
