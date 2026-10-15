import React, { useEffect, useRef, useState } from 'react'

interface Props {
  onConfirm: () => void
  title: string
  /** What the button shows before it is armed. */
  children: React.ReactNode
  /** What it shows once armed and waiting for the second click. */
  confirmLabel?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Two-step destructive button: the first click arms it, a second click within
 * three seconds acts.  Stops click propagation so it can sit inside clickable rows.
 */
export default function ConfirmButton({
  onConfirm, title, children, confirmLabel = 'Delete?', style, className,
}: Props): JSX.Element {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (armed) {
      if (timer.current) clearTimeout(timer.current)
      setArmed(false)
      onConfirm()
      return
    }
    setArmed(true)
    timer.current = setTimeout(() => setArmed(false), 3000)
  }

  return (
    <button
      type="button"
      title={armed ? 'Click again to confirm' : title}
      aria-label={armed ? `Confirm: ${title}` : title}
      onClick={handleClick}
      onBlur={() => setArmed(false)}
      className={className}
      style={{
        background: armed ? 'var(--red)' : 'transparent',
        color: armed ? '#fff' : 'var(--sub)',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: armed ? 10 : 12,
        fontWeight: armed ? 700 : 400,
        padding: armed ? '2px 6px' : '2px 4px',
        flexShrink: 0,
        lineHeight: 1.2,
        ...style,
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
