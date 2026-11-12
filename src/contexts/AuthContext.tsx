import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabaseClient'
import { AuthContext, type AuthContextValue } from './auth-context'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro na autenticação.'
}

function getOAuthCallbackError(): string | null {
  if (typeof window === 'undefined') return null

  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const error = search.get('error') ?? hash.get('error')
  if (!error) return null

  const errorCode = search.get('error_code') ?? hash.get('error_code')
  const description =
    search.get('error_description') ?? hash.get('error_description') ?? ''

  if (
    error === 'server_error' &&
    errorCode === 'unexpected_failure' &&
    description.includes('Unable to exchange external code')
  ) {
    return 'O Google autenticou sua conta, mas o Supabase não conseguiu trocar o código de autorização. Confira o Client ID e o Client Secret do Google em Supabase > Authentication > Sign In / Providers > Google; eles devem pertencer ao mesmo cliente OAuth e o secret precisa estar atualizado. A URI de callback do Supabase também deve estar cadastrada nas URIs autorizadas do cliente Google.'
  }

  return `Não foi possível concluir o login com Google: ${description || error}. Confira a configuração do provedor Google no Supabase e tente novamente.`
}

function clearOAuthCallbackErrorFromUrl() {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const keys = ['error', 'error_code', 'error_description']
  for (const key of keys) {
    url.searchParams.delete(key)
  }

  const hash = new URLSearchParams(url.hash.slice(1))
  for (const key of keys) {
    hash.delete(key)
  }
  url.hash = hash.size > 0 ? hash.toString() : ''
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(getOAuthCallbackError)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    clearOAuthCallbackErrorFromUrl()

    try {
      const supabase = getSupabaseClient()
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (active) {
          setSession(nextSession)
          if (nextSession) setError(null)
          setLoading(false)
        }
      })
      unsubscribe = () => subscription.unsubscribe()

      void supabase.auth
        .getSession()
        .then(({ data, error: sessionError }) => {
          if (!active) return
          if (sessionError) throw sessionError
          setSession(data.session)
          if (data.session) setError(null)
        })
        .catch((sessionError: unknown) => {
          if (active) setError(errorMessage(sessionError))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    } catch (clientError) {
      // oxlint-disable-next-line react/set-state-in-effect -- Report synchronous client configuration errors during setup.
      setError(errorMessage(clientError))
      setLoading(false)
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setError(null)
    try {
      const { error: authError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (authError) throw authError
    } catch (authError) {
      setError(errorMessage(authError))
      throw authError
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    try {
      const { error: authError } = await getSupabaseClient().auth.signOut()
      if (authError) throw authError
    } catch (authError) {
      setError(errorMessage(authError))
      throw authError
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      error,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, error, signInWithGoogle, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
