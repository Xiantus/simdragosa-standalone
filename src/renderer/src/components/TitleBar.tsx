import React, { useEffect, useState } from 'react'

interface Props {
  onSettingsClick?: () => void
}

// SVG icons as inline components — no emoji
function IconSettings(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconMonitor(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function IconGamepad(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none" />
      <path d="M6 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  )
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
      {/* Drag region */}
      <div
        data-drag-region
        style={{
          position: 'absolute',
          inset: 0,
          right: 144,
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      />

      {/* App title */}
      <div
        style={{
          paddingLeft: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {/* Dragon sigil */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8 2 5 5 5 8c0 2 1 3.5 2.5 4.5L5 20h4l1.5-4h3L15 20h4l-2.5-7.5C18 11.5 19 10 19 8c0-3-3-6-7-6zm0 2c2.8 0 5 2.2 5 4 0 1.5-.8 2.8-2 3.5l-.5.3.3.5L17 18h-2l-1.5-4h-3L9 18H7l2.2-5.7.3-.5-.5-.3C7.8 10.8 7 9.5 7 8c0-1.8 2.2-4 5-4z"/>
        </svg>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--accent)',
            letterSpacing: '0.06em',
          }}
        >
          SIMDRAGOSA
        </span>
      </div>

      {/* Overlay mode pill toggle */}
      <div
        title={overlayMode ? 'Switch to Desktop mode' : 'Switch to In-Game overlay mode'}
        onClick={handleOverlayToggle}
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--surf2)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: 2,
          cursor: 'pointer',
          zIndex: 1,
          WebkitAppRegion: 'no-drag',
          userSelect: 'none',
          position: 'relative',
          height: 22,
        } as React.CSSProperties}
      >
        {/* Sliding indicator */}
        <div style={{
          position: 'absolute',
          top: 2,
          left: overlayMode ? 'calc(50% + 2px)' : 2,
          width: 'calc(50% - 4px)',
          bottom: 2,
          background: 'var(--accent)',
          borderRadius: 16,
          transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 0,
        }} />
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '0 8px', fontSize: 11, fontWeight: 600,
          color: overlayMode ? 'var(--sub)' : '#fff',
          transition: 'color 0.2s',
          position: 'relative', zIndex: 1,
        }}>
          <IconMonitor /> Desktop
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '0 8px', fontSize: 11, fontWeight: 600,
          color: overlayMode ? '#fff' : 'var(--sub)',
          transition: 'color 0.2s',
          position: 'relative', zIndex: 1,
        }}>
          <IconGamepad /> In-Game
        </span>
      </div>

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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            WebkitAppRegion: 'no-drag',
            transition: 'color 0.1s',
          } as React.CSSProperties}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--sub)' }}
        >
          <IconSettings />
        </button>
      )}

      {/* Window control buttons */}
      <div style={{ display: 'flex', zIndex: 1 }}>
        <WindowButton title="Minimize" onClick={() => window.api.minimizeWindow()} color="var(--sub)" hoverBg="var(--surf2)">
          ─
        </WindowButton>
        <WindowButton title="Maximize" onClick={() => window.api.maximizeWindow()} color="var(--sub)" hoverBg="var(--surf2)">
          □
        </WindowButton>
        <WindowButton title="Close" onClick={() => window.api.closeWindow()} color="var(--sub)" hoverBg="var(--red)" hoverColor="#fff">
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
