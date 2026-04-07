import React, { useEffect, useState } from 'react'

interface Props {
  open: boolean
  raidsid?: string
  wow_path?: string
  onClose: () => void
}

export default function SettingsPanel({ open, raidsid: initialRaidsid = '', wow_path: initialWowPath = '', onClose }: Props): JSX.Element | null {
  const [raidsid, setRaidsid] = useState(initialRaidsid)
  const [wowPath, setWowPath] = useState(initialWowPath)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRaidsid(initialRaidsid)
    setWowPath(initialWowPath)
  }, [initialRaidsid, initialWowPath, open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await window.api.saveSettings({ raidsid, wow_path: wowPath })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
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
            WoW SavedVariables Path
          </label>
          <input
            id="settings-wowpath"
            type="text"
            value={wowPath}
            onChange={(e) => setWowPath(e.target.value)}
            placeholder="optional"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 5,
  color: 'var(--text)', padding: '7px 10px', fontSize: 13, outline: 'none',
}
const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none',
  borderRadius: 5, padding: '7px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  background: 'var(--surf2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 20px', fontSize: 13, cursor: 'pointer',
}
