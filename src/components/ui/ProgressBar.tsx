import type { LimitAlert } from '../../types/finance'
import { motion, useReducedMotion } from 'framer-motion'

interface ProgressBarProps {
  value: number
  alert: LimitAlert
  label: string
}

const colors: Record<LimitAlert, string> = {
  normal: 'bg-[var(--accent)]',
  warning: 'bg-[var(--warning)]',
  over: 'bg-[var(--expense)]',
}

export function ProgressBar({ value, alert, label }: ProgressBarProps) {
  const reduced = useReducedMotion()
  const safeValue = Math.max(0, Math.min(value, 100))
  return (
    <div
      className="progress-track h-2.5 overflow-hidden rounded-full bg-[var(--soft)]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
      aria-valuetext={`${Math.round(value)}% utilizado`}
    >
      <motion.div
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${safeValue}%` }}
        transition={{ duration: reduced ? 0 : .7 }}
        className={`h-full rounded-full transition-[width] duration-500 ${colors[alert]}`}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  )
}
