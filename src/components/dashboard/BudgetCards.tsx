import { WalletCard } from '../ui/WalletCard'
import { AnimatedCurrency } from '../ui/AnimatedCurrency'
import { useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, CreditCard, Wallet } from 'lucide-react'
import { useFinance } from '../../contexts/useFinance'
import { formatCurrencyBRL } from '../../utils/formatters'
import { ProgressBar } from '../ui/ProgressBar'

export function BudgetCards() {
  const { budget, month } = useFinance()
  const [valuesVisible, setValuesVisible] = useState(() => {
    try { return localStorage.getItem('loro-wallet-private') !== 'true' } catch { return true }
  })
  function toggleValues() {
    const next = !valuesVisible
    setValuesVisible(next)
    try { localStorage.setItem('loro-wallet-private', String(!next)) } catch { /* A privacidade funciona sem armazenamento. */ }
  }
  return (
    <BudgetCardsContent
      key={`${month}:${budget?.available_cash ?? 0}:${budget?.credit_limit ?? 0}`}
      valuesVisible={valuesVisible}
      onToggleValues={toggleValues}
    />
  )
}

function BudgetCardsContent({ valuesVisible, onToggleValues }: { valuesVisible: boolean; onToggleValues: () => void }) {
  const {
    budget,
    cashBalance,
    cashExpenses,
    cashIncome,
    cashUsagePercent,
    cashAlert,
    creditRemaining,
    creditUsed,
    creditUsagePercent,
    creditAlert,
    saveBudget,
    saving,
  } = useFinance()
  const [availableCash, setAvailableCash] = useState(String(budget?.available_cash ?? 0))
  const [creditLimitInput, setCreditLimitInput] = useState(String(budget?.credit_limit ?? 0))
  const [message, setMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setSaveError(null)
    try {
      await saveBudget({
        available_cash: Number(availableCash.replace(',', '.')),
        credit_limit: Number(creditLimitInput.replace(',', '.')),
      })
      setMessage('Orçamento atualizado.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar o orçamento.')
    }
  }

  const usageLabel = (percentage: number) =>
    !valuesVisible ? 'Valores ocultos' : percentage > 100 ? `${Math.round(percentage)}% · Acima do limite` : `${Math.round(percentage)}% utilizado`
  const money = (value: number) => valuesVisible ? formatCurrencyBRL(value) : '••••'

  return (
    <section id="orcamento" aria-labelledby="budget-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.19em] text-[var(--muted)]">
            Seu mês, em equilíbrio
          </p>
          <h2 id="budget-title" className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">
            Orçamento mensal
          </h2>
        </div>
        {(message || saveError) && (
          <p
            role={saveError ? 'alert' : 'status'}
            className={`text-sm ${saveError ? 'text-[var(--expense)]' : 'text-[var(--text)]'}`}
          >
            {saveError ?? message}
          </p>
        )}
      </div>

      <WalletCard open={valuesVisible} onToggle={onToggleValues}>
        <div className="wallet-heading">
          <span>LÔRO<br /><span className="wallet-subtitle">CARTEIRA DO MÊS</span></span>
        </div>
        <div id="wallet-balances" className="budget-grid grid gap-4 lg:grid-cols-2" aria-hidden={!valuesVisible}>
        <article className="balance-panel rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_8px_24px_-22px_rgba(38,51,39,0.35)] sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--soft)] text-[var(--text)]">
                <Wallet size={20} />
              </span>
              <div>
                <h3 className="font-semibold text-[var(--text)]">Saldo livre</h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Salário e entradas extras</p>
              </div>
            </div>
            <ArrowDownLeft className="text-[var(--muted)]" size={19} />
          </div>
          <p className="mt-6 text-3xl font-semibold tracking-tight text-[var(--text)]">
            {valuesVisible ? <AnimatedCurrency value={cashBalance} /> : <span>••••••</span>}
          </p>
          <div className="mt-5">
            <div className="mb-2 flex justify-between gap-2 text-xs text-[var(--muted)]">
              <span>{money(cashExpenses)} de {money((budget?.available_cash ?? 0) + cashIncome)} utilizados</span>
              <span>{usageLabel(cashUsagePercent)}</span>
            </div>
            {valuesVisible ? <ProgressBar value={cashUsagePercent} alert={cashAlert} label="Uso do orçamento em conta" /> : <div className="progress-track rounded-full" />}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]">
            <ArrowUpRight size={14} className="text-[var(--muted)]" />
            Base {money(budget?.available_cash ?? 0)} · Entradas {money(cashIncome)}
          </div>
        </article>

        <article className="balance-panel rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_8px_24px_-22px_rgba(38,51,39,0.35)] sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--soft)] text-[var(--muted)]">
                <CreditCard size={20} />
              </span>
              <div>
                <h3 className="font-semibold text-[var(--text)]">Crédito disponível</h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Limite menos compras do mês</p>
              </div>
            </div>
            <ArrowDownLeft className="text-[var(--muted)]" size={19} />
          </div>
          <p className="mt-6 text-3xl font-semibold tracking-tight text-[var(--text)]">
            {valuesVisible ? <AnimatedCurrency value={creditRemaining} /> : <span>••••••</span>}
          </p>
          <div className="mt-5">
            <div className="mb-2 flex justify-between gap-2 text-xs text-[var(--muted)]">
              <span>{money(creditUsed)} de {money(budget?.credit_limit ?? 0)} utilizados</span>
              <span>{usageLabel(creditUsagePercent)}</span>
            </div>
            {valuesVisible ? <ProgressBar value={creditUsagePercent} alert={creditAlert} label="Uso do limite de crédito" /> : <div className="progress-track rounded-full" />}
          </div>
          <div className="mt-4 text-xs text-[var(--muted)]">
            Limite mensal {money(budget?.credit_limit ?? 0)}
          </div>
        </article>
      </div>

      </WalletCard>
      {!valuesVisible && <p role="status" className="wallet-private-notice">Valores da carteira ocultos. Abra a carteira para consultar ou editar seu orçamento.</p>}
      {valuesVisible && <form
        onSubmit={(event) => void handleSave(event)}
        className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 sm:flex-row sm:items-end"
      >
        <label className="flex-1 text-xs font-semibold text-[var(--muted)]">
          Salário / dinheiro disponível
          <span className="mt-1.5 flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <span className="mr-2 text-[var(--muted)]">R$</span>
            <input
              aria-label="Salário ou dinheiro disponível no mês"
              type="number"
              min="0"
              step="0.01"
              value={availableCash}
              onChange={(event) => setAvailableCash(event.target.value)}
              className="w-full bg-transparent text-sm font-medium text-[var(--text)] outline-none"
            />
          </span>
        </label>
        <label className="flex-1 text-xs font-semibold text-[var(--muted)]">
          Limite de crédito do mês
          <span className="mt-1.5 flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <span className="mr-2 text-[var(--muted)]">R$</span>
            <input
              aria-label="Limite de crédito do mês"
              type="number"
              min="0"
              step="0.01"
              value={creditLimitInput}
              onChange={(event) => setCreditLimitInput(event.target.value)}
              className="w-full bg-transparent text-sm font-medium text-[var(--text)] outline-none"
            />
          </span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--soft)] disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar orçamento'}
        </button>
      </form>}
    </section>
  )
}
