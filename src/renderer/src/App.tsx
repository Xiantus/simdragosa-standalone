import React, { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import OnboardingFlow from './components/OnboardingFlow'
import SettingsPanel from './components/SettingsPanel'
import { useSettingsStore } from './stores/useSettingsStore'
import './styles/theme.css'

export default function App(): JSX.Element {
  const { is_configured, raidsid, wow_path, fetchSettings, saveSettings } = useSettingsStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TitleBar onSettingsClick={() => setSettingsOpen(true)} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <MainPanel />
      </div>

      <OnboardingFlow
        isConfigured={is_configured}
        onComplete={() => saveSettings({ raidsid, wow_path })}
      />

      <SettingsPanel
        open={settingsOpen}
        raidsid={raidsid}
        wow_path={wow_path}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
