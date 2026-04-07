import React from 'react'

export default function Sidebar(): JSX.Element {
  return (
    <aside
      style={{
        width: 280,
        minWidth: 220,
        maxWidth: 320,
        background: 'var(--surf)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Sidebar header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Characters
        </span>
        <button
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '3px 10px',
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + Add
        </button>
      </div>

      {/* Character list */}
      <div
        data-testid="character-list"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 8,
        }}
      >
        <div style={{ color: 'var(--sub)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
          No characters yet
        </div>
      </div>
    </aside>
  )
}
