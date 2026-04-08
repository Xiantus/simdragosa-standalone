import React, { useEffect, useState } from 'react'
import { useJobStore } from '../stores/useJobStore'
import { useCharacterStore } from '../stores/useCharacterStore'
import ActiveJobsStrip from './ActiveJobsStrip'
import ResultRow from './ResultRow'
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

      {/* Playwright install banner intentionally hidden — healer sims not yet supported */}

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
        style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 16px' }}
      >
        {completed.length === 0 ? (
          <div style={{ color: 'var(--sub)', fontSize: 13 }}>
            Results will appear here after sims complete.
          </div>
        ) : (
          completed.map((job) => <ResultRow key={job.job_id} job={job} />)
        )}
      </section>
    </main>
  )
}
