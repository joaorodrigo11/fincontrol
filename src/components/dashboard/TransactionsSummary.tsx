import { ArrowUpRight, Banknote, ChevronDown, CreditCard, Wallet } from 'lucide-react'
import { useFinance } from '../../contexts/useFinance'
import { formatCurrencyBRL } from '../../utils/formatters'
import { getPersonalMonthSummary } from '../../utils/personalMonthSummary'
import { Lorometro } from './Lorometro'

const methods = [
  { method: 'pix', label: 'Pix', icon: ArrowUpRight },
  { method: 'credit_card', label: 'Crédito', icon: CreditCard },
  { method: 'debit', label: 'Débito', icon: Wallet },
  { method: 'cash', label: 'Dinheiro', icon: Banknote },
] as const

export function TransactionsSummary({ visible = true, onAddIncome }: { visible?: boolean; onAddIncome: () => void }) {
  const { monthTransactions, month, loading, error } = useFinance()
  const summary = getPersonalMonthSummary(monthTransactions, month)
  const money = (value: number) => loading || error ? '—' : !visible ? '••••' : formatCurrencyBRL(value)
  return <section id="resumo-lancamentos" className="support-summary spending-summary dashboard-surface" aria-labelledby="summary-title" aria-busy={loading}>
    <div className="module-heading"><div><span className="eyebrow">ACOMPANHE SEU EQUILÍBRIO</span><h2 id="summary-title">Seu mês em números</h2></div></div>
    <Lorometro visible={visible} onAddIncome={onAddIncome} />
    <details className="payment-breakdown">
    <summary>Gastos por pagamento<ChevronDown size={16} aria-hidden="true" /></summary>
    <p className="payment-breakdown-total">{money(summary.expenses)}<span> realizados e na fatura</span></p>
    {loading || summary.expenseCount > 0 ? <ul className="summary-list payment-summary-list" aria-label="Gastos por forma de pagamento">{methods.map(({ method, label, icon: Icon }) => <li key={method}>
      <span className={`summary-direction payment-summary-icon payment-summary-${method}`} aria-hidden="true"><Icon size={16} /></span>
      <span>{label}</span><strong>{money(summary.byMethod[method])}</strong>
    </li>)}</ul> : <p className="summary-empty spending-summary-empty">Seus gastos vão aparecer aqui.</p>}
    <p className="spending-summary-caption">Previsões ficam fora deste total.</p>
    </details>
    <a className="module-link" href="#lancamentos">Ver todos os lançamentos <ArrowUpRight size={15} /></a>
  </section>
}
