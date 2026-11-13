import { useEffect, useLayoutEffect, useRef, type PropsWithChildren } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionStyle } from 'framer-motion'
import { Eye, EyeOff, Wallet } from 'lucide-react'

type WalletCardProps = PropsWithChildren<{ open: boolean; onToggle: () => void }>

export function WalletCard({ children, open, onToggle }: WalletCardProps) {
  const scene = useRef<HTMLDivElement>(null)
  const flap = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const pointerLift = useMotionValue(0)
  const smoothX = useSpring(pointerX, { stiffness: 95, damping: 22, mass: .8 })
  const smoothY = useSpring(pointerY, { stiffness: 95, damping: 22, mass: .8 })
  const smoothLift = useSpring(pointerLift, { stiffness: 120, damping: 24 })
  const fold = useMotionValue(open ? 1 : 0)
  const latch = useMotionValue(open ? 1 : 0)
  const parkedScale = useMotionValue(.4)

  // Keep the back of the folded cover inside the header, even on a tall mobile wallet.
  useLayoutEffect(() => {
    const element = flap.current
    if (!element) return
    const measure = () => parkedScale.set(Math.max(.12, Math.min(.64, 72 / Math.max(1, element.offsetHeight))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [parkedScale])

  useEffect(() => {
    const destination = open ? 1 : 0
    if (reduced) {
      fold.set(destination)
      latch.set(destination)
      pointerX.set(0)
      pointerY.set(0)
      pointerLift.set(0)
      return
    }
    const distance = Math.abs(destination - fold.get())
    const duration = (open ? .95 : .72) * Math.max(.25, distance)
    const cover = animate(fold, destination, {
      duration,
      delay: open && distance > .02 ? .14 : 0,
      ease: open ? [.22, .8, .22, 1] : [.4, 0, .2, 1],
    })
    const clasp = animate(latch, destination, {
      duration: open ? .3 : .24,
      delay: open ? 0 : duration * .76,
      ease: [.22, 1, .36, 1],
    })
    return () => { cover.stop(); clasp.stop() }
  }, [open, reduced, fold, latch, pointerX, pointerY, pointerLift])

  const rotateX = useTransform(() => reduced ? 0 : -smoothY.get() * 5 + fold.get() * 2.5)
  const rotateY = useTransform(() => reduced ? 0 : smoothX.get() * 6)
  const depth = useTransform(() => reduced ? 0 : fold.get() * 5 + smoothLift.get() * 7)
  const shineX = useTransform(smoothX, [-.5, .5], ['18%', '82%'])
  const shineY = useTransform(smoothY, [-.5, .5], ['12%', '88%'])
  const flapAngle = useTransform(fold, [0, 1], [0, 145])
  const flapScale = useTransform(() => {
    const bend = Math.max(0, (fold.get() - .32) / .68)
    return 1 - (1 - parkedScale.get()) * bend
  })
  const backLabelScale = useTransform(() => 1 / flapScale.get())
  const flapDepth = useTransform(fold, [0, 1], [30, 12])
  const flapY = useTransform(fold, [0, 1], [0, -4])
  const shadowOpacity = useTransform(fold, [0, .25, .65, 1], [.12, .6, .24, 0])
  const shadowScale = useTransform(fold, [0, 1], [1, .15])
  const claspAngle = useTransform(latch, [0, 1], [0, -155])
  const claspDepth = useTransform(latch, [0, .5, 1], [40, 68, 40])
  const cardY = useTransform(fold, [0, 1], [9, -6])
  const cardRotation = useTransform(fold, [0, 1], [-2, -9])
  const backCardY = useTransform(fold, [0, 1], [12, -2])
  const backCardRotation = useTransform(fold, [0, 1], [2, 10])
  const cardOpacity = useTransform(fold, [0, 1], [.16, .6])
  const sheenOpacity = useTransform(fold, [0, .3, .7, 1], [.08, .6, .32, .12])

  function releasePointer() {
    pointerX.set(0)
    pointerY.set(0)
    pointerLift.set(0)
  }

  return (
    <div
      ref={scene}
      className={`wallet-card ${open ? 'wallet-open' : 'wallet-closed'}`}
      onPointerMove={event => {
        if (reduced || event.pointerType !== 'mouse' || !scene.current) return
        const bounds = scene.current.getBoundingClientRect()
        pointerX.set(Math.max(-.5, Math.min(.5, (event.clientX - bounds.left) / bounds.width - .5)))
        pointerY.set(Math.max(-.5, Math.min(.5, (event.clientY - bounds.top) / bounds.height - .5)))
        pointerLift.set(1)
      }}
      onPointerDown={event => {
        if (!reduced && event.pointerType === 'touch') pointerLift.set(-.35)
      }}
      onPointerUp={event => { if (event.pointerType === 'touch') releasePointer() }}
      onPointerCancel={releasePointer}
      onPointerLeave={releasePointer}
    >
      <motion.div className="wallet-object" style={{ rotateX, rotateY, z: depth, '--shine-x': shineX, '--shine-y': shineY } as MotionStyle}>
        <div className="wallet-object-edge" aria-hidden="true" />
        <div className="wallet-card-visual" aria-hidden="true">
          <div className="wallet-material-grain" />
          <motion.span className="wallet-slot-card" style={{ y: cardY, rotate: cardRotation, opacity: cardOpacity }} />
          <motion.span className="wallet-slot-card wallet-slot-card-back" style={{ y: backCardY, rotate: backCardRotation }} />
        </div>
        <div className="wallet-interior">{children}</div>
        <motion.div className="wallet-fold-shadow" aria-hidden="true" style={{ opacity: shadowOpacity, scaleY: shadowScale, z: 10 }} />
        <motion.div
          ref={flap}
          className="wallet-privacy-flap"
          aria-hidden="true"
          style={{ rotateX: flapAngle, scaleY: flapScale, y: flapY, z: flapDepth, '--wallet-back-label-scale': backLabelScale } as MotionStyle}
        >
          <div className="wallet-flap-face wallet-flap-front">
            <span className="wallet-material-grain" />
            <span className="wallet-flap-stitch" />
            <Wallet size={32} strokeWidth={1.15} />
            <strong>LÔRO</strong>
            <span>Sua carteira está fechada</span>
            <small>Toque para abrir e exibir os valores</small>
          </div>
          <div className="wallet-flap-face wallet-flap-back">
            <span className="wallet-material-grain" />
            <span className="wallet-flap-stitch" />
            <span className="wallet-flap-back-brand">LÔRO</span>
          </div>
          <span className="wallet-flap-edge" />
          <motion.span className="wallet-flap-sheen" style={{ opacity: sheenOpacity }} />
        </motion.div>
        <motion.div className="wallet-clasp" aria-hidden="true" style={{ rotateY: claspAngle, z: claspDepth }}>
          <span className="wallet-clasp-face"><i /></span>
        </motion.div>
        <div className="wallet-specular" aria-hidden="true" />
      </motion.div>
      <button
        type="button"
        className="wallet-privacy-toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="wallet-balances"
        aria-label={open ? 'Fechar carteira e ocultar valores' : 'Abrir carteira e mostrar valores'}
      >
        <span className="wallet-privacy-label">{open ? <EyeOff size={16} /> : <Eye size={16} />}{open ? 'Ocultar valores' : 'Mostrar valores'}</span>
      </button>
    </div>
  )
}
