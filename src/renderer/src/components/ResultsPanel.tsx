import React, { useState, useEffect, useRef } from 'react'
import { iconUrlFromSpecName } from '../lib/specIcons'
import { useJobStore, type ActiveJob } from '../stores/useJobStore'
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

const LS_CHAR_ORDER = 'simdragosa:char-order'

// ── DPS gain bars ────────────────────────────────────────────────────────────

interface ItemMeta { name: string }

function DpsGainBars({ gains, wide = false }: { gains: DpsGain[]; wide?: boolean }): JSX.Element {
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
  const labelWidth = wide ? 220 : 160
  const dpsWidth = wide ? 90 : 72

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? 5 : 3 }}>
      {sorted.map((g) => {
        const pct = Math.max(4, (g.dps_gain / maxGain) * 100)
        const hue = 260 - (sorted.indexOf(g) / Math.max(sorted.length - 1, 1)) * 80
        const rawName = g.item_name ?? meta[g.item_id]?.name
        const label = rawName ? rawName.replace(/_/g, ' ') : `Item #${g.item_id}`
        return (
          <div key={`${g.item_id}-${g.dps_gain}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: labelWidth, fontSize: wide ? 12 : 11,
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
            <div style={{ flex: 1, height: wide ? 12 : 10, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 3,
                background: `hsl(${hue}, 70%, 55%)`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{
              fontSize: wide ? 12 : 11, color: 'var(--sub)', width: dpsWidth,
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

// ── Full-width expanded panel (renders below the spec card row) ──────────────

function ExpandedPanel({ job, onClose }: { job: ActiveJob; onClose: () => void }): JSX.Element {
  const diffLabel = DIFF_LABELS[job.difficulty] ?? job.difficulty
  const upgradeCount = job.dps_gains?.length ?? 0

  return (
    <div style={{
      marginTop: 8,
      background: 'var(--bg)',
      border: '1px solid var(--accent)',
      borderRadius: 6,
      padding: '10px 14px',
    }}>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{diffLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>
          {upgradeCount} upgrade{upgradeCount !== 1 ? 's' : ''}
        </span>
        {job.build_label && job.build_label !== 'Default' && (
          <span style={{ fontSize: 11, color: 'var(--sub)', fontStyle: 'italic' }}>
            · {job.build_label}
          </span>
        )}
        {job.url && (
          <a
            href={job.url}
            onClick={(e) => { e.preventDefault(); window.open(job.url!, '_blank') }}
            style={{
              marginLeft: 'auto', marginRight: 8,
              color: 'var(--accent)', fontSize: 11, fontWeight: 600, textDecoration: 'none',
            }}
          >
            View Report →
          </a>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--sub)', fontSize: 14, padding: '0 2px', lineHeight: 1,
            flexShrink: 0,
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {job.dps_gains && <DpsGainBars gains={job.dps_gains} wide />}
    </div>
  )
}

// ── Diff card (controlled — SpecSection owns expanded state) ─────────────────

function DiffCard({
  job,
  isExpanded,
  onToggle,
  onDelete,
}: {
  job: ActiveJob
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
}): JSX.Element {
  const diffLabel = DIFF_LABELS[job.difficulty] ?? job.difficulty
  const hasGains = job.status === 'done' && job.dps_gains && job.dps_gains.length > 0
  const [hovered, setHovered] = useState(false)
  const isActive = ['queued', 'fetching', 'submitting', 'running'].includes(job.status)

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
      onClick={() => hasGains && onToggle()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: 'var(--bg)',
        border: `1px solid ${isExpanded ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '7px 10px',
        flex: '1 1 110px',
        minWidth: 110,
        maxWidth: 170,
        cursor: hasGains ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--sub)',
          textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1,
        }}>
          {diffLabel}
        </span>
        {hovered && !isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Delete this sim"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sub)', fontSize: 12, lineHeight: 1,
              padding: '0 0 0 4px', flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--red)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--sub)' }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{statusText}</span>
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

      {job.build_label && job.build_label !== 'Default' && (
        <div style={{ fontSize: 10, color: 'var(--sub)', fontStyle: 'italic', marginTop: 2 }}>
          {job.build_label}
        </div>
      )}

      {job.status === 'error' && job.error_message && (
        <div
          style={{ fontSize: 10, color: 'var(--red)', marginTop: 4, cursor: 'pointer' }}
          title={job.error_message}
          onClick={(e) => { e.stopPropagation(); window.alert(job.error_message) }}
        >
          {job.error_message.length > 55 ? job.error_message.slice(0, 55) + '…' : job.error_message}
        </div>
      )}

      {hasGains && (
        <div style={{ fontSize: 10, color: isExpanded ? 'var(--accent)' : 'var(--sub)', marginTop: 4, opacity: 0.8 }}>
          {isExpanded ? '▲ hide' : '▼ items'}
        </div>
      )}
    </div>
  )
}

