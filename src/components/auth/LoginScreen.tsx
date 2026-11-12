import { useState } from 'react'
import { ArrowRight, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/useAuth'

export function LoginScreen() {
  const { signInWithGoogle, error: authError } = useAuth()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleSignIn() {
    setBusy(true)
    setActionError(null)
    try {
      await signInWithGoogle()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Não foi possível iniciar o login.',
      )
    } finally {
      setBusy(false)
    }
  }

  const error = actionError ?? authError

  return (
    <main className="login-screen relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--soft)] px-5 py-12 text-[var(--text)]">
      <div className="absolute -left-36 -top-32 h-96 w-96 rounded-full bg-[var(--soft)] opacity-70 blur-3xl" />
      <div className="absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-[var(--soft)] opacity-70 blur-3xl" />
      <section className="login-panel relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_28px_90px_-40px_rgba(38,51,39,0.28)] md:grid-cols-[1.05fr_0.95fr]">
        <div className="flex login-story min-h-[26rem] flex-col justify-between bg-[var(--accent)] p-8 text-white sm:p-12">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--soft)] text-[var(--text)]">
              <Wallet size={22} />
            </span>
            <span className="font-semibold tracking-tight">Lôro</span>
          </div>
          <img src="/art/login-parrot.png" alt="" className="login-art" width="1456" height="1068" fetchPriority="high" /><div className="max-w-md py-12">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Sua vida financeira, mais leve
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              Clareza para cuidar do que importa.
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-white/70">
              Organize seu mês, acompanhe suas escolhas e planeje os próximos passos.
            </p>
          </div>
          <p className="text-sm text-white/55">Um espaço só seu, seguro e pessoal.</p>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-12">
          <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--soft)] text-[var(--text)]">
            <ArrowRight size={22} />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">Boas-vindas!</h2>
          <p className="mt-2 max-w-sm leading-6 text-[var(--muted)]">
            Entre com sua conta Google para acessar seu painel financeiro individual.
          </p>
          {error && (
            <p
              className="mt-5 rounded-xl border border-[var(--expense)]/30 bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--expense)]"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={busy}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[var(--accent)] px-5 font-semibold text-white transition hover:bg-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <GoogleMark />
            )}
            {busy ? 'Conectando...' : 'Entrar com Google'}
          </button>
          <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
            Seus dados financeiros são privados e visíveis apenas para você.
          </p>
        </div>
      </section>
    </main>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path
        fill="#FFC107"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.5H5.8v5.2A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#4A90E2"
        d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"
      />
      <path
        fill="#EA4335"
        d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.2c1.6-4.9 6.1-8.5 11.4-8.5Z"
      />
    </svg>
  )
}
