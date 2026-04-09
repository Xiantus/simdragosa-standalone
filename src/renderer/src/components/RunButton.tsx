import React from 'react'

interface Props {
  disabled: boolean
  running: boolean
  onClick: () => void
}

export default function RunButton({ disabled, running, onClick }: Props): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !running}
      style={{
        background: running ? 'var(--red)' : 'var(--accent)',
        color: '#fff', border: 'none', borderRadius: 6,
        padding: '8px 24px', fontSize: 14, fontWeight: 700,
        cursor: disabled && !running ? 'not-allowed' : 'pointer',
        opacity: disabled && !running ? 0.5 : 1,
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {running ? 'Cancel' : 'GO'}
    </button>
  )
}
