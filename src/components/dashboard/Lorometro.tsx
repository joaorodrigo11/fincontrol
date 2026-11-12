import { motion, useReducedMotion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useFinance } from '../../contexts/useFinance'
import { AnimatedCurrency } from '../ui/AnimatedCurrency'
import { formatCurrencyBRL } from '../../utils/formatters'
import { getLorometro } from './lorometro-summary'

const stages = {
  healthy: { label: 'Saudável até demais', image: '/art/lorometro-relaxed.png', message: 'O Lôro está tranquilo: até metade do orçamento está comprometida.' },
  warning: { label: 'Olhar o sinal', image: '/art/lorometro-thinking.png', message: 'O Lôro ficou pensativo: mais da metade do orçamento já tem destino.' },
  danger: { label: 'Freie com força', image: '/art/lorometro-panic.png', message: 'O Lôro acendeu o alerta: mais de 80% do orçamento está comprometido.' },
  unconfigured: { label: 'Vamos calibrar o Lorômetro?', image: '/art/lorometro-thinking.png', message: 'Cadastre seu orçamento em dinheiro e seu limite de crédito para começar.' },
}

export function Lorometro() {
  const { monthTransactions, month, budget, cashIncome, loading } = useFinance()
  const reduced = useReducedMotion()
  const summary = getLorometro(monthTransactions, month, (budget?.available_cash ?? 0) + cashIncome, budget?.credit_limit ?? 0)
  const current = stages[summary.stage]
  const percentLabel = summary.percentage === null ? 'Sem base cadastrada' : `${summary.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  const fill = summary.percentage === null ? summary.committed > 0 ? 100 : 0 : Math.max(0, Math.min(100, summary.percentage))
  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR })
  return <section id="lorometro" className={`lorometro dashboard-surface lorometro-${summary.stage}`} aria-labelledby="lorometro-title" aria-busy={loading}>
    <div className="module-heading"><div><span className="eyebrow">O HUMOR DO SEU DINHEIRO</span><h2 id="lorometro-title">Lorômetro</h2><p className="capitalize">{monthLabel}</p></div><span className="lorometro-pill">Dinheiro + crédito</span></div>
    <div className="lorometro-body">
      <div className="lorometro-information">
        <p className="lorometro-state" role="status">{loading ? 'Consultando o humor do Lôro…' : current.label}</p>
        <p className="lorometro-percentage">{loading ? '—' : percentLabel}<span>{summary.percentage !== null && !loading ? 'do orçamento comprometido' : ''}</span></p>
        <p className="lorometro-message">{loading ? 'Atualizando seus dados.' : summary.percentage === null && summary.committed > 0 ? 'Há gastos cadastrados, mas falta uma base de orçamento para calcular o percentual.' : current.message}</p>
      </div>
      <motion.img className="lorometro-mascot" key={current.image} src={current.image} alt="" width="180" height="180" initial={reduced ? false : { opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 140, damping: 23 }} />
    </div>
    <div className="lorometro-scale" role="meter" aria-label={`Comprometimento do orçamento de ${monthLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill} aria-valuetext={loading ? 'Carregando' : `${percentLabel}. ${current.label}`}>
      <div className="lorometro-track"><span /><span /><span /></div>
      <motion.div className="lorometro-marker" initial={false} animate={{ left: `${fill}%` }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 24 }}><i /></motion.div>
    </div>
    <ol className="lorometro-legend"><li><i />Saudável até demais<small>Até 50%</small></li><li><i />Olhar o sinal<small>Acima de 50% até 80%</small></li><li><i />Freie com força<small>Acima de 80%</small></li></ol>
    <dl className="lorometro-values"><div><dt>Comprometido no mês</dt><dd>{loading ? '—' : <AnimatedCurrency value={summary.committed} />}</dd></div><div><dt>Dinheiro + limite total</dt><dd>{loading ? '—' : formatCurrencyBRL(summary.capacity)}</dd></div><div><dt>{summary.remaining < 0 ? 'Acima do orçamento' : 'Ainda não comprometido'}</dt><dd>{loading ? '—' : <AnimatedCurrency value={summary.remaining} />}</dd></div></dl>
    <p className="lorometro-note">Soma as despesas pagas, pendentes e previstas do mês, sem duplicar parcelas. A base é o orçamento em dinheiro + entradas recebidas + limite total de crédito. Crédito é limite para compras, não renda. As faixas são indicadores visuais do app.</p>
  </section>
}
