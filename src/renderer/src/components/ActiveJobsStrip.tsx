import React, { useEffect, useState } from 'react'
import type { ActiveJob } from '../stores/useJobStore'
import { diffLabel } from '../lib/difficulties'
import { formatDuration } from '../lib/time'

interface Props {
  running: boolean
  jobs: ActiveJob[]
  onCancelJob?: (jobId: string) => void
}

const ACTIVE = ['queued', 'fetching', 'submitting', 'running']

// Rough per-job duration when nothing has finished yet to learn from.
const DEFAULT_JOB_MS = 4 * 60_000
// Crafted runs sweep six stat pairings, one Raidbots sim each.
const CRAFTED_FACTOR = 6

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const STATUS_COLOR: Record<string, string> = {
  queued:     'var(--sub)',
  fetching:   'var(--blue)',
  submitting: 'var(--yellow)',
  running:    'var(--accent)',
}

/**
 * Typical duration of a finished non-crafted job this session.  Restored
 * historical jobs have no real start time, so anything under 10 s is ignored.
 */
export function typicalJobMs(jobs: ActiveJob[]): number {
  const durations = jobs
    .filter((j) => j.status === 'done' && j.ended_at && !j.difficulty.startsWith('profession'))
    .map((j) => j.ended_at! - j.started_at)
    .filter((d) => d > 10_000)
    .sort((a, b) => a - b)
  if (durations.length === 0) return DEFAULT_JOB_MS
  return durations[Math.floor(durations.length / 2)]
}

/**
 * Progress and remaining time for the batch in flight.  Jobs run in parallel
 * on Raidbots, so the batch ends when its slowest job does.
 */
export function batchProgress(jobs: ActiveJob[], now = Date.now()): { done: number; total: number; etaMs: number } {
  const active = jobs.filter((j) => ACTIVE.includes(j.status))
  if (active.length === 0) return { done: 0, total: 0, etaMs: 0 }
  const batchStart = Math.min(...active.map((j) => j.started_at))
  const batch = jobs.filter((j) => j.started_at >= batchStart - 1000 && j.ended_at !== j.started_at)
  const done = batch.filter((j) => !ACTIVE.includes(j.status)).length
  const per = typicalJobMs(jobs)
  const etaMs = Math.max(...active.map((j) => {
    const est = j.difficulty.startsWith('profession') ? per * CRAFTED_FACTOR : per
    return Math.max(est - (now - j.started_at), 15_000)
  }))
  return { done, total: batch.length, etaMs }
}

function JobPill({ job, now, onCancel }: { job: ActiveJob; now: number; onCancel?: () => void }): JSX.Element {
  const color = STATUS_COLOR[job.status] ?? 'var(--sub)'
  const lastLog = job.log_lines[job.log_lines.length - 1]
  // QE jobs drive a browser rather than a worker process; they cannot be stopped one by one.
  const cancellable = onCancel && !job.build_label?.startsWith('QE')
  return (
    <div
      title={lastLog}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: 'var(--surf2)',
        borderRadius: 6,
        padding: '3px 6px 3px 9px',
        fontSize: 11,
        flexShrink: 0,
        border: `1px solid ${job.status === 'running' ? 'var(--border)' : 'transparent'}`,
      }}
    >
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: color, flexShrink: 0,
        boxShadow: job.status === 'running' ? `0 0 6px ${color}` : 'none',
        animation: job.status === 'running' ? 'pulse-dot 1.6s ease-in-out infinite' : 'none',
      }} />
      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{job.char_name || job.job_id}</span>
      {job.difficulty && job.difficulty !== 'all' && (
        <span style={{ color: 'var(--sub)' }}>{diffLabel(job.difficulty)}</span>
      )}
      <span style={{ color, fontSize: 10, fontWeight: 600 }}>{job.status}</span>
      <span style={{ color: 'var(--sub)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(now - job.started_at)}
      </span>
      {cancellable && (
        <button
          type="button"
          title={`Cancel ${job.char_name} ${diffLabel(job.difficulty)}`}
          aria-label={`Cancel ${job.char_name} ${diffLabel(job.difficulty)}`}
          className="danger-hover"
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', color: 'var(--sub)',
            cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

export default function ActiveJobsStrip({ running, jobs, onCancelJob }: Props): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const now = useNow()

  if (!running) return null

  const activeJobs = jobs.filter((j) => ACTIVE.includes(j.status))
  const counts = ['running', 'fetching', 'submitting', 'queued']
    .map((s) => [s, activeJobs.filter((j) => j.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)

  const { done, total, etaMs } = batchProgress(jobs, now)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const COMPACT_THRESHOLD = 4

  return (
    <div
      data-testid="active-jobs-strip"
      style={{ background: 'var(--surf)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
    >
      <div style={{ padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', flexShrink: 0,
          animation: 'pulse-dot 1.6s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 11, color: 'var(--sub)', fontWeight: 600,
          fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
        }}>
          {activeJobs.length} sim{activeJobs.length !== 1 ? 's' : ''}{counts.length > 0 ? ` · ${counts.join(' · ')}` : ''}
        </span>

        {/* Batch progress */}
        <div
          role="progressbar"
          aria-label="Batch progress"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          style={{
            flex: 1, maxWidth: 220, height: 4, borderRadius: 2,
            background: 'var(--border)', overflow: 'hidden',
          }}
        >
          <div style={{
            width: `${Math.max(pct, 3)}%`, height: '100%', background: 'var(--accent)',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <span data-testid="batch-eta" style={{ fontSize: 10, color: 'var(--sub)', fontVariantNumeric: 'tabular-nums' }}>
          {done}/{total} · ~{formatDuration(etaMs)} left
        </span>

        {activeJobs.length > COMPACT_THRESHOLD && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sub)', fontSize: 10, fontWeight: 600, padding: '0 4px',
            }}
          >
            {expanded ? '▲ hide' : '▼ details'}
          </button>
        )}
      </div>

      {(activeJobs.length <= COMPACT_THRESHOLD || expanded) && activeJobs.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 16px 6px', overflowX: 'auto', flexWrap: 'nowrap',
        }}>
          {activeJobs.map((job) => (
            <JobPill
              key={job.job_id}
              job={job}
              now={now}
              onCancel={onCancelJob ? () => onCancelJob(job.job_id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
