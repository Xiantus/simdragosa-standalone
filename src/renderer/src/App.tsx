import React, { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import OnboardingFlow from './components/OnboardingFlow'
import SettingsPanel from './components/SettingsPanel'
import { useSettingsStore } from './stores/useSettingsStore'
import { useJobStore } from './stores/useJobStore'
import { useCharacterStore } from './stores/useCharacterStore'
import { specIdFromName } from './lib/specIcons'
import type { Character, SimcExportDetected } from '../../../shared/ipc'
import './styles/theme.css'

/** Find the best existing character match for a SimC export entry. */
function findMatchingChar(entry: SimcExportDetected, characters: Character[]): Character | null {
  const [namePart, ...realmParts] = entry.charKey.split('-')
  const name = namePart.toLowerCase()
  const realm = realmParts.join('-').toLowerCase()
  const matches = characters.filter(
    (c) => c.name.toLowerCase() === name && c.realm.toLowerCase() === realm
  )
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]
  // Multiple chars with same name+realm (different specs) — prefer spec match
  return matches.find((c) => c.spec.toLowerCase() === entry.spec.toLowerCase()) ?? matches[0]
}

export default function App(): JSX.Element {
  const { is_configured, raidsid, wow_path, version, minimizeToTray, fetchSettings } = useSettingsStore()
  const loadHistoricalJobs = useJobStore((s) => s.loadHistoricalJobs)
  const characters = useCharacterStore((s) => s.characters)
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

  /** Update an existing character's simc string, or create a new one from the export. */
  async function upsertCharFromSimc(entry: SimcExportDetected, existing: Character | null): Promise<string> {
    const specId = specIdFromName(entry.spec)
    if (existing) {
      await window.api.upsertCharacter({
        ...existing,
        simc_string: entry.simc,
        spec: entry.spec,
        spec_id: specId,
        loot_spec_id: specId,
      })
      return existing.id
    }
    const [namePart, ...realmParts] = entry.charKey.split('-')
    const realm = realmParts.join('-')
    const regionMatch = entry.simc.match(/^region=(\w+)/m)
    const region = regionMatch?.[1] ?? 'eu'
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

  async function handleSimcRun(entry: SimcExportDetected, existing: Character | null) {
    dismissExport(entry)
    const charId = await upsertCharFromSimc(entry, existing)
    await window.api.startSim({ character_ids: [charId], difficulties: ['raid-heroic'] })
  }

  async function handleSimcAdd(entry: SimcExportDetected, existing: Character | null) {
    dismissExport(entry)
    await upsertCharFromSimc(entry, existing)
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
        const matched = findMatchingChar(entry, characters)
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
            {matched ? (
              <span style={{ color: 'var(--text)', flex: 1 }}>
                {charName} <span style={{ color: 'var(--sub)' }}>({specLabel})</span>
                {' '}— simc updated. Run a sim?
              </span>
            ) : (
              <span style={{ color: 'var(--text)', flex: 1 }}>
                {charName} <span style={{ color: 'var(--sub)' }}>({specLabel})</span>
                {' '}— not in your list yet. Add?
              </span>
            )}
            <button
              onClick={() => handleSimcRun(entry, matched)}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 4, padding: '3px 10px', fontWeight: 700,
                cursor: 'pointer', fontSize: 11, flexShrink: 0,
              }}
            >
              {matched ? 'Run' : 'Add & Run'}
            </button>
            <button
              onClick={() => handleSimcAdd(entry, matched)}
              style={{
                background: 'var(--surf)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 4,
                padding: '3px 10px', cursor: 'pointer', fontSize: 11, flexShrink: 0,
              }}
            >
              {matched ? 'Update only' : 'Add only'}
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
        version={version}
        minimizeToTray={minimizeToTray}
        onClose={() => { setSettingsOpen(false); fetchSettings() }}
      />
    </div>
  )
}
