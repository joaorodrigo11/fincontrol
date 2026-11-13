import { ArrowDownLeft, ArrowUpRight, Clock3, Plus, Wallet } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useFinance } from '../../contexts/useFinance'
import { getPersonalMonthSummary } from '../../utils/personalMonthSummary'
import { formatCurrencyBRL } from '../../utils/formatters'
import { WalletCard } from '../ui/WalletCard'
import { AnimatedCurrency } from '../ui/AnimatedCurrency'

interface BudgetCardsProps {
  visible: boolean
  onToggle: () => void
  onAddIncome: () => void
}

export function BudgetCards({ visible, onToggle, onAddIncome }: BudgetCardsProps) {
  const { monthTransactions, month, loading, saving, error } = useFinance()
  const summary = getPersonalMonthSummary(monthTransactions, month)
  const unavailable = loading || Boolean(error)
  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR })
  const money = (value: number | null) => unavailable || value === null ? '—' : !visible
    ? <span aria-label="Valor oculto">••••</span> : <AnimatedCurrency value={value} />

  return (
    <section id="orcamento" className="personal-wallet" aria-labelledby="budget-title" aria-busy={loading}>
      <div className="module-heading personal-wallet-heading">
        <div>
          <span className="eyebrow">SEU DINHEIRO, SEM COMPLICAÇÃO</span>
          <h2 id="budget-title">Minha carteira</h2>
        </div>
        <button type="button" className="wallet-income-button" disabled={saving} onClick={onAddIncome}><Plus size={16} />Adicionar receita</button>
      </div>
      <WalletCard open={visible} onToggle={onToggle}>
        <div className="wallet-heading"><span>LÔRO<br /><span className="wallet-subtitle">SEU MÊS, NA CARTEIRA</span></span></div>
        <dl id="wallet-balances" className="personal-wallet-compartments" aria-hidden={!visible}>
          <div className="personal-wallet-pocket">
            <dt><ArrowDownLeft size={17} />Quanto tenho para o mês?</dt>
            <dd className="personal-wallet-amount">{money(summary.awaitingIncome ? null : summary.income)}</dd>
            <dd className="personal-wallet-caption">{!unavailable && summary.awaitingIncome ? 'A receita do mês ainda não está disponível' : 'Receitas recebidas no mês'}</dd>
          </div>
          <div className="personal-wallet-pocket">
            <dt><ArrowUpRight size={17} />Quanto gastei?</dt>
            <dd className="personal-wallet-amount">{money(summary.expenses)}</dd>
            <dd className="personal-wallet-caption">Gastos realizados e na fatura</dd>
          </div>
          <div className={`personal-wallet-pocket personal-wallet-available${!unavailable && summary.available !== null && summary.available < 0 ? ' is-negative' : ''}`}>
            <dt><Wallet size={17} />Quanto ainda posso gastar?</dt>
            <dd className="personal-wallet-amount">{money(summary.available)}</dd>
            <dd className="personal-wallet-caption">{!unavailable && summary.awaitingIncome ? 'Falta a receita deste mês para calcular' : !unavailable && summary.plannedExpenses > 0
              ? visible ? `Já reserva ${formatCurrencyBRL(summary.plannedExpenses)} em previsões` : 'Previsões do mês consideradas'
              : !unavailable && summary.available !== null && summary.available < 0 ? 'Seus gastos ultrapassaram as receitas' : 'Receitas menos os gastos do mês'}</dd>
          </div>
        </dl>
      </WalletCard>
      {!unavailable && summary.awaitingIncome && <div className="personal-wallet-standby" role="status">
        <Clock3 size={21} aria-hidden="true" />
        <div><strong>Aguardando os dados de <span className="capitalize">{monthLabel}</span></strong><p>Ainda não há receita recebida neste mês para calcular quanto você pode gastar. As parcelas e os demais gastos continuam registrados.</p></div>
      </div>}
    </section>
  )
}
