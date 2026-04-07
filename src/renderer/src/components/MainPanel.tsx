import React from 'react'

export default function MainPanel(): JSX.Element {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* RunPanel */}
      <section
        data-testid="run-panel"
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surf)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--sub)', fontSize: 13 }}>
          Select characters and difficulties to simulate
        </span>
        <button
          disabled
          style={{
            marginLeft: 'auto',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 24px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
        >
          GO
        </button>
      </section>

      {/* ResultsPanel */}
      <section
        data-testid="results-panel"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
        }}
      >
        <div style={{ color: 'var(--sub)', fontSize: 13 }}>
          Results will appear here after sims complete.
        </div>
      </section>
    </main>
  )
}
