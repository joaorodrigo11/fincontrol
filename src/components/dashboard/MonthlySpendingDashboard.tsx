import { motion, useReducedMotion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useFinance } from '../../contexts/useFinance'
import { getMonthlySpending } from '../../utils/monthlySpending'
import { formatCurrencyBRL } from '../../utils/formatters'
import { AnimatedCurrency } from '../ui/AnimatedCurrency'

export function MonthlySpendingDashboard() {
  const { monthTransactions, month, loading } = useFinance()
  const reduced = useReducedMotion()
  const totals = getMonthlySpending(monthTransactions, month)
  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR })
  const cards = [
    { key: 'credit', title: 'Cartão de crédito', image: '/art/parrot-credit-v2.png', values: totals.credit,
      art: { width: 1448, height: 1086, left: 188, top: 58, visibleWidth: 1046, visibleHeight: 976 },
      lines: [{ label: 'Na fatura', value: totals.credit.pending }, { label: 'Ainda previsto', value: totals.credit.planned }] },
    { key: 'pix', title: 'Pix', image: '/art/parrot-pix-v2.png', values: totals.pix,
      art: { width: 1448, height: 1086, left: 212, top: 28, visibleWidth: 815, visibleHeight: 1026 },
      lines: [{ label: 'A pagar', value: totals.pix.planned + totals.pix.pending }, { label: 'Já realizado', value: totals.pix.paid }] },
  ]

  return (
    <section id="previsao-mensal" aria-labelledby="monthly-spending-title" aria-busy={loading}>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.19em] text-[var(--accent)]">Seu mês em movimento</p>
        <h2 id="monthly-spending-title" className="mt-1 text-xl font-semibold tracking-tight">Gastos previstos do mês</h2>
        <p className="mt-1 text-sm capitalize text-[var(--muted)]">{monthLabel}</p>
      </div>
      <div className="monthly-spending-cards">
        {cards.map((card, index) => (
          <motion.article key={card.key} className={`monthly-spending-card monthly-spending-${card.key}`}
            initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 130, damping: 22, delay: reduced ? 0 : index * .08 }}>
            <div className="monthly-spending-art" aria-hidden="true">
              <div className="payment-mascot" style={{ aspectRatio: `${card.art.visibleWidth} / ${card.art.visibleHeight}` }}>
                <img src={card.image} alt="" width={card.art.width} height={card.art.height} decoding="async" style={{
                  width: `${card.art.width / card.art.visibleWidth * 100}%`,
                  height: `${card.art.height / card.art.visibleHeight * 100}%`,
                  left: `${-card.art.left / card.art.visibleWidth * 100}%`,
                  top: `${-card.art.top / card.art.visibleHeight * 100}%`,
                }} />
              </div>
              <span className="monthly-spending-glow" />
            </div>
            <div className="monthly-spending-content">
              <div className="monthly-spending-heading"><h3>{card.title}</h3><span>PREVISÃO DO MÊS</span></div>
              <p className="monthly-spending-value">{loading ? <span aria-label="Carregando valores">—</span> : <AnimatedCurrency value={card.values.planned + card.values.pending} />}</p>
              <p className="monthly-spending-caption">
                {loading ? 'Atualizando seus lançamentos…' : card.values.count
                  ? `${card.values.count} ${card.values.count === 1 ? 'gasto a pagar' : 'gastos a pagar'} em ${monthLabel}`
                  : 'Nenhum gasto previsto para este mês.'}
              </p>
              <dl className="monthly-spending-details">
                {card.lines.map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{loading ? '—' : formatCurrencyBRL(line.value)}</dd></div>)}
              </dl>
            </div>
          </motion.article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Valores dos lançamentos cadastrados no mês selecionado. Gastos já pagos ficam fora da previsão.</p>
    </section>
  )
}
