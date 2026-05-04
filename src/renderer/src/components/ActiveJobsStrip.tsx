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
  queued:     'var(--sub)',
  fetching:   'var(--blue)',
  submitting: 'var(--yellow)',
  running:    'var(--accent)',
}

const STATUS_LABEL: Record<string, string> = {
  queued:     'queued',
  fetching:   'fetching',
  submitting: 'submitting',
  running:    'running',
}

function JobPill({ job }: { job: ActiveJob }): JSX.Element {
  const elapsed = useElapsed(job.started_at)
  const color = STATUS_COLOR[job.status] ?? 'var(--sub)'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      background: 'var(--surf2)',
      borderRadius: 6,
      padding: '3px 9px',
      fontSize: 11,
      flexShrink: 0,
      border: `1px solid ${job.status === 'running' ? 'var(--border)' : 'transparent'}`,
    }}>
      {/* Pulsing status dot */}
      <span style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: job.status === 'running' ? `0 0 6px ${color}` : 'none',
      }} />
      <span style={{ color: 'var(--text)', fontWeight: 600 }}>
        {job.char_name || job.job_id}
      </span>
      {job.difficulty && (
        <span style={{ color: 'var(--sub)' }}>
          {job.difficulty.replace('raid-', '').replace('dungeon-', '')}
        </span>
      )}
      <span style={{ color, fontSize: 10, fontWeight: 600 }}>
        {STATUS_LABEL[job.status] ?? job.status}
      </span>
      <span style={{ color: 'var(--sub)', fontSize: 10 }}>{elapsed}</span>
    </div>
  )
}

export default function ActiveJobsStrip({ running, jobs }: Props): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)

  if (!running) return null

  const activeJobs = jobs.filter((j) =>
    ['queued', 'fetching', 'submitting', 'running'].includes(j.status)
  )

  const runningCount   = activeJobs.filter((j) => j.status === 'running').length
  const fetchingCount  = activeJobs.filter((j) => j.status === 'fetching').length
  const submittingCount = activeJobs.filter((j) => j.status === 'submitting').length
  const queuedCount    = activeJobs.filter((j) => j.status === 'queued').length

  // Summarise status counts into a short label
  const parts: string[] = []
  if (runningCount)    parts.push(`${runningCount} running`)
  if (fetchingCount)   parts.push(`${fetchingCount} fetching`)
  if (submittingCount) parts.push(`${submittingCount} submitting`)
  if (queuedCount)     parts.push(`${queuedCount} queued`)

  const COMPACT_THRESHOLD = 4

  return (
    <div
      data-testid="active-jobs-strip"
      style={{
        background: 'var(--surf)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Always-visible compact header */}
      <div style={{
        padding: '5px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {/* Animated spinner dot */}
        <span style={{
          display: 'inline-block',
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 8px var(--accent)',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11,
          color: 'var(--sub)',
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.04em',
        }}>
          {parts.join(' · ') || `${activeJobs.length} sims`}
        </span>
        {activeJobs.length > COMPACT_THRESHOLD && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--sub)',
              fontSize: 10,
              fontWeight: 600,
              padding: '0 4px',
            }}
          >
            {expanded ? '▲ hide' : '▼ details'}
          </button>
        )}
      </div>

      {/* Pills row — always show if ≤ threshold, toggle if above */}
      {(activeJobs.length <= COMPACT_THRESHOLD || expanded) && activeJobs.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 16px 6px',
          overflowX: 'auto',
          flexWrap: 'nowrap',
        }}>
          {activeJobs.map((job) => <JobPill key={job.job_id} job={job} />)}
        </div>
      )}
    </div>
  )
}
