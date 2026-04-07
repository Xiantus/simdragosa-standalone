import React from 'react'

export default function TitleBar(): JSX.Element {
  return (
    <div
      style={{
        height: 36,
        minHeight: 36,
        background: 'var(--surf)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Drag region — covers full bar except buttons */}
      <div
        data-drag-region
        style={{
          position: 'absolute',
          inset: 0,
          right: 108, /* 3 buttons × 36px */
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      />

      {/* App title */}
      <div
        style={{
          paddingLeft: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--accent)',
            letterSpacing: '0.03em',
          }}
        >
          Simdragosa
        </span>
      </div>

      {/* Window control buttons */}
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          zIndex: 1,
        }}
      >
        <WindowButton
          title="Minimize"
          onClick={() => window.api.minimizeWindow()}
          color="var(--sub)"
          hoverBg="var(--surf2)"
        >
          ─
        </WindowButton>
        <WindowButton
          title="Maximize"
          onClick={() => window.api.maximizeWindow()}
          color="var(--sub)"
          hoverBg="var(--surf2)"
        >
          □
        </WindowButton>
        <WindowButton
          title="Close"
          onClick={() => window.api.closeWindow()}
          color="var(--sub)"
          hoverBg="var(--red)"
          hoverColor="#fff"
        >
          ✕
        </WindowButton>
      </div>
    </div>
  )
}

function WindowButton({
  title,
  onClick,
  children,
  color,
  hoverBg,
  hoverColor,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  color: string
  hoverBg: string
  hoverColor?: string
}): JSX.Element {
  const [hovered, setHovered] = React.useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 36,
        height: 36,
        border: 'none',
        background: hovered ? hoverBg : 'transparent',
        color: hovered && hoverColor ? hoverColor : color,
        cursor: 'default',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitAppRegion: 'no-drag',
        transition: 'background 0.1s',
      } as React.CSSProperties}
    >
      {children}
    </button>
  )
}
