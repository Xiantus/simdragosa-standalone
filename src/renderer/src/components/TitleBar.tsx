import React, { useEffect, useState } from 'react'

interface Props {
  onSettingsClick?: () => void
}

export default function TitleBar({ onSettingsClick }: Props = {}): JSX.Element {
  const [overlayMode, setOverlayMode] = useState(false)

  useEffect(() => {
    window.api.getOverlayMode().then(setOverlayMode)
    const unsubscribe = window.api.onOverlayChanged((enabled) => setOverlayMode(enabled))
    return unsubscribe
  }, [])

  const handleOverlayToggle = () => {
    window.api.setOverlayMode(!overlayMode)
  }

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

      {/* Overlay mode toggle */}
      <button
        title={overlayMode ? 'Switch to Desktop mode' : 'Switch to In-Game overlay mode'}
        onClick={handleOverlayToggle}
        style={{
          marginLeft: 'auto',
          height: 36,
          padding: '0 10px',
          border: 'none',
          background: 'transparent',
          color: overlayMode ? 'var(--accent)' : 'var(--sub)',
          cursor: 'pointer',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          zIndex: 1,
          WebkitAppRegion: 'no-drag',
          whiteSpace: 'nowrap',
        } as React.CSSProperties}
      >
        {overlayMode ? '🖥 Desktop' : '🎮 In-Game'}
      </button>

      {/* Settings button */}
      {onSettingsClick && (
        <button
          title="Settings"
          onClick={onSettingsClick}
          style={{
            width: 36,
            height: 36,
            border: 'none',
            background: 'transparent',
            color: 'var(--sub)',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          ⚙
        </button>
      )}

      {/* Window control buttons */}
      <div
        style={{
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
