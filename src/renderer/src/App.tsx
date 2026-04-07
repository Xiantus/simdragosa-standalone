import React from 'react'

export default function App(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#13131f',
        color: '#dde0f0',
      }}
    >
      {/* TitleBar placeholder */}
      <div
        style={{
          height: 36,
          background: '#1c1c2e',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          WebkitAppRegion: 'drag',
          flexShrink: 0,
        } as React.CSSProperties}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#7c6af7' }}>
          Simdragosa
        </span>
      </div>

      {/* Body placeholder */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7878a0',
          fontSize: 14,
        }}
      >
        v2 scaffold — React loaded via loadFile() ✓
      </div>
    </div>
  )
}
