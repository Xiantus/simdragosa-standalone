import React, { useEffect, useState } from 'react'
import { useJobStore } from '../stores/useJobStore'
import { useCharacterStore } from '../stores/useCharacterStore'
import ActiveJobsStrip from './ActiveJobsStrip'
import ResultRow from './ResultRow'
import CharacterSelector from './CharacterSelector'
import DifficultyPicker from './DifficultyPicker'
import RunButton from './RunButton'

export default function MainPanel(): JSX.Element {
  const { jobs, running, startSim, cancelJobs, wireIpcEvents } = useJobStore()
  const { characters } = useCharacterStore()

  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [selectedDiffs, setSelectedDiffs] = useState<string[]>(['raid-heroic'])

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

  const completed = [...jobs]
    .filter((j) => ['done', 'error', 'cancelled'].includes(j.status))
    .sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))

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

      {/* Active jobs */}
      <ActiveJobsStrip running={running} jobs={jobs} />

      {/* Results */}
      <section
        data-testid="results-panel"
        style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}
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
