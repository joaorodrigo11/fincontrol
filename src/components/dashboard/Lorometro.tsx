import { motion, useReducedMotion } from 'framer-motion'
import { useFinance } from '../../contexts/useFinance'
import { getPersonalMonthSummary } from '../../utils/personalMonthSummary'

const stages = {
  healthy: { label: 'Saudável até demais', message: 'Até metade da receita do mês está comprometida.', image: '/art/lorometro-relaxed.png' },
  warning: { label: 'Olhar o sinal', message: 'Mais da metade da receita do mês já tem destino.', image: '/art/lorometro-thinking.png' },
  danger: { label: 'Freie com força', message: 'Mais de 80% da receita do mês está comprometida.', image: '/art/lorometro-panic.png' },
  unconfigured: { label: 'Aguardando os dados do mês', message: 'Ainda falta a receita deste mês para calcular quanto você pode gastar. As parcelas e os outros gastos continuam registrados.', image: '/art/lorometro-standby.png' },
}

export function Lorometro({ visible = true, onAddIncome }: { visible?: boolean; onAddIncome: () => void }) {
  const { monthTransactions, month, loading, error } = useFinance()
  const reduced = useReducedMotion()
  const summary = getPersonalMonthSummary(monthTransactions, month)
  const current = stages[loading || error ? 'unconfigured' : summary.stage]
  const hasPercentage = !loading && !error && visible && summary.percentage !== null
  const fill = summary.percentage === null ? 0 : Math.max(0, Math.min(100, summary.percentage))
  const percentLabel = summary.percentage === null ? '—' : `${summary.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  let stateLabel = current.label
  let message = current.message
  if (loading) {
    stateLabel = 'Atualizando o Lorômetro…'
    message = 'Consultando as receitas e os gastos do mês.'
  } else if (error) {
    stateLabel = 'Não foi possível calcular'
    message = 'Atualize os dados do mês para consultar o Lorômetro.'
  } else if (summary.available !== null && summary.available < 0) {
    message = 'Os gastos e as previsões ultrapassam a receita recebida neste mês.'
  }

  return (
    <div
      id="lorometro"
      className={`lorometro personal-lorometro lorometro-${loading || error ? 'unconfigured' : summary.stage}${!loading && !error && summary.awaitingIncome ? ' is-standby' : ''}`}
      role="group"
      aria-labelledby="lorometro-title"
      aria-busy={loading}
    >
      <div className="personal-lorometro-heading">
        <h3 id="lorometro-title">Lorômetro</h3>
        <span className="lorometro-pill">Receitas do mês</span>
      </div>
      <div className="lorometro-body">
        <div className="lorometro-information">
          <p className="lorometro-state" role="status">{stateLabel}</p>
          <p className="lorometro-message">{message}</p>
        </div>
        <div className="personal-lorometro-result">
          <p className="lorometro-percentage" aria-label={!visible && !loading && !error ? 'Percentual oculto' : undefined}>
            {loading || error ? '—' : visible ? percentLabel : '••••'}
            <span>{hasPercentage ? 'da receita comprometida' : ''}</span>
          </p>
          <motion.img
            key={current.image}
            className="lorometro-mascot"
            src={current.image}
            alt=""
            width="128"
            height="110"
            decoding="async"
            initial={reduced ? false : { opacity: 0, scale: .96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: .25 }}
          />
        </div>
      </div>
      <div
        className="lorometro-scale"
        role={hasPercentage ? 'meter' : undefined}
        aria-hidden={!hasPercentage}
        aria-label={hasPercentage ? 'Comprometimento da receita do mês' : undefined}
        aria-valuemin={hasPercentage ? 0 : undefined}
        aria-valuemax={hasPercentage ? 100 : undefined}
        aria-valuenow={hasPercentage ? fill : undefined}
        aria-valuetext={hasPercentage ? `${percentLabel}. ${stateLabel}` : undefined}
      >
        <div className="lorometro-track"><span /><span /><span /></div>
        {hasPercentage && (
          <motion.div
            className="lorometro-marker"
            initial={false}
            animate={{ left: `${fill}%` }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 24 }}
          ><i /></motion.div>
        )}
      </div>
      {!summary.awaitingIncome && <ol className="lorometro-legend">
        <li><i />Saudável até demais<small>Até 50%</small></li>
        <li><i />Olhar o sinal<small>Acima de 50% até 80%</small></li>
        <li><i />Freie com força<small>Acima de 80%</small></li>
      </ol>}
      {!loading && !error && summary.awaitingIncome && (
        <button type="button" className="module-link" onClick={onAddIncome}>Adicionar uma receita</button>
      )}
      <p className="lorometro-note">Compara as despesas e previsões deste mês com as receitas recebidas. Cada parcela entra somente no seu mês.</p>
    </div>
  )
}
