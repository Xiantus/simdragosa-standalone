import React, { useState } from 'react'

interface Props {
  disabled: boolean
  running: boolean
  onClick: () => void
}

export default function RunButton({ disabled, running, onClick }: Props): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const isDisabled = disabled && !running

  const bg = running
    ? hovered
      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
      : 'linear-gradient(135deg, #f87171, #ef4444)'
    : hovered
      ? 'linear-gradient(135deg, #9a8cff, #7c6af7)'
      : 'linear-gradient(135deg, #7c6af7, #6c5ce7)'

  const glow = running
    ? '0 0 18px rgba(248, 113, 113, 0.45), 0 2px 8px rgba(0,0,0,0.4)'
    : '0 0 18px rgba(124, 106, 247, 0.45), 0 2px 8px rgba(0,0,0,0.4)'

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDisabled ? 'var(--surf2)' : bg,
        color: isDisabled ? 'var(--sub)' : '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '9px 28px',
        fontSize: 14,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.08em',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
        transform: !isDisabled && hovered ? 'scale(1.04)' : 'scale(1)',
        boxShadow: isDisabled ? 'none' : glow,
        whiteSpace: 'nowrap',
      }}
    >
      {running ? 'Cancel' : 'GO'}
    </button>
  )
}
