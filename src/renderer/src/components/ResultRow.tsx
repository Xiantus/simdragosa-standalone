import React from 'react'
import type { ActiveJob } from '../stores/useJobStore'

const DIFF_LABELS: Record<string, string> = {
  'raid-normal': 'Normal',
  'raid-heroic': 'Heroic',
  'raid-mythic': 'Mythic',
  'dungeon-mythic10': 'M+10',
  'dungeon-mythic-weekly10': 'M+10 Vault',
}

interface Props {
  job: ActiveJob
}

export default function ResultRow({ job }: Props): JSX.Element {
  const diffLabel = DIFF_LABELS[job.difficulty] ?? job.difficulty

  const statusColor =
    job.status === 'done' ? 'var(--green)' :
    job.status === 'error' ? 'var(--red)' :
    'var(--sub)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px', borderRadius: 6, marginBottom: 6,
      background: 'var(--surf)', border: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
            {job.char_name}
          </span>
          <span style={{ fontSize: 12, color: 'var(--sub)' }}>{diffLabel}</span>
          {job.build_label && job.build_label !== 'Default' && (
            <span style={{ fontSize: 11, color: 'var(--sub)', fontStyle: 'italic' }}>
              {job.build_label}
            </span>
          )}
        </div>
        {job.status === 'error' && job.error_message && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>
            {job.error_message}
          </div>
        )}
      </div>

      {job.status === 'done' && job.url && (
        <a
          href={job.url}
          onClick={(e) => { e.preventDefault(); window.open(job.url!, '_blank') }}
          style={{
            color: 'var(--accent)', fontSize: 12, textDecoration: 'none',
            fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          View Report →
        </a>
      )}

      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, flexShrink: 0 }}>
        {job.status.toUpperCase()}
      </span>
    </div>
  )
}
