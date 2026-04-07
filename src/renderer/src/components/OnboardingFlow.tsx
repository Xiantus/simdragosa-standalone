import React, { useState } from 'react'

interface Props {
  isConfigured: boolean
  onComplete: () => void
}

export default function OnboardingFlow({ isConfigured, onComplete }: Props): JSX.Element | null {
  const [raidsid, setRaidsid] = useState('')
  const [wowPath, setWowPath] = useState('')
  const [saving, setSaving] = useState(false)

  if (isConfigured) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await window.api.saveSettings({ raidsid, wow_path: wowPath })
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}
    >
      <form
        data-testid="onboarding"
        onSubmit={handleSubmit}
        style={{
          background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 32, width: 480, display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <div>
          <h2 style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Welcome to Simdragosa
          </h2>
          <p style={{ color: 'var(--sub)', fontSize: 13, lineHeight: 1.5 }}>
            To get started, enter your Raidbots session ID. You can find it in your browser's
            cookies after logging into raidbots.com (cookie name: <code>raidsid</code>).
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="onboarding-raidsid" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>
            Raidbots Session ID
          </label>
          <input
            id="onboarding-raidsid"
            type="text"
            value={raidsid}
            onChange={(e) => setRaidsid(e.target.value)}
            required
            placeholder="paste your raidsid cookie value here"
            style={{
              background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="onboarding-wowpath" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>
            WoW SavedVariables Path <span style={{ color: 'var(--sub)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="onboarding-wowpath"
            type="text"
            value={wowPath}
            onChange={(e) => setWowPath(e.target.value)}
            placeholder="e.g. C:\Program Files (x86)\World of Warcraft\_retail_\WTF\Account\...\SavedVariables"
            style={{
              background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={saving || !raidsid.trim()}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '10px 0', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer', opacity: saving || !raidsid.trim() ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving\u2026' : 'Save & Continue'}
        </button>
      </form>
    </div>
  )
}
