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

  useEffect(() => {
    return wireIpcEvents()
  }, [])

  const canRun = selectedChars.length > 0 && selectedDiffs.length > 0

  const handleGo = async () => {
    if (running) {
      await cancelJobs()
    } else if (canRun) {
      await startSim({ character_ids: selectedChars, difficulties: selectedDiffs })
    }
  }

  const handleQeImport = async () => {
    if (!qeUrl.trim()) return
    setQeImporting(true)
    setQeStatus(null)
    try {
      const result = await window.api.importQeUrl(qeUrl.trim())
      setQeStatus({ ok: true, msg: `Imported ${result.total_items} items for ${result.char_name} (${result.spec_display})` })
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
    if (result.ok) {
      setLuaStatus({ ok: true, msg: `Written to ${result.path}` })
    } else {
      setLuaStatus({ ok: false, msg: result.error ?? 'Unknown error' })
    }
    setTimeout(() => setLuaStatus(null), 5000)
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
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surf)', display: 'flex', alignItems: 'center',
          gap: 16, flexShrink: 0, flexWrap: 'wrap',
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
        <RunButton disabled={!canRun} running={running} onClick={handleGo} />
      </section>

      {/* QE URL import — healer specs */}
      <section
        style={{
          padding: '6px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--sub)', whiteSpace: 'nowrap', fontWeight: 600 }}>
          QE REPORT
        </span>
        <input
          value={qeUrl}
          onChange={(e) => setQeUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQeImport() }}
          placeholder="Paste QuestionablyEpic report URL…"
          style={{
            flex: 1, padding: '4px 8px', borderRadius: 4, fontSize: 12,
            border: '1px solid var(--border)', background: 'var(--surf)',
            color: 'var(--text)', outline: 'none',
          }}
        />
        <button
          onClick={handleQeImport}
          disabled={!qeUrl.trim() || qeImporting}
          style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border)', background: 'var(--surf2)',
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
      </section>

      {/* Active jobs */}
      <ActiveJobsStrip running={running} jobs={jobs} />

      {/* Results header */}
      {completed.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px 0', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>
            RESULTS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {luaStatus && (
              <span style={{ fontSize: 11, color: luaStatus.ok ? 'var(--green)' : 'var(--red)' }}>
                {luaStatus.msg}
              </span>
            )}
            <button
              onClick={handleWriteLua}
              title="Write SimdragosaData.lua to the addon data folder"
              style={{
                padding: '4px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--border)', background: 'var(--surf2)',
                color: 'var(--text)', cursor: 'pointer',
              }}
            >
              Export Lua
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
          <div style={{ color: 'var(--sub)', fontSize: 13 }}>
            Results will appear here after sims complete.
          </div>
        ) : (
          <ResultsPanel jobs={completed} />
        )}
      </section>
    </main>
  )
}
