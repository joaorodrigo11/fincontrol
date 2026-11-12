import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useFinance } from '../../contexts/useFinance'
import { formatCurrencyBRL } from '../../utils/formatters'

export function TransactionsSummary() {
  const { monthTransactions } = useFinance()
  const recent = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  return <section id="resumo-lancamentos" className="support-summary dashboard-surface" aria-labelledby="summary-title">
    <div className="module-heading"><span className="eyebrow">EM DIA COM VOCÊ</span><h2 id="summary-title">Seus lançamentos</h2></div>
    <p className="summary-number">{monthTransactions.length}<span>registros no mês</span></p>
    {recent.length ? <ul className="summary-list">{recent.map(item => <li key={item.id}>
      <span className={`summary-direction ${item.type === 'income' ? 'is-income' : ''}`}>{item.type === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
      <span>{item.title}</span><strong>{item.type === 'income' ? '+' : '−'} {formatCurrencyBRL(item.amount)}</strong>
    </li>)}</ul> : <div className="summary-empty"><img src="/art/empty.svg" alt="" width="100" height="75" /><p>Seus primeiros passos aparecem aqui.</p></div>}
    <a className="module-link" href="#lancamentos">Ver todos os lançamentos <ArrowUpRight size={15} /></a>
  </section>
}
