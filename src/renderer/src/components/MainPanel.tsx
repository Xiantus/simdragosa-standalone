import React, { useEffect } from 'react'
import { useJobStore } from '../stores/useJobStore'
import ActiveJobsStrip from './ActiveJobsStrip'
import ResultRow from './ResultRow'

export default function MainPanel(): JSX.Element {
  const { jobs, running, wireIpcEvents } = useJobStore()

  useEffect(() => {
    return wireIpcEvents()
  }, [])

  const completed = [...jobs]
    .filter((j) => ['done', 'error', 'cancelled'].includes(j.status))
    .sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* RunPanel — selections wired in #22 */}
      <section
        data-testid="run-panel"
        style={{
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surf)', display: 'flex', alignItems: 'center',
          gap: 12, flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--sub)', fontSize: 13 }}>
          Select characters and difficulties → GO
        </span>
      </section>

      {/* Active jobs strip */}
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
