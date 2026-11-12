import { lazy, Suspense, useState } from 'react'
import { AlertCircle, Sparkles, House, Plus, ChartNoAxesCombined, ListOrdered } from 'lucide-react'
import { useAuth } from './contexts/useAuth'
import { useFinance } from './contexts/useFinance'
import { LoginScreen } from './components/auth/LoginScreen'
import { AppHeader } from './components/dashboard/AppHeader'
import { BudgetCards } from './components/dashboard/BudgetCards'
import { NewTransactionModal } from './components/transactions/NewTransactionModal'
import { TransactionsList } from './components/transactions/TransactionsList'
import { LoadingScreen } from './components/ui/LoadingScreen'
import { Sidebar } from './components/dashboard/Sidebar'
import { TransactionsSummary } from './components/dashboard/TransactionsSummary'
import { Lorometro } from './components/dashboard/Lorometro'

const ExpenseInsights = lazy(
  () => import('./components/dashboard/ExpenseInsights').then((module) => ({ default: module.ExpenseInsights })),
)
const MonthlySpendingDashboard = lazy(
  () => import('./components/dashboard/MonthlySpendingDashboard').then((module) => ({ default: module.MonthlySpendingDashboard })),
)

function App() {
  const { user, loading: authLoading } = useAuth()
  const { month, setMonth, loading, error, refresh } = useFinance()
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)

  if (authLoading) return <LoadingScreen />
  if (!user) return <LoginScreen />

  return (
    <div id="inicio" className="app-shell min-h-screen">
      <Sidebar />
      <div className="app-content">
      <AppHeader
        month={month}
        onMonthChange={setMonth}
        onAddTransaction={() => setTransactionModalOpen(true)}
      />
      <main className="dashboard-main">
        <div className="dashboard-intro mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
              <Sparkles size={16} className="text-[var(--muted)]" />
              Seu espaço financeiro pessoal
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[var(--muted)] sm:text-4xl">
              Olá, {String(user.user_metadata.first_name ?? user.user_metadata.name ?? 'vamos organizar?').split(' ')[0]}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              Pode relaxar. Com o Lôro, cuidar do seu dinheiro fica mais fácil. 😎
            </p>
          </div>
          {loading && (
            <span role="status" className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
              Atualizando seus dados
            </span>
          )}
          <img className="dashboard-mascot" src="/art/login-parrot.png" alt="" width="120" height="100" />
        </div>

        {error && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
            <span className="flex items-start gap-2.5">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>
                <strong className="font-semibold">Não foi possível atualizar os dados.</strong>{' '}
                {error}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void refresh().catch(() => undefined)}
              className="rounded-lg border border-[var(--warning)]/30 px-3 py-1.5 text-xs font-semibold hover:bg-[var(--warning-soft)]"
            >
              Tentar novamente
            </button>
          </div>
        )}

        <div className="dashboard-grid">
          <BudgetCards />
          <Lorometro />

          <Suspense
            fallback={
              <div className="grid min-h-72 place-items-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--muted)]">
                Carregando gráficos...
              </div>
            }
          >
            <ExpenseInsights variant="ranking" />
            <TransactionsSummary />
            <MonthlySpendingDashboard />
            <ExpenseInsights />
            <TransactionsList />
          </Suspense>
        </div>
        <footer className="mt-12 border-t border-[var(--border)] pt-5 text-center text-xs text-[var(--muted)]">
          Seus dados são privados e sincronizados com segurança.
        </footer>
      </main>
      </div>
      <nav className="mobile-nav" aria-label="Navegação principal">
        <a href="#inicio" aria-label="Início"><House size={21} /><span>Início</span></a>
        <a href="#lancamentos" aria-label="Lançamentos"><ListOrdered size={21} /><span>Registros</span></a>
        <button type="button" className="nav-add" aria-label="Novo lançamento" onClick={() => setTransactionModalOpen(true)}>
          <Plus size={27} />
        </button>
        <a href="#previsao-mensal" aria-label="Gastos previstos do mês"><ChartNoAxesCombined size={21} /><span>Cartão e Pix</span></a>
        <a href="#analises" aria-label="Análises"><Sparkles size={21} /><span>Análises</span></a>
      </nav>
      <NewTransactionModal
        key={transactionModalOpen ? 'novo-lancamento' : 'fechado'}
        open={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
      />
    </div>
  )
}

export default App
