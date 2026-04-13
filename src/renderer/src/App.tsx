import React, { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import OnboardingFlow from './components/OnboardingFlow'
import SettingsPanel from './components/SettingsPanel'
import { useSettingsStore } from './stores/useSettingsStore'
import { useJobStore } from './stores/useJobStore'
import { specIdFromName } from './lib/specIcons'
import type { SimcExportDetected } from '../../../shared/ipc'
import './styles/theme.css'

export default function App(): JSX.Element {
  const { is_configured, raidsid, wow_path, fetchSettings } = useSettingsStore()
  const loadHistoricalJobs = useJobStore((s) => s.loadHistoricalJobs)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [overlayMode, setOverlayMode] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [simcExports, setSimcExports] = useState<SimcExportDetected[]>([])

  useEffect(() => {
    fetchSettings()
    loadHistoricalJobs()
    window.api.getOverlayMode().then(setOverlayMode)
    const unsubOverlay = window.api.onOverlayChanged((enabled) => setOverlayMode(enabled))
    const unsubUpdate = window.api.onUpdateReady(() => setUpdateReady(true))
    const unsubSimc = window.api.onSimcExport((entry) => {
      setSimcExports((prev) => {
        // Deduplicate by charKey — keep only the newest
        const filtered = prev.filter((e) => e.charKey !== entry.charKey)
        return [...filtered, entry]
      })
    })
    return () => { unsubOverlay(); unsubUpdate(); unsubSimc() }
  }, [])

  /** Create (or update) a character from a SimC export entry. */
  async function upsertCharFromSimc(entry: SimcExportDetected): Promise<string> {
    const [namePart, ...realmParts] = entry.charKey.split('-')
    const realm = realmParts.join('-')
    // Extract region from simc string if present
    const regionMatch = entry.simc.match(/^region=(\w+)/m)
    const region = regionMatch?.[1] ?? 'eu'
    const specId = specIdFromName(entry.spec)
    const charId = `${namePart.toLowerCase()}-${entry.spec.toLowerCase()}`

    await window.api.upsertCharacter({
      id: charId,
      name: namePart,
      realm,
      region,
      spec: entry.spec,
      spec_id: specId,
      loot_spec_id: specId,
      simc_string: entry.simc,
      crafted_stats: '',
    })
    return charId
  }

  function dismissExport(entry: SimcExportDetected) {
    window.api.dismissSimcExport(entry.charKey, entry.timestamp)
    setSimcExports((prev) => prev.filter((e) => e.charKey !== entry.charKey))
  }

  async function handleSimcRun(entry: SimcExportDetected) {
    dismissExport(entry)
    const charId = await upsertCharFromSimc(entry)
    // Use the default difficulties from the current selection — fall back to heroic
    await window.api.startSim({ character_ids: [charId], difficulties: ['raid-heroic'] })
  }

  async function handleSimcAdd(entry: SimcExportDetected) {
    dismissExport(entry)
    await upsertCharFromSimc(entry)
  }

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

      {/* SimC export notification banners — stack upward above the update banner */}
      {simcExports.map((entry, idx) => {
        const specLabel = entry.spec.charAt(0).toUpperCase() + entry.spec.slice(1)
        const [charName] = entry.charKey.split('-')
        const updateOffset = updateReady ? 36 : 0
        const bottomOffset = updateOffset + idx * 36
        return (
          <div key={entry.charKey} style={{
            position: 'fixed', bottom: bottomOffset, left: 0, right: 0,
            zIndex: 999, background: 'var(--surf2)',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 14px', fontSize: 12,
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
              SimC Export
            </span>
            <span style={{ color: 'var(--text)', flex: 1 }}>
              {charName} <span style={{ color: 'var(--sub)' }}>({specLabel})</span>
              {' '}detected from WoW. Start a sim?
            </span>
            <button
              onClick={() => handleSimcRun(entry)}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 4, padding: '3px 10px', fontWeight: 700,
                cursor: 'pointer', fontSize: 11, flexShrink: 0,
              }}
            >
              Run
            </button>
            <button
              onClick={() => handleSimcAdd(entry)}
              style={{
                background: 'var(--surf)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 4,
                padding: '3px 10px', cursor: 'pointer', fontSize: 11, flexShrink: 0,
              }}
            >
              Add only
            </button>
            <button
              onClick={() => dismissExport(entry)}
              style={{
                background: 'none', border: 'none', color: 'var(--sub)',
                cursor: 'pointer', fontSize: 16, lineHeight: 1,
                padding: '0 4px', flexShrink: 0,
              }}
              title="Ignore"
            >
              ×
            </button>
          </div>
        )
      })}

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