// ── Spec sub-group ────────────────────────────────────────────────────────────

function SpecSection({ spec, jobs, onDeleteJob }: { spec: string; jobs: ActiveJob[]; onDeleteJob: (job: ActiveJob) => void }): JSX.Element {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const sorted = [...jobs].sort((a, b) => {
    const ai = DIFF_ORDER.indexOf(a.difficulty)
    const bi = DIFF_ORDER.indexOf(b.difficulty)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const expandedJob = expandedJobId ? sorted.find((j) => j.job_id === expandedJobId) ?? null : null

  function toggle(jobId: string) {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId))
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Spec label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <div style={{ position: 'relative', width: 14, height: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
          {iconUrlFromSpecName(spec) && (
            <img
              src={iconUrlFromSpecName(spec)!}
              alt=""
              width={14}
              height={14}
              style={{ borderRadius: 2, position: 'absolute', inset: 0 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--sub)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {spec}
        </span>
      </div>

      {/* Difficulty cards row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sorted.map((job) => (
          <DiffCard
            key={job.job_id}
            job={job}
            isExpanded={expandedJobId === job.job_id}
            onToggle={() => toggle(job.job_id)}
            onDelete={() => onDeleteJob(job)}
          />
        ))}
      </div>

      {/* Full-width expanded panel */}
      {expandedJob && expandedJob.dps_gains && (
        <ExpandedPanel job={expandedJob} onClose={() => setExpandedJobId(null)} />
      )}
    </div>
  )
}

// ── Character section (collapsible + draggable) ───────────────────────────────

interface CharacterSectionProps {
  charId: string
  charName: string
  specMap: Map<string, ActiveJob[]>
  specOrder: string[]
  isDragOver: boolean
  isDragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDeleteJob: (job: ActiveJob) => void
}

function CharacterSection({
  charName, specMap, specOrder,
  isDragOver, isDragging,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onDeleteJob,
}: CharacterSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [headerHovered, setHeaderHovered] = useState(false)

  const allJobs = [...specMap.values()].flat()
  const doneCount = allJobs.filter((j) => j.status === 'done').length

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        marginBottom: 10,
        background: 'var(--surf)',
        border: `1px solid ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
        borderLeft: `3px solid ${isDragOver ? 'var(--acc-h)' : 'var(--accent)'}`,
        borderRadius: 6,
        overflow: 'hidden',
        opacity: isDragging ? 0.35 : 1,
        transition: 'opacity 0.15s, border-color 0.12s',
        boxShadow: isDragOver ? '0 0 0 1px var(--accent)' : 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          cursor: 'grab',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          userSelect: 'none',
        }}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
      >
        {/* Drag handle */}
        <span style={{
          fontSize: 13, color: headerHovered ? 'var(--sub)' : 'transparent',
          flexShrink: 0, transition: 'color 0.15s', lineHeight: 1,
          cursor: 'grab',
        }}>
          ⠿
        </span>

        {/* Collapse toggle — only this part collapses, not the drag handle */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v) }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            {charName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--sub)' }}>
            {specMap.size} spec{specMap.size !== 1 ? 's' : ''} · {doneCount}/{allJobs.length} done
          </span>
          <span style={{ fontSize: 10, color: 'var(--sub)', opacity: 0.7 }}>
            {collapsed ? '▶' : '▼'}
          </span>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '10px 12px 4px' }}>
          {specOrder.map((spec) => (
            <SpecSection key={spec} spec={spec} jobs={specMap.get(spec)!} onDeleteJob={onDeleteJob} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ResultsPanel ─────────────────────────────────────────────────────────────

type SortMode = 'recent' | 'az' | 'upgrades' | 'custom'

interface Props {
  jobs: ActiveJob[]
}

export default function ResultsPanel({ jobs }: Props): JSX.Element {
  const deleteJob = useJobStore((s) => s.deleteJob)
  const [diffFilter, setDiffFilter] = useState<Set<string>>(new Set())

  // Persist custom char order in localStorage
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_CHAR_ORDER) ?? '[]') }
    catch { return [] }
  })

  const [sortMode, setSortMode] = useState<SortMode>(() =>
    localStorage.getItem(LS_CHAR_ORDER) ? 'custom' : 'recent'
  )

  // Drag state — both ref (no re-render) and state (visual feedback)
  const draggedIdRef = useRef<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // All distinct difficulties present, in canonical order
  const allDiffs = [...new Set(jobs.map((j) => j.difficulty))].sort((a, b) => {
    const ai = DIFF_ORDER.indexOf(a); const bi = DIFF_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  // Apply difficulty filter
  const filtered = diffFilter.size === 0 ? jobs : jobs.filter((j) => diffFilter.has(j.difficulty))

  // Group: char_id → { charName, bySpec }
  // charOrder = first-seen order (input is already newest-completed-first)
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

  // Sort characters
  const sortedCharIds = [...charOrder].sort((a, b) => {
    if (sortMode === 'custom' && customOrder.length > 0) {
      const ai = customOrder.indexOf(a)
      const bi = customOrder.indexOf(b)
      const aPos = ai === -1 ? charOrder.indexOf(a) + 10000 : ai
      const bPos = bi === -1 ? charOrder.indexOf(b) + 10000 : bi
      return aPos - bPos
    }
    if (sortMode === 'az') {
      return byChar.get(a)!.charName.localeCompare(byChar.get(b)!.charName)
    }
    if (sortMode === 'upgrades') {
      const aUp = [...byChar.get(a)!.bySpec.values()].flat()
        .reduce((s, j) => s + (j.dps_gains?.length ?? 0), 0)
      const bUp = [...byChar.get(b)!.bySpec.values()].flat()
        .reduce((s, j) => s + (j.dps_gains?.length ?? 0), 0)
      return bUp - aUp
    }
    return 0 // recent — preserve first-seen order
  })

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(charId: string, e: React.DragEvent) {
    draggedIdRef.current = charId
    setDraggedId(charId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(charId: string, e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIdRef.current !== charId) setDragOverId(charId)
  }

  function handleDrop(targetId: string, e: React.DragEvent) {
    e.preventDefault()
    const sourceId = draggedIdRef.current
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null); setDraggedId(null); draggedIdRef.current = null
      return
    }

    // Build new order from current visible order as base
    const base = [...sortedCharIds]
    const from = base.indexOf(sourceId)
    const to = base.indexOf(targetId)
    if (from === -1 || to === -1) return

    const next = [...base]
    next.splice(from, 1)
    next.splice(to, 0, sourceId)

    setCustomOrder(next)
    setSortMode('custom')
    localStorage.setItem(LS_CHAR_ORDER, JSON.stringify(next))
    setDragOverId(null)
    setDraggedId(null)
    draggedIdRef.current = null
  }

  function handleDragEnd() {
    draggedIdRef.current = null
    setDraggedId(null)
    setDragOverId(null)
  }

  function clearCustomOrder() {
    setCustomOrder([])
    setSortMode('recent')
    localStorage.removeItem(LS_CHAR_ORDER)
  }

  function toggleDiff(diff: string) {
    setDiffFilter((prev) => {
      const next = new Set(prev)
      if (next.has(diff)) next.delete(diff)
      else next.add(diff)
      return next
    })
  }

  const showControls = allDiffs.length > 1 || byChar.size > 1

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
                  <button key={diff} onClick={() => toggleDiff(diff)} style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.12s',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'var(--accent)' : 'var(--surf2)',
                    color: active ? '#fff' : 'var(--sub)',
                  }}>
                    {DIFF_LABELS[diff] ?? diff}
                  </button>
                )
              })}
              {diffFilter.size > 0 && (
                <button onClick={() => setDiffFilter(new Set())} style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 11,
                  cursor: 'pointer', border: '1px solid var(--border)',
                  background: 'none', color: 'var(--sub)',
                }}>✕</button>
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
                const active = sortMode === mode
                return (
                  <button key={mode} onClick={() => setSortMode(mode)} style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.12s',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'var(--accent)' : 'var(--surf2)',
                    color: active ? '#fff' : 'var(--sub)',
                  }}>
                    {label}
                  </button>
                )
              })}
              {/* Custom order badge — shown only when active */}
              {sortMode === 'custom' && (
                <button onClick={clearCustomOrder} style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid var(--accent)',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  Custom ✕
                </button>
              )}
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
                charId={charId}
                charName={charName}
                specMap={bySpec}
                specOrder={specOrder}
                isDragging={draggedId === charId}
                isDragOver={dragOverId === charId}
                onDragStart={(e) => handleDragStart(charId, e)}
                onDragOver={(e) => handleDragOver(charId, e)}
                onDrop={(e) => handleDrop(charId, e)}
                onDragEnd={handleDragEnd}
                onDeleteJob={(job) => deleteJob(job.job_id, job.char_id, job.difficulty, job.build_label)}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
