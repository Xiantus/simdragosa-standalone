import React, { useState, useEffect } from 'react'
import type { ActiveJob } from '../stores/useJobStore'
import type { DpsGain } from '../../../shared/ipc'

const DIFF_LABELS: Record<string, string> = {
  'raid-normal': 'Normal',
  'raid-heroic': 'Heroic',
  'raid-mythic': 'Mythic',
  'dungeon-mythic10': 'M+10',
  'dungeon-mythic-weekly10': 'M+10 Vault',
}

const DIFF_ORDER = [
  'raid-normal',
  'raid-heroic',
  'raid-mythic',
  'dungeon-mythic10',
  'dungeon-mythic-weekly10',
]

// ── DPS gain bars (self-contained, same logic as ResultRow) ─────────────────

interface ItemMeta { name: string }

function DpsGainBars({ gains }: { gains: DpsGain[] }): JSX.Element {
  const [meta, setMeta] = useState<Record<number, ItemMeta>>({})

  useEffect(() => {
    const unknownIds = gains
      .filter((g) => !g.item_name)
      .map((g) => g.item_id)
      .filter((id, i, arr) => arr.indexOf(id) === i)
    if (unknownIds.length === 0) return
    window.api
      .fetchItemNames(unknownIds)
      .then((r) => { if (Object.keys(r).length > 0) setMeta(r) })
      .catch(() => {})
  }, [gains])

  const sorted = [...gains].sort((a, b) => b.dps_gain - a.dps_gain).slice(0, 12)
  const maxGain = sorted[0]?.dps_gain ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 10 }}>
      {sorted.map((g) => {
        const pct = Math.max(4, (g.dps_gain / maxGain) * 100)
        const hue = 260 - (sorted.indexOf(g) / Math.max(sorted.length - 1, 1)) * 80
        const rawName = g.item_name ?? meta[g.item_id]?.name
        const label = rawName ? rawName.replace(/_/g, ' ') : `Item #${g.item_id}`
        return (
          <div key={`${g.item_id}-${g.dps_gain}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 160, fontSize: 11,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <a
                href={`https://www.wowhead.com/item=${g.item_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text)', textDecoration: 'none', cursor: 'pointer' }}
              >
                {label}
              </a>
              {g.ilvl != null && (
                <span style={{ color: 'var(--sub)', marginLeft: 4 }}>({g.ilvl})</span>
              )}
            </div>
            <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 3,
                background: `hsl(${hue}, 70%, 55%)`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{
              fontSize: 11, color: 'var(--sub)', width: 72,
              textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
            }}>
              +{g.dps_gain.toLocaleString(undefined, { maximumFractionDigits: 1 })} dps
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Single difficulty card ──────────────────────────────────────────────────

function DiffCard({ job }: { job: ActiveJob }): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const diffLabel = DIFF_LABELS[job.difficulty] ?? job.difficulty
  const hasGains = job.status === 'done' && job.dps_gains && job.dps_gains.length > 0

  const statusColor =
    job.status === 'done' ? 'var(--green)' :
    job.status === 'error' ? 'var(--red)' :
    'var(--sub)'

  const statusText =
    job.status === 'error' ? 'ERROR' :
    job.status === 'cancelled' ? 'CANCELLED' :
    job.status === 'done'
      ? (hasGains ? `${job.dps_gains!.length} upgr` : 'DONE')
      : job.status.toUpperCase()

  return (
    <div
      onClick={() => hasGains && setExpanded((v) => !v)}
      style={{
        background: 'var(--bg)',
        border: `1px solid ${expanded ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '7px 10px',
        flex: '1 1 110px',
        minWidth: 110,
        maxWidth: 170,
        cursor: hasGains ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Difficulty label */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--sub)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>
        {diffLabel}
      </div>

      {/* Status + report link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>
          {statusText}
        </span>
        {job.status === 'done' && job.url && (
          <a
            href={job.url}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(job.url!, '_blank') }}
            style={{ color: 'var(--accent)', fontSize: 11, textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}
            title="Open full report"
          >
            View →
          </a>
        )}
      </div>

      {/* Build label (non-default) */}
      {job.build_label && job.build_label !== 'Default' && (
        <div style={{ fontSize: 10, color: 'var(--sub)', fontStyle: 'italic', marginTop: 2 }}>
          {job.build_label}
        </div>
      )}

      {/* Error summary */}
      {job.status === 'error' && job.error_message && (
        <div
          style={{ fontSize: 10, color: 'var(--red)', marginTop: 4, cursor: 'pointer' }}
          title={job.error_message}
          onClick={(e) => { e.stopPropagation(); window.alert(job.error_message) }}
        >
          {job.error_message.length > 55
            ? job.error_message.slice(0, 55) + '…'
            : job.error_message}
        </div>
      )}

      {/* Expand toggle hint */}
      {hasGains && (
        <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 4, opacity: 0.7 }}>
          {expanded ? '▲ hide' : '▼ items'}
        </div>
      )}

      {/* DPS gain bars */}
      {hasGains && expanded && <DpsGainBars gains={job.dps_gains!} />}
    </div>
  )
}

// ── Spec sub-group ──────────────────────────────────────────────────────────

function SpecSection({ spec, jobs }: { spec: string; jobs: ActiveJob[] }): JSX.Element {
  const sorted = [...jobs].sort((a, b) => {
    const ai = DIFF_ORDER.indexOf(a.difficulty)
    const bi = DIFF_ORDER.indexOf(b.difficulty)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--accent)', flexShrink: 0,
        }} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--sub)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {spec}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sorted.map((job) => (
          <DiffCard key={job.job_id} job={job} />
        ))}
      </div>
    </div>
  )
}

// ── Character collapsible section ───────────────────────────────────────────

interface CharacterSectionProps {
  charName: string
  specMap: Map<string, ActiveJob[]>
  specOrder: string[]
}

function CharacterSection({ charName, specMap, specOrder }: CharacterSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  const allJobs = [...specMap.values()].flat()
  const doneCount = allJobs.filter((j) => j.status === 'done').length
  const specCount = specMap.size

  return (
    <div style={{
      marginBottom: 10,
      background: 'var(--surf)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          {charName}
        </span>
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>
          {specCount} spec{specCount !== 1 ? 's' : ''} · {doneCount}/{allJobs.length} done
        </span>
        <span style={{ fontSize: 10, color: 'var(--sub)', marginLeft: 2, opacity: 0.7 }}>
          {collapsed ? '▶' : '▼'}
        </span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '10px 12px 4px' }}>
          {specOrder.map((spec) => (
            <SpecSection key={spec} spec={spec} jobs={specMap.get(spec)!} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ResultsPanel (root) ─────────────────────────────────────────────────────

type SortMode = 'recent' | 'az' | 'upgrades'

interface Props {
  jobs: ActiveJob[]
}

export default function ResultsPanel({ jobs }: Props): JSX.Element {
  const [diffFilter, setDiffFilter] = useState<Set<string>>(new Set())
  const [sortMode, setSortMode] = useState<SortMode>('recent')

  // All distinct difficulties present in the data, in canonical order
  const allDiffs = [...new Set(jobs.map((j) => j.difficulty))]
    .sort((a, b) => {
      const ai = DIFF_ORDER.indexOf(a)
      const bi = DIFF_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  // Filter by selected difficulties (empty = show all)
  const filtered = diffFilter.size === 0 ? jobs : jobs.filter((j) => diffFilter.has(j.difficulty))

  // Group: char_id → { charName, bySpec: spec → jobs[] }
  // charOrder tracks first-seen order (newest-completed-first from the already-sorted input)
  const charOrder: string[] = []
  const byChar = new Map<string, { charName: string; bySpec: Map<string, ActiveJob[]> }>()

  for (const job of filtered) {
    if (!byChar.has(job.char_id)) {
      byChar.set(job.char_id, { charName: job.char_name, bySpec: new Map() })
      charOrder.push(job.char_id)
    }
    const entry = byChar.get(job.char_id)!
    const specKey = job.spec
      ? job.spec.charAt(0).toUpperCase() + job.spec.slice(1)
      : 'Default'
    if (!entry.bySpec.has(specKey)) entry.bySpec.set(specKey, [])
    entry.bySpec.get(specKey)!.push(job)
  }

  // Sort characters according to sortMode
  const sortedCharIds = [...charOrder].sort((a, b) => {
    if (sortMode === 'az') {
      return byChar.get(a)!.charName.localeCompare(byChar.get(b)!.charName)
    }
    if (sortMode === 'upgrades') {
      const aUpgr = [...byChar.get(a)!.bySpec.values()]
        .flat()
        .reduce((s, j) => s + (j.dps_gains?.length ?? 0), 0)
      const bUpgr = [...byChar.get(b)!.bySpec.values()]
        .flat()
        .reduce((s, j) => s + (j.dps_gains?.length ?? 0), 0)
      return bUpgr - aUpgr
    }
    // 'recent' — preserve first-seen order (input is already newest-first)
    return 0
  })

  const toggleDiff = (diff: string) => {
    setDiffFilter((prev) => {
      const next = new Set(prev)
      if (next.has(diff)) next.delete(diff)
      else next.add(diff)
      return next
    })
  }

  const showControls = allDiffs.length > 1 || jobs.length > 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Controls bar */}
      {showControls && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 0 8px', flexShrink: 0, flexWrap: 'wrap',
        }}>

          {/* Difficulty filter chips */}
          {allDiffs.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--sub)', fontWeight: 700, letterSpacing: '0.06em' }}>
                FILTER
              </span>
              {allDiffs.map((diff) => {
                const active = diffFilter.has(diff)
                return (
                  <button
                    key={diff}
                    onClick={() => toggleDiff(diff)}
                    style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.12s',
                      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: active ? 'var(--accent)' : 'var(--surf2)',
                      color: active ? '#fff' : 'var(--sub)',
                    }}
                  >
                    {DIFF_LABELS[diff] ?? diff}
                  </button>
                )
              })}
              {diffFilter.size > 0 && (
                <button
                  onClick={() => setDiffFilter(new Set())}
                  style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11,
                    cursor: 'pointer', border: '1px solid var(--border)',
                    background: 'none', color: 'var(--sub)',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Sort control */}
          {byChar.size > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
              <span style={{ fontSize: 10, color: 'var(--sub)', fontWeight: 700, letterSpacing: '0.06em' }}>
                SORT
              </span>
              {(['recent', 'az', 'upgrades'] as SortMode[]).map((mode) => {
                const label = mode === 'recent' ? 'Recent' : mode === 'az' ? 'A→Z' : 'Upgrades'
                return (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.12s',
                      border: sortMode === mode ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: sortMode === mode ? 'var(--accent)' : 'var(--surf2)',
                      color: sortMode === mode ? '#fff' : 'var(--sub)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Character groups */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedCharIds.length === 0 ? (
          <div style={{ color: 'var(--sub)', fontSize: 13 }}>
            No results match the current filter.
          </div>
        ) : (
          sortedCharIds.map((charId) => {
            const { charName, bySpec } = byChar.get(charId)!
            const specOrder = [...bySpec.keys()].sort()
            return (
              <CharacterSection
                key={charId}
                charName={charName}
                specMap={bySpec}
                specOrder={specOrder}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
