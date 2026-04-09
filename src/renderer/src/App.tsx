import React, { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import OnboardingFlow from './components/OnboardingFlow'
import SettingsPanel from './components/SettingsPanel'
import { useSettingsStore } from './stores/useSettingsStore'
import { useJobStore } from './stores/useJobStore'
import './styles/theme.css'

export default function App(): JSX.Element {
  const { is_configured, raidsid, wow_path, fetchSettings } = useSettingsStore()
  const loadHistoricalJobs = useJobStore((s) => s.loadHistoricalJobs)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [overlayMode, setOverlayMode] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    fetchSettings()
    loadHistoricalJobs()
    window.api.getOverlayMode().then(setOverlayMode)
    const unsubOverlay = window.api.onOverlayChanged((enabled) => setOverlayMode(enabled))
    const unsubUpdate = window.api.onUpdateReady(() => setUpdateReady(true))
    return () => { unsubOverlay(); unsubUpdate() }
  }, [])

  return (
    <div
      data-overlay={overlayMode ? 'true' : undefined}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      <TitleBar onSettingsClick={() => setSettingsOpen(true)} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <MainPanel />
      </div>

      {updateReady && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
          background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: '8px 16px', fontSize: 13,
        }}>
          <span>An update is ready — relaunch to apply.</span>
          <button
            onClick={() => window.api.restartAndUpdate()}
            style={{
              background: '#fff', color: 'var(--accent)', border: 'none',
              borderRadius: 4, padding: '3px 10px', fontWeight: 700,
              cursor: 'pointer', fontSize: 12,
            }}
          >
            Restart now
          </button>
          <button
            onClick={() => setUpdateReady(false)}
            style={{
              background: 'none', border: 'none', color: '#fff',
              cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px',
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <OnboardingFlow
        isConfigured={is_configured}
        onComplete={fetchSettings}
      />

      <SettingsPanel
        open={settingsOpen}
        raidsid={raidsid}
        wow_path={wow_path}
        onClose={() => { setSettingsOpen(false); fetchSettings() }}
      />
    </div>
  )
}
