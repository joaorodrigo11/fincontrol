import { useEffect, useRef } from 'react'

export function useDialogFocus(open: boolean, close: () => void, busy = false) {
  const ref = useRef<HTMLElement>(null)
  const closeRef = useRef(close)
  const busyRef = useRef(busy)
  useEffect(() => { closeRef.current = close; busyRef.current = busy }, [close, busy])
  useEffect(() => {
    if (!open) return
    const origin = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])
    controls().find(element => element.tagName === 'INPUT')?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0]
      const last = items.at(-1)
      if (!first) { event.preventDefault(); ref.current?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.body.style.overflow = previousOverflow
      origin?.focus()
    }
  }, [open])
  return ref
}
