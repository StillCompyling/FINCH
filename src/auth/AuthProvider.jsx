import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../db/supabase.js'

const AuthContext = createContext(null)

const AUTH_TIMEOUT_MS = 10_000

export function AuthProvider({ children }) {
  // undefined = resolving, null = no session, object = authenticated
  const [session, setSession] = useState(undefined)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        console.error('[auth] timed out waiting for session')
        resolved = true
        setAuthError('Sign-in timed out. Please try again.')
        setSession(null)
      }
    }, AUTH_TIMEOUT_MS)

    const resolve = (s) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        setSession(s)
      }
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[auth] getSession error:', error)
        setAuthError(error.message)
      }
      resolve(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Always update session on any auth event so token refresh and
      // sign-in from the hash (#access_token=…) are picked up immediately.
      resolved = true
      clearTimeout(timeout)
      setSession(session)
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, authError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
