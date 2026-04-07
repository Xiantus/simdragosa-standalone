import React, { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import OnboardingFlow from './components/OnboardingFlow'
import SettingsPanel from './components/SettingsPanel'
import PlaywrightInstallModal from './components/PlaywrightInstallModal'
import { useSettingsStore } from './stores/useSettingsStore'
import './styles/theme.css'

export default function App(): JSX.Element {
  const { is_configured, raidsid, wow_path, fetchSettings } = useSettingsStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [playwrightOpen, setPlaywrightOpen] = useState(false)
  const [playwrightInstalled, setPlaywrightInstalled] = useState(true)
  const [overlayMode, setOverlayMode] = useState(false)

  useEffect(() => {
    fetchSettings()
    window.api.isPlaywrightInstalled().then((installed) => {
      setPlaywrightInstalled(installed)
    })
    window.api.getOverlayMode().then(setOverlayMode)
    const unsubscribe = window.api.onOverlayChanged((enabled) => setOverlayMode(enabled))
    return unsubscribe
  }, [])

  const handlePlaywrightClose = () => {
    setPlaywrightOpen(false)
    // Re-check if it's now installed
    window.api.isPlaywrightInstalled().then(setPlaywrightInstalled)
  }

  return (
    <div
      data-overlay={overlayMode ? 'true' : undefined}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      <TitleBar onSettingsClick={() => setSettingsOpen(true)} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <MainPanel
          playwrightInstalled={playwrightInstalled}
          onInstallPlaywright={() => setPlaywrightOpen(true)}
        />
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

      <PlaywrightInstallModal
        open={playwrightOpen}
        onClose={handlePlaywrightClose}
      />
    </div>
  )
}
