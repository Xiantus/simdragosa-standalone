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

  useEffect(() => {
    fetchSettings()
    loadHistoricalJobs()
    window.api.getOverlayMode().then(setOverlayMode)
    const unsubscribe = window.api.onOverlayChanged((enabled) => setOverlayMode(enabled))
    return unsubscribe
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
