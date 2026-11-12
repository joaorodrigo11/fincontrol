import { useState } from 'react'
import { ChevronLeft, ChevronRight, LogOut, Plus } from 'lucide-react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../../contexts/useAuth'

interface AppHeaderProps {
  month: string
  onMonthChange: (month: string) => void
  onAddTransaction: () => void
}

export function AppHeader({
  month,
  onMonthChange,
  onAddTransaction,
}: AppHeaderProps) {
  const { user, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const currentDate = parseISO(`${month}-01`)
  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const name =
    user?.user_metadata.full_name ??
    user?.user_metadata.name ??
    user?.email?.split('@')[0] ??
    'Minha conta'
  const avatar = user?.user_metadata.avatar_url ?? user?.user_metadata.picture

  async function handleSignOut() {
    setSignOutError(null)
    try {
      await signOut()
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Não foi possível sair da conta.',
      )
    }
  }

  return (
    <header className="app-header border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="header-inner">
        <div className="month-control">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => onMonthChange(format(addMonths(currentDate, -1), 'yyyy-MM'))}
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="month-label" aria-live="polite">
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => onMonthChange(format(addMonths(currentDate, 1), 'yyyy-MM'))}
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="header-actions">
          <button
            type="button"
            onClick={onAddTransaction}
            className="primary-button"
          >
            <Plus size={17} />
            <span>Novo lançamento</span>
          </button>
          <div className="hidden items-center gap-2.5 border-l border-[var(--border)] pl-4 md:flex">
            {avatar ? (
              <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--soft)] text-sm font-semibold text-[var(--text)]">
                {String(name).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="max-w-32 truncate text-sm font-medium text-[var(--text)]">
              {name}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title="Sair"
              aria-label="Sair da conta"
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--text)]"
            >
              <LogOut size={17} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            aria-label="Sair da conta"
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--soft)] md:hidden"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
      {signOutError && (
        <p role="alert" className="mx-auto max-w-[1440px] px-8 pb-3 text-right text-xs text-[var(--expense)]">
          {signOutError}
        </p>
      )}
    </header>
  )
}
