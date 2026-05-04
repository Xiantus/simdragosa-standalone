import React, { useEffect, useState } from 'react'
import { useJobStore } from '../stores/useJobStore'
import { useCharacterStore } from '../stores/useCharacterStore'
import ActiveJobsStrip from './ActiveJobsStrip'
import ResultsPanel from './ResultsPanel'
import CharacterSelector from './CharacterSelector'
import DifficultyPicker from './DifficultyPicker'
import RunButton from './RunButton'

interface Props {
  playwrightInstalled?: boolean
  onInstallPlaywright?: () => void
}

export default function MainPanel({ playwrightInstalled = true, onInstallPlaywright }: Props): JSX.Element {
  const { jobs, running, startSim, cancelJobs, wireIpcEvents } = useJobStore()
  const { characters } = useCharacterStore()

  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [selectedDiffs, setSelectedDiffs] = useState<string[]>(['raid-heroic'])
  const [luaStatus, setLuaStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const [qeUrl, setQeUrl] = useState('')
  const [qeImporting, setQeImporting] = useState(false)
  const [qeStatus, setQeStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const [qeOpen, setQeOpen] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)

  useEffect(() => {
    return wireIpcEvents()
  }, [])

  const canRun = selectedChars.length > 0 && selectedDiffs.length > 0

  const handleGo = async () => {
    if (running) {
      await cancelJobs()
    } else if (canRun) {
      setSimError(null)
      try {
        await startSim({ character_ids: selectedChars, difficulties: selectedDiffs })
      } catch (err: any) {
        setSimError(err?.message ?? 'Failed to start sim')
        setTimeout(() => setSimError(null), 10000)
      }
    }
  }

  const handleQeImport = async () => {
    if (!qeUrl.trim()) return
    setQeImporting(true)
    setQeStatus(null)
    try {
      const result = await window.api.importQeUrl(qeUrl.trim())
      setQeStatus({ ok: true, msg: `✓ Imported ${result.total_items} items for ${result.char_name} (${result.spec_display})` })
      setQeUrl('')
      await useJobStore.getState().loadHistoricalJobs()
    } catch (err: any) {
      setQeStatus({ ok: false, msg: err?.message ?? 'Import failed' })
    } finally {
      setQeImporting(false)
      setTimeout(() => setQeStatus(null), 8000)
    }
  }

  const handleWriteLua = async () => {
    setLuaStatus(null)
    const result = await window.api.writeLua()
    const charCount = completed.filter((j, i, arr) =>
      arr.findIndex((x) => x.char_id === j.char_id) === i
    ).length
    if (result.ok) {
      setLuaStatus({ ok: true, msg: `✓ Exported ${charCount} character${charCount !== 1 ? 's' : ''} — /reload in WoW` })
    } else {
      setLuaStatus({ ok: false, msg: result.error ?? 'Unknown error' })
    }
    setTimeout(() => setLuaStatus(null), 6000)
  }

  // Deduplicate: newest job per char_id+difficulty+build_label combination
  const completed = (() => {
    const all = [...jobs]
      .filter((j) => ['done', 'error', 'cancelled'].includes(j.status))
      .sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))
    const seen = new Set<string>()
    return all.filter((j) => {
      const key = `${j.char_id}|${j.difficulty}|${j.build_label}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })()

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* RunPanel */}
      <section
        data-testid="run-panel"
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surf)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CharacterSelector
            characters={characters}
            selected={selectedChars}
            onChange={setSelectedChars}
          />
          <DifficultyPicker selected={selectedDiffs} onChange={setSelectedDiffs} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <RunButton disabled={!canRun} running={running} onClick={handleGo} />
          {simError && (
            <span style={{ fontSize: 11, color: 'var(--red)', maxWidth: 220, textAlign: 'right', lineHeight: 1.4 }}>
              {simError}
            </span>
          )}
        </div>
      </section>

      {/* QE Report import — collapsible, healer-targeted */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        {/* Toggle row */}
        <button
          onClick={() => setQeOpen((v) => !v)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '5px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--sub)',
          }}
        >
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.06em',
            color: 'var(--sub)',
          }}>
            QE REPORT
          </span>
          <span style={{ fontSize: 11, color: 'var(--sub)' }}>Healer? Import QuestionablyEpic data</span>
          <span style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: 'var(--sub)',
            display: 'inline-block',
            transform: qeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>
            ▼
          </span>
        </button>

        {/* Expanded input row */}
        {qeOpen && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 20px 8px',
          }}>
            <input
              value={qeUrl}
              onChange={(e) => setQeUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQeImport() }}
              placeholder="Paste QuestionablyEpic report URL…"
              style={{
                flex: 1,
                padding: '5px 10px',
                borderRadius: 5,
                fontSize: 12,
                border: '1px solid var(--border)',
                background: 'var(--surf)',
                color: 'var(--text)',
                outline: 'none',
                userSelect: 'text',
                WebkitUserSelect: 'text',
              } as React.CSSProperties}
              autoFocus
            />
            <button
              onClick={handleQeImport}
              disabled={!qeUrl.trim() || qeImporting}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--surf2)',
                color: qeUrl.trim() && !qeImporting ? 'var(--text)' : 'var(--sub)',
                cursor: qeUrl.trim() && !qeImporting ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {qeImporting ? 'Importing…' : 'Import'}
            </button>
            {qeStatus && (
              <span style={{ fontSize: 11, color: qeStatus.ok ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                {qeStatus.msg}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Active jobs */}
      <ActiveJobsStrip running={running} jobs={jobs} />

      {/* Results header */}
      {completed.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px 0',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10,
            color: 'var(--sub)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.08em',
          }}>
            RESULTS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {luaStatus && (
              <span style={{
                fontSize: 11,
                color: luaStatus.ok ? 'var(--green)' : 'var(--red)',
                fontWeight: luaStatus.ok ? 600 : 400,
              }}>
                {luaStatus.msg}
              </span>
            )}
            <button
              onClick={handleWriteLua}
              title="Write SimdragosaData.lua to the WoW addon folder"
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--accent)',
                background: 'transparent',
                color: 'var(--accent)',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(124,106,247,0.12)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              Send to WoW
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <section
        data-testid="results-panel"
        style={{ flex: 1, overflow: 'hidden', padding: '12px 20px 16px', display: 'flex', flexDirection: 'column' }}
      >
        {completed.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 10,
            opacity: 0.6,
          }}>
            {/* Dragon watermark */}
            <svg width="52" height="52" viewBox="0 0 24 24" fill="var(--accent)" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.4 }}>
              <path d="M12 2C8 2 5 5 5 8c0 2 1 3.5 2.5 4.5L5 20h4l1.5-4h3L15 20h4l-2.5-7.5C18 11.5 19 10 19 8c0-3-3-6-7-6zm0 2c2.8 0 5 2.2 5 4 0 1.5-.8 2.8-2 3.5l-.5.3.3.5L17 18h-2l-1.5-4h-3L9 18H7l2.2-5.7.3-.5-.5-.3C7.8 10.8 7 9.5 7 8c0-1.8 2.2-4 5-4z"/>
            </svg>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--sub)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.04em',
            }}>
              No Sims Yet
            </span>
            <span style={{
              fontSize: 12,
              color: 'var(--sub)',
              textAlign: 'center',
              maxWidth: 240,
              lineHeight: 1.6,
            }}>
              Select characters and difficulties above, then hit GO to start simming.
            </span>
          </div>
        ) : (
          <ResultsPanel jobs={completed} />
        )}
      </section>
    </main>
  )
}
