import { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { formatCurrencyBRL } from '../../utils/formatters'

export function AnimatedCurrency({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    if (reduced) return
    const controls = animate(0, value, { duration: .65, onUpdate: setDisplay })
    return () => controls.stop()
  }, [value, reduced])
  const parts = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).formatToParts(reduced ? value : display)
  return <span aria-label={formatCurrencyBRL(value)} data-negative={value < 0} className="currency"><span aria-hidden="true">{parts.map((part, index) => <span key={index} className={['integer', 'group', 'minusSign'].includes(part.type) ? 'currency-major' : 'currency-minor'}>{part.value}</span>)}</span></span>
}
