import { motion, useReducedMotion } from 'framer-motion'

export function ActivityRings({ cash, credit }: { cash: number; credit: number }) {
  const reduced = useReducedMotion()
  return <svg aria-hidden="true" width="62" height="62" viewBox="0 0 64 64" className="activity-rings">
    {[cash, credit].map((value, index) => {
      const radius = 26 - index * 9
      const circumference = 2 * Math.PI * radius
      const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100)
      return <g key={index} transform="rotate(-90 32 32)"><circle cx="32" cy="32" r={radius} fill="none" stroke="var(--soft)" strokeWidth="6" /><motion.circle cx="32" cy="32" r={radius} fill="none" stroke={value > 100 ? 'var(--expense)' : index ? 'var(--chart-2)' : 'var(--accent)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} initial={reduced ? false : { strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: reduced ? 0 : .8 }} /></g>
    })}
  </svg>
}
