import React, { useEffect, useState } from 'react'

interface Props {
  open: boolean
  raidsid?: string
  wow_path?: string
  version?: string
  minimizeToTray?: boolean
  onClose: () => void
}

type UpdateState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'up-to-date'; version: string }
  | { state: 'available'; version: string }
  | { state: 'error'; message: string }

export default function SettingsPanel({ open, raidsid: initialRaidsid = '', wow_path: initialWowPath = '', version = '', minimizeToTray: initialMinimizeToTray = false, onClose }: Props): JSX.Element | null {
  const [raidsid, setRaidsid] = useState(initialRaidsid)
  const [wowPath, setWowPath] = useState(initialWowPath)
  const [minimizeToTray, setMinimizeToTray] = useState(initialMinimizeToTray)
  const [saving, setSaving] = useState(false)
  const [updateState, setUpdateState] = useState<UpdateState>({ state: 'idle' })

  useEffect(() => {
    setRaidsid(initialRaidsid)
    setWowPath(initialWowPath)
    setMinimizeToTray(initialMinimizeToTray)
    setUpdateState({ state: 'idle' })
  }, [initialRaidsid, initialWowPath, initialMinimizeToTray, open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await window.api.saveSettings({ raidsid, wow_path: wowPath, minimizeToTray })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleCheckUpdates = async () => {
    setUpdateState({ state: 'checking' })
    const result = await window.api.checkForUpdates()
    if (result.status === 'up-to-date') {
      setUpdateState({ state: 'up-to-date', version: result.currentVersion })
    } else if (result.status === 'available') {
      // download dialog shown by main process; just reflect in UI
      setUpdateState({ state: 'available', version: result.version })
    } else {
      setUpdateState({ state: 'error', message: result.message })
    }
  }

  const updateLabel = (() => {
    switch (updateState.state) {
      case 'idle':      return 'Check for Updates'
      case 'checking':  return 'Checking\u2026'
      case 'up-to-date': return `\u2713 Up to date (v${updateState.version})`
      case 'available': return `\u2605 v${updateState.version} available — downloading\u2026`
      case 'error':     return `\u26a0 ${updateState.message}`
    }
  })()

  const updateColor = (() => {
    switch (updateState.state) {
      case 'up-to-date': return 'var(--green)'
      case 'available':  return 'var(--accent)'
      case 'error':      return 'var(--red)'
      default:           return 'var(--text)'
    }
  })()

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        data-testid="settings-panel"
        onSubmit={handleSubmit}
        style={{
          background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 28, width: 460, display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700 }}>Settings</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label htmlFor="settings-raidsid" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>
            Raidbots Session ID
          </label>
          <input
            id="settings-raidsid"
            type="text"
            value={raidsid}
            onChange={(e) => setRaidsid(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label htmlFor="settings-wowpath" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>
            WoW Retail Folder
          </label>
          <input
            id="settings-wowpath"
            type="text"
            value={wowPath}
            onChange={(e) => setWowPath(e.target.value)}
            placeholder="e.g. C:\Games\World of Warcraft\_retail_"
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: 'var(--sub)' }}>
            Writes to Interface\AddOns\Simdragosa\data\SimdragosaData.lua
          </span>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={minimizeToTray}
            onChange={(e) => setMinimizeToTray(e.target.checked)}
            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>Minimize to tray on close</span>
        </label>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* Updates section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 12, color: updateColor, flex: 1 }}>
            {updateState.state !== 'idle' && updateLabel}
          </span>
          <button
            type="button"
            onClick={handleCheckUpdates}
            disabled={updateState.state === 'checking'}
            style={{
              ...secondaryBtn,
              opacity: updateState.state === 'checking' ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            {updateState.state === 'checking' ? 'Checking\u2026' : 'Check for Updates'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {version && (
            <span style={{ fontSize: 11, color: 'var(--sub)' }}>v{version}</span>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 5,
  color: 'var(--text)', padding: '7px 10px', fontSize: 13, outline: 'none',
  userSelect: 'text', WebkitUserSelect: 'text',
}
const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none',
  borderRadius: 5, padding: '7px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  background: 'var(--surf2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 20px', fontSize: 13, cursor: 'pointer',
}
