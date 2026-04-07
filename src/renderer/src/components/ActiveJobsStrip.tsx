import React, { useEffect, useState } from 'react'
import type { ActiveJob } from '../stores/useJobStore'

interface Props {
  running: boolean
  jobs: ActiveJob[]
}

function useElapsed(startedAt: number): string {
  const [sec, setSec] = useState(Math.floor((Date.now() - startedAt) / 1000))
  useEffect(() => {
    const id = setInterval(() => setSec(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--sub)',
  fetching: 'var(--blue)',
  submitting: 'var(--yellow)',
  running: 'var(--accent)',
}

function JobPill({ job }: { job: ActiveJob }): JSX.Element {
  const elapsed = useElapsed(job.started_at)
  const color = STATUS_COLOR[job.status] ?? 'var(--sub)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--surf2)', borderRadius: 6, padding: '3px 10px', fontSize: 12,
    }}>
      <span style={{ color, fontSize: 9 }}>●</span>
      <span style={{ color: 'var(--text)', fontWeight: 600 }}>
        {job.char_name || job.job_id}
      </span>
      {job.difficulty && (
        <span style={{ color: 'var(--sub)' }}>{job.difficulty.replace('raid-', '')}</span>
      )}
      <span style={{ color }}>{job.status}</span>
      <span style={{ color: 'var(--sub)' }}>{elapsed}</span>
    </div>
  )
}

export default function ActiveJobsStrip({ running, jobs }: Props): JSX.Element | null {
  if (!running) return null

  const activeJobs = jobs.filter((j) =>
    ['queued', 'fetching', 'submitting', 'running'].includes(j.status)
  )

  return (
    <div
      data-testid="active-jobs-strip"
      style={{
        background: 'var(--surf)', borderBottom: '1px solid var(--border)',
        padding: '6px 16px', display: 'flex', alignItems: 'center',
        gap: 8, flexShrink: 0, flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 600 }}>
        {activeJobs.length} running
      </span>
      {activeJobs.map((job) => <JobPill key={job.job_id} job={job} />)}
    </div>
  )
}
