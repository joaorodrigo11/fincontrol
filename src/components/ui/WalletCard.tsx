import { useRef, type PropsWithChildren } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Eye, EyeOff, Wallet } from 'lucide-react'

export function WalletCard({ children, open, onToggle }: PropsWithChildren<{ open: boolean; onToggle: () => void }>) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  return <motion.div ref={ref} className={`wallet-card ${open ? 'wallet-open' : 'wallet-closed'}`} initial={reduced ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} onPointerMove={(event) => {
    if (reduced || event.pointerType !== 'mouse' || !ref.current) return
    const box = ref.current.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height
    ref.current.style.setProperty('--shine-x', `${x * 100}%`)
    ref.current.style.setProperty('--shine-y', `${y * 100}%`)
    ref.current.style.setProperty('--visual-tilt', `perspective(1200px) rotateX(${(0.5-y)*3}deg) rotateY(${(x-.5)*3}deg) scale(1.015)`)
  }} onPointerDown={(event) => { if (!reduced && event.pointerType === 'touch' && ref.current) ref.current.style.setProperty('--visual-tilt', 'scale(.99)') }} onPointerUp={() => { ref.current?.style.removeProperty('--visual-tilt') }} onPointerCancel={() => { ref.current?.style.removeProperty('--visual-tilt') }} onPointerLeave={() => { ref.current?.style.removeProperty('--visual-tilt') }}>
    <div className="wallet-card-visual" aria-hidden="true"><span className="wallet-slot-card" /><span className="wallet-slot-card wallet-slot-card-back" /><span className="wallet-clasp"><i /></span></div>
    {children}
    <motion.div className="wallet-privacy-flap" aria-hidden="true" initial={false}
      animate={{ rotateX: reduced ? 0 : open ? -100 : 0, opacity: open ? 0 : 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 130, damping: 22 }}>
      <Wallet size={36} strokeWidth={1.3} /><strong>LÔRO</strong><span>Sua carteira está fechada</span><small>Toque para abrir e exibir os valores</small>
    </motion.div>
    <button type="button" className="wallet-privacy-toggle" onClick={onToggle} aria-expanded={open} aria-controls="wallet-balances" aria-label={open ? 'Fechar carteira e ocultar valores' : 'Abrir carteira e mostrar valores'}>
      <span className="wallet-privacy-label">{open ? <EyeOff size={16} /> : <Eye size={16} />}{open ? 'Ocultar valores' : 'Mostrar valores'}</span>
    </button>
  </motion.div>
}
