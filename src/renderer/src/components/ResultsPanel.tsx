import React, { useState, useEffect, useRef } from 'react'
import { iconUrlFromSpecName } from '../lib/specIcons'
import { useJobStore, type ActiveJob } from '../stores/useJobStore'
import { exportableLinks, formatLinkList, formatDiscordMessage } from '../lib/reportLinks'
import { DIFF_LABELS, diffLabel, diffRank } from '../lib/difficulties'
import { timeAgo, isStale } from '../lib/time'
import { bestItems, farmSummary, diffsOf, type BestItem } from '../lib/resultsAgg'
import { useItemMeta, iconUrl, type ItemMeta } from '../lib/useItemMeta'
import ConfirmButton from './ConfirmButton'
import HistoryView from './HistoryView'
import type { Character, DpsGain } from '../../../shared/ipc'

const LS_CHAR_ORDER = 'simdragosa:char-order'
const LS_VIEW = 'simdragosa:results-view'

// WoW item quality colour scale (best → common)
const WOW_QUALITY_COLORS = [
  '#ff8c00', // 0 – Legendary / #1 upgrade
  '#a335ee', // 1 – Epic
  '#0070dd', // 2 – Rare
  '#1eff00', // 3 – Uncommon
  '#9d9d9d', // 4+ – Common
]

function qualityColor(index: number): string {
  return WOW_QUALITY_COLORS[Math.min(index, WOW_QUALITY_COLORS.length - 1)]
}

// Stable hue per character name (cycles through 10 distinct hues)
function nameToHue(name: string): number {
  const HUES = [260, 200, 160, 30, 320, 50, 180, 290, 340, 100]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return HUES[h % HUES.length]
}

function metricFor(jobs: { build_label?: string }[]): string {
  return jobs.some((j) => j.build_label?.startsWith('QE')) ? 'hps' : 'dps'
}

function fmtGain(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* storage unavailable */ }
}

// ── Item label (icon + name + ilvl + source) ─────────────────────────────────

function ItemLabel({ itemId, name, ilvl, stats, source, color, bold, meta, wide }: {
  itemId: number
  name?: string | null
  ilvl?: number | null
  stats?: string | null
  source?: string | null
  color: string
  bold?: boolean
  meta?: ItemMeta
  wide?: boolean
}): JSX.Element {
  const rawName = name ?? meta?.name
  const label = rawName ? rawName.replace(/_/g, ' ') : `Item #${itemId}`
  const icon = iconUrl(meta?.icon)
  const src = source || meta?.source
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <div style={{
        width: wide ? 22 : 18, height: wide ? 22 : 18, flexShrink: 0, borderRadius: 3,
        background: 'var(--surf2)', border: `1px solid ${color}55`, overflow: 'hidden',
      }}>
        {icon && (
          <img src={icon} alt="" width="100%" height="100%"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        )}
      </div>
      <div style={{ minWidth: 0, lineHeight: 1.25 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: wide ? 12 : 11 }}>
          <a
            href={`https://www.wowhead.com/item=${itemId}`}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            style={{ color, textDecoration: 'none', fontWeight: bold ? 600 : 400 }}
          >
            {label}
          </a>
          {ilvl != null && <span style={{ color: 'var(--sub)', marginLeft: 4 }}>({ilvl})</span>}
          {/* Crafted runs sim every stat combination — say which one won. */}
          {stats && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>{stats}</span>}
        </div>
        {src && (
          <div style={{ fontSize: 10, color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {src}
          </div>
        )}
      </div>
    </div>
  )
}

// ── DPS gain bars ────────────────────────────────────────────────────────────

const BAR_LIMIT = 12

function DpsGainBars({ gains, wide = false, metricLabel = 'dps' }: {
  gains: DpsGain[]
  wide?: boolean
  metricLabel?: string
}): JSX.Element {
  const [mounted, setMounted] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const meta = useItemMeta(gains.map((g) => g.item_id))

  // Animate bars in from 0 width
  useEffect(() => {
    setMounted(false)
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [gains])

  const all = [...gains].sort((a, b) => b.dps_gain - a.dps_gain)
  const sorted = showAll ? all : all.slice(0, BAR_LIMIT)
  const maxGain = all[0]?.dps_gain ?? 1
  const labelWidth = wide ? 260 : 190
  const dpsWidth = wide ? 120 : 96

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? 5 : 4 }}>
      {sorted.map((g, index) => {
        const pct = Math.max(4, (g.dps_gain / maxGain) * 100)
        const color = qualityColor(index)
        return (
          <div key={`${g.item_id}-${g.dps_gain}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: labelWidth, flexShrink: 0 }}>
              <ItemLabel
                itemId={g.item_id} name={g.item_name} ilvl={g.ilvl} stats={g.stats}
                source={g.zone_name} color={color} bold={index < 3} meta={meta[g.item_id]} wide={wide}
              />
            </div>
            <div style={{ flex: 1, height: wide ? 12 : 10, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: mounted ? `${pct}%` : '0%',
                height: '100%',
                borderRadius: 3,
                background: `linear-gradient(90deg, ${color}99, ${color})`,
                boxShadow: index === 0 ? `0 0 6px ${color}60` : 'none',
                transition: `width 0.45s cubic-bezier(0.4, 0, 0.2, 1) ${Math.min(index, 20) * 35}ms`,
              }} />
            </div>
            <div style={{
              fontSize: wide ? 12 : 11,
              color: index === 0 ? color : 'var(--sub)',
              width: dpsWidth,
              textAlign: 'right',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: index === 0 ? 700 : 400,
              lineHeight: 1.25,
            }}>
              +{fmtGain(g.dps_gain)} {metricLabel}
              {g.pct != null && (
                <div style={{ fontSize: 10, color: 'var(--sub)', fontWeight: 400 }}>+{g.pct.toFixed(2)}%</div>
              )}
            </div>
          </div>
        )
      })}
      {all.length > BAR_LIMIT && (
        <button
          type="button"
          className="pill"
          onClick={() => setShowAll((v) => !v)}
          style={{ alignSelf: 'flex-start', marginTop: 4 }}
        >
          {showAll ? 'Show top 12' : `Show all ${all.length}`}
        </button>
      )}
    </div>
  )
}

// ── Full-width expanded panel ─────────────────────────────────────────────────

function ExpandedPanel({ job, onClose }: { job: ActiveJob; onClose: () => void }): JSX.Element {
  const upgradeCount = job.dps_gains?.length ?? 0

  return (
    <div style={{
      marginTop: 8,
      background: 'var(--bg)',
      border: '1px solid var(--accent)',
      borderRadius: 6,
      padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <span style={{
          fontWeight: 700, fontSize: 12, color: 'var(--text)',
          fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
        }}>
          {diffLabel(job.difficulty)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>
          {upgradeCount} upgrade{upgradeCount !== 1 ? 's' : ''}
        </span>
        {job.ended_at && (
          <span style={{ fontSize: 11, color: 'var(--sub)' }}>· simmed {timeAgo(job.ended_at)}</span>
        )}
        {job.build_label && job.build_label !== 'Default' && (
          <span style={{ fontSize: 11, color: 'var(--sub)', fontStyle: 'italic' }}>
            · {job.build_label}
          </span>
        )}
        {job.url && (
          <a
            href={job.url}
            onClick={(e) => { e.preventDefault(); window.open(job.url!, '_blank') }}
            style={{ marginLeft: 'auto', marginRight: 8, color: 'var(--accent)', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
          >
            View Report →
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={{
            marginLeft: job.url ? 0 : 'auto',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--sub)', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {job.dps_gains && (
        <DpsGainBars gains={job.dps_gains} wide metricLabel={metricFor([job])} />
      )}
    </div>
  )
}

// ── Diff card ─────────────────────────────────────────────────────────────────

function DiffCard({
  job,
  isExpanded,
  gearChangedAt,
  canRerun,
  onToggle,
  onDelete,
  onRerun,
}: {
  job: ActiveJob
  isExpanded: boolean
  /** When the character's gear profile last changed (ms), if known. */
  gearChangedAt?: number | null
  canRerun: boolean
  onToggle: () => void
  onDelete: () => void
  onRerun: () => void
}): JSX.Element {
  const hasGains = job.status === 'done' && job.dps_gains && job.dps_gains.length > 0
  const [hovered, setHovered] = useState(false)
  const [errorExpanded, setErrorExpanded] = useState(false)
  const isActive = ['queued', 'fetching', 'submitting', 'running'].includes(job.status)
  const gearChanged = !!(gearChangedAt && job.ended_at && gearChangedAt > job.ended_at)
  const stale = job.status === 'done' && (isStale(job.ended_at) || gearChanged)

  const statusColor =
    job.status === 'done'      ? 'var(--green)' :
    job.status === 'error'     ? 'var(--red)'   :
    'var(--sub)'

  const statusText =
    job.status === 'error'     ? 'ERROR' :
    job.status === 'cancelled' ? 'CANCELLED' :
    job.status === 'done'
      ? (hasGains ? `${job.dps_gains!.length} upgrades` : 'NO UPGRADES')
      : job.status.toUpperCase()

  const top = hasGains ? Math.max(...job.dps_gains!.map((g) => g.dps_gain)) : null

  return (
    <div
      data-testid="diff-card"
      data-stale={stale ? 'true' : undefined}
      role={hasGains ? 'button' : undefined}
      tabIndex={hasGains ? 0 : undefined}
      aria-expanded={hasGains ? isExpanded : undefined}
      onClick={() => hasGains && onToggle()}
      onKeyDown={(e) => { if (hasGains && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle() } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: isExpanded ? 'rgba(124, 106, 247, 0.06)' : hovered && hasGains ? 'rgba(255,255,255,0.02)' : 'var(--bg)',
        border: `1px solid ${isExpanded ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '7px 10px',
        flex: '1 1 130px',
        minWidth: 130,
        maxWidth: 200,
        cursor: hasGains ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.12s, opacity 0.15s',
        opacity: stale && !hovered && !isExpanded ? 0.6 : 1,
      }}
    >
      {/* Header row: diff label + chevron + actions */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, gap: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--sub)', textTransform: 'uppercase',
          letterSpacing: '0.06em', fontFamily: 'var(--font-display)', flex: 1,
        }}>
          {diffLabel(job.difficulty)}
        </span>
        {hasGains && (
          <span style={{
            fontSize: 9,
            color: isExpanded ? 'var(--accent)' : 'var(--sub)',
            transition: 'color 0.15s, transform 0.2s',
            display: 'inline-block',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        )}
        {hovered && !isActive && canRerun && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRerun() }}
            title="Re-run this sim"
            aria-label={`Re-run ${diffLabel(job.difficulty)}`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)',
              fontSize: 12, lineHeight: 1, padding: '0 2px', flexShrink: 0,
            }}
          >
            ↻
          </button>
        )}
        {hovered && !isActive && (
          <ConfirmButton
            title="Delete this sim"
            confirmLabel="Delete?"
            className="danger-hover"
            onConfirm={onDelete}
            style={{ fontSize: 11, padding: '0 0 0 2px' }}
          >
            ✕
          </ConfirmButton>
        )}
      </div>

      {/* Status + view link */}
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

      {top != null && (
        <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 2 }}>
          best +{fmtGain(top)}
        </div>
      )}

      {/* Age / staleness */}
      {job.ended_at && !isActive && (
        <div
          style={{ fontSize: 10, color: gearChanged ? 'var(--yellow)' : 'var(--sub)', marginTop: 2 }}
          title={new Date(job.ended_at).toLocaleString()}
        >
          {timeAgo(job.ended_at)}{gearChanged ? ' · gear changed since' : stale ? ' · stale' : ''}
        </div>
      )}

      {job.build_label && job.build_label !== 'Default' && (
        <div style={{ fontSize: 10, color: 'var(--sub)', fontStyle: 'italic', marginTop: 2 }}>
          {job.build_label}
        </div>
      )}

      {job.rerun_error && (
        <div style={{ fontSize: 10, color: 'var(--yellow)', marginTop: 2 }} title={job.rerun_error}>
          ⚠ last re-run failed
        </div>
      )}

      {/* Inline error — replaces window.alert */}
      {job.status === 'error' && job.error_message && (
        <div style={{ marginTop: 4 }}>
          <button
            type="button"
            style={{
              fontSize: 10, color: 'var(--red)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0,
            }}
            onClick={(e) => { e.stopPropagation(); setErrorExpanded((v) => !v) }}
          >
            <span>{errorExpanded ? '▲' : '▼'}</span>
            <span>{errorExpanded ? 'Hide error' : 'Show error'}</span>
          </button>
          {errorExpanded && (
            <div
              style={{
                marginTop: 4,
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.25)',
                borderRadius: 4,
                padding: '5px 7px',
                fontSize: 10,
                color: 'var(--red)',
                lineHeight: 1.4,
                userSelect: 'text',
                WebkitUserSelect: 'text',
                wordBreak: 'break-word',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {job.error_message}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(job.error_message ?? '').catch(() => {})
                }}
                style={{
                  display: 'block', marginTop: 4, background: 'none',
                  border: '1px solid rgba(248,113,113,0.4)', borderRadius: 3,
                  color: 'var(--red)', fontSize: 10, cursor: 'pointer', padding: '2px 6px',
                }}
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Spec sub-group ────────────────────────────────────────────────────────────

function SpecSection({ spec, jobs, gearChangedAt, canRerun, onDeleteJob, onRerunJob }: {
  spec: string
  jobs: ActiveJob[]
  gearChangedAt?: number | null
  canRerun: boolean
  onDeleteJob: (job: ActiveJob) => void
  onRerunJob: (job: ActiveJob) => void
}): JSX.Element {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const sorted = [...jobs].sort((a, b) => diffRank(a.difficulty) - diffRank(b.difficulty))
  const expandedJob = expandedJobId ? sorted.find((j) => j.job_id === expandedJobId) ?? null : null

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <div style={{
          position: 'relative', width: 14, height: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
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
          fontSize: 10, fontWeight: 700, color: 'var(--sub)', textTransform: 'uppercase',
          letterSpacing: '0.08em', fontFamily: 'var(--font-display)',
        }}>
          {spec}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sorted.map((job) => (
          <DiffCard
            key={job.job_id}
            job={job}
            isExpanded={expandedJobId === job.job_id}
            gearChangedAt={gearChangedAt}
            canRerun={canRerun && job.difficulty !== 'all'}
            onToggle={() => setExpandedJobId((prev) => (prev === job.job_id ? null : job.job_id))}
            onDelete={() => onDeleteJob(job)}
            onRerun={() => onRerunJob(job)}
          />
        ))}
      </div>

      {expandedJob && expandedJob.dps_gains && (
        <ExpandedPanel job={expandedJob} onClose={() => setExpandedJobId(null)} />
      )}
    </div>
  )
}

// ── Cross-difficulty views ───────────────────────────────────────────────────

function BestItemsTable({ items, metric }: { items: BestItem[]; metric: string }): JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const meta = useItemMeta(items.map((i) => i.item_id))
  const diffs = diffsOf(items)
  const shown = showAll ? items : items.slice(0, 20)

  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--sub)' }}>No upgrades in these results.</div>
  }

  return (
    <div data-testid="best-items" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ color: 'var(--sub)', textAlign: 'right' }}>
            <th style={{ textAlign: 'left', padding: '0 6px 6px 0', fontWeight: 600 }}>Item</th>
            {diffs.map((d) => (
              <th key={d} style={{ padding: '0 6px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{diffLabel(d)}</th>
            ))}
            <th style={{ padding: '0 0 6px 6px', fontWeight: 600 }}>Best</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((item, i) => (
            <tr key={item.item_id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '5px 6px 5px 0', maxWidth: 280 }}>
                <ItemLabel
                  itemId={item.item_id} name={item.item_name} ilvl={item.ilvl} stats={item.stats}
                  source={item.source} color={qualityColor(i)} bold={i < 3} meta={meta[item.item_id]}
                />
              </td>
              {diffs.map((d) => (
                <td key={d} style={{
                  padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                  color: d === item.difficulty ? 'var(--text)' : 'var(--sub)',
                  fontWeight: d === item.difficulty ? 600 : 400,
                }}>
                  {item.byDiff[d] != null ? `+${fmtGain(item.byDiff[d])}` : '—'}
                </td>
              ))}
              <td style={{ padding: '5px 0 5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: qualityColor(i), fontWeight: 700, whiteSpace: 'nowrap' }}>
                +{fmtGain(item.gain)} {metric}
                {item.pct != null && <div style={{ fontSize: 10, color: 'var(--sub)', fontWeight: 400 }}>+{item.pct.toFixed(2)}%</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > 20 && (
        <button type="button" className="pill" onClick={() => setShowAll((v) => !v)} style={{ marginTop: 6 }}>
          {showAll ? 'Show top 20' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  )
}

function FarmView({ items, metric }: { items: BestItem[]; metric: string }): JSX.Element {
  const meta = useItemMeta(items.map((i) => i.item_id))
  const spots = farmSummary(items, (id) => meta[id]?.source)
  const max = spots[0]?.total ?? 1

  if (spots.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--sub)' }}>No upgrades in these results.</div>
  }

  return (
    <div data-testid="farm-view" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 2 }}>
        Where your upgrades drop, ranked by the total {metric.toUpperCase()} on offer (each item counted at its best difficulty).
      </div>
      {spots.map((spot, i) => (
        <div key={spot.source} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 200, flexShrink: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: i < 3 ? 700 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={spot.source}>
              {spot.source}
            </div>
            <div style={{ fontSize: 10, color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {spot.upgrades} upgrade{spot.upgrades !== 1 ? 's' : ''} · top: {(spot.top.item_name ?? meta[spot.top.item_id]?.name ?? `Item #${spot.top.item_id}`).replace(/_/g, ' ')}
            </div>
          </div>
          <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(3, (spot.total / max) * 100)}%`, height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${qualityColor(i)}99, ${qualityColor(i)})`,
            }} />
          </div>
          <div style={{ width: 110, textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: i === 0 ? qualityColor(0) : 'var(--sub)', fontWeight: i === 0 ? 700 : 400 }}>
            +{fmtGain(spot.total)} total
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Report link export ───────────────────────────────────────────────────────

function useCopyFlash(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function copy(key: string, text: string) {
    if (!text) return
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(null), 1500)
  }

  return [copied, copy]
}

// ── Character section (collapsible + draggable) ───────────────────────────────

type CharView = 'cards' | 'best' | 'farm' | 'history'

const VIEW_LABELS: Record<CharView, string> = {
  cards: 'By difficulty',
  best: 'Best items',
  farm: 'Where to farm',
  history: 'History',
}

interface CharacterSectionProps {
  charId: string
  charName: string
  specMap: Map<string, ActiveJob[]>
  specOrder: string[]
  view: CharView
  gearChangedAt: Record<string, number | null | undefined>
  canRerun: boolean
  isDragOver: boolean
  isDragging: boolean
  onViewChange: (v: CharView) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDeleteJob: (job: ActiveJob) => void
  onRerun: (charIds: string[], difficulties: string[]) => void
}

function CharacterSection({
  charName, specMap, specOrder, view, gearChangedAt, canRerun,
  isDragOver, isDragging, onViewChange,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onDeleteJob, onRerun,
}: CharacterSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [headerHovered, setHeaderHovered] = useState(false)

  const [copied, copy] = useCopyFlash()

  const allJobs = [...specMap.values()].flat()
  const doneCount = allJobs.filter((j) => j.status === 'done').length
  const linkCount = exportableLinks(allJobs).length
  const hue = nameToHue(charName)
  const charAccent = `hsl(${hue}, 60%, 62%)`
  const metric = metricFor(allJobs)

  // Re-run everything shown for this character: its specs × the difficulties it has results for.
  const rerunIds = [...new Set(allJobs.map((j) => j.char_id).filter(Boolean))]
  const rerunDiffs = [...new Set(allJobs.map((j) => j.difficulty).filter((d) => d && d !== 'all'))]
  // QE jobs record difficulty "all"; re-running a healer means re-running its raid passes.
  if (rerunDiffs.length === 0 && allJobs.some((j) => j.difficulty === 'all')) rerunDiffs.push('raid-heroic', 'raid-mythic')

  return (
    <div
      data-testid="character-section"
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        marginBottom: 10,
        background: 'var(--surf)',
        border: `1px solid ${isDragOver ? charAccent : 'var(--border)'}`,
        borderLeft: `3px solid ${isDragOver ? 'hsl(' + hue + ', 80%, 75%)' : charAccent}`,
        borderRadius: 6,
        overflow: 'hidden',
        opacity: isDragging ? 0.35 : 1,
        transition: 'opacity 0.15s, border-color 0.12s',
        boxShadow: isDragOver ? `0 0 0 1px ${charAccent}` : 'none',
      }}
    >
      {/* Header — only the header drags, so text in the body stays selectable */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'grab',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)', userSelect: 'none',
        }}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
      >
        <span aria-hidden style={{
          fontSize: 13, color: headerHovered ? 'var(--sub)' : 'transparent', flexShrink: 0,
          transition: 'color 0.15s', lineHeight: 1, cursor: 'grab',
        }}>
          ⠿
        </span>

        <button
          type="button"
          aria-expanded={!collapsed}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer',
            background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit',
          }}
          onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v) }}
        >
          <span style={{
            fontSize: 13, fontWeight: 700, color: charAccent, flex: 1,
            fontFamily: 'var(--font-display)', letterSpacing: '0.03em',
          }}>
            {charName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--sub)' }}>
            {specMap.size} spec{specMap.size !== 1 ? 's' : ''} · {doneCount}/{allJobs.length} done
          </span>
          <span style={{
            fontSize: 10, color: 'var(--sub)', opacity: 0.7, transition: 'transform 0.2s',
            display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        </button>

        {canRerun && rerunIds.length > 0 && rerunDiffs.length > 0 && (headerHovered) && (
          <button
            type="button"
            className="pill"
            onClick={(e) => { e.stopPropagation(); onRerun(rerunIds, rerunDiffs) }}
            title={`Re-run ${rerunDiffs.map(diffLabel).join(', ')} for ${charName}`}
          >
            ↻ Re-run all
          </button>
        )}

        {linkCount > 0 && (headerHovered || copied) && (
          <button
            type="button"
            className="pill"
            data-ok={copied ? 'true' : undefined}
            onClick={(e) => { e.stopPropagation(); copy('char', formatLinkList(allJobs)) }}
            title={`Copy ${linkCount} Raidbots link${linkCount !== 1 ? 's' : ''}, one per line`}
            style={{ background: 'none' }}
          >
            {copied ? 'Copied ✓' : `⧉ ${linkCount} link${linkCount !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '8px 12px 4px' }}>
          <div role="tablist" aria-label={`${charName} results view`} style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {(Object.keys(VIEW_LABELS) as CharView[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className="pill"
                data-active={view === v}
                onClick={() => onViewChange(v)}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {view === 'cards' && specOrder.map((spec) => (
            <SpecSection
              key={spec}
              spec={spec}
              jobs={specMap.get(spec)!}
              gearChangedAt={gearChangedAt[specMap.get(spec)![0]?.char_id ?? '']}
              canRerun={canRerun}
              onDeleteJob={onDeleteJob}
              onRerunJob={(job) => onRerun([job.char_id], [job.difficulty])}
            />
          ))}
          {/* Specs value items differently, so each gets its own table. */}
          {(view === 'best' || view === 'farm') && specOrder.map((spec) => {
            const items = bestItems(specMap.get(spec)!)
            return (
              <div key={spec} style={{ marginBottom: 12 }}>
                {specOrder.length > 1 && (
                  <div className="section-label" style={{ marginBottom: 6 }}>{spec.toUpperCase()}</div>
                )}
                {view === 'best'
                  ? <BestItemsTable items={items} metric={metric} />
                  : <FarmView items={items} metric={metric} />}
              </div>
            )
          })}
          {view === 'history' && <div style={{ marginBottom: 10 }}><HistoryView charName={charName} metric={metric} /></div>}
        </div>
      )}
    </div>
  )
}

// ── ResultsPanel ─────────────────────────────────────────────────────────────

type SortMode = 'recent' | 'az' | 'upgrades' | 'custom'

interface Props {
  jobs: ActiveJob[]
  characters?: Character[]
  running?: boolean
  onRerun?: (charIds: string[], difficulties: string[]) => void
}

export default function ResultsPanel({ jobs, characters = [], running = false, onRerun }: Props): JSX.Element {
  const deleteJob = useJobStore((s) => s.deleteJob)
  const [diffFilter, setDiffFilter] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [copied, copy] = useCopyFlash()
  const [view, setView] = useState<CharView>(() => {
    const v = lsGet(LS_VIEW) as CharView | null
    return v && v in VIEW_LABELS ? v : 'cards'
  })

  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try { return JSON.parse(lsGet(LS_CHAR_ORDER) ?? '[]') }
    catch { return [] }
  })

  const [sortMode, setSortMode] = useState<SortMode>(() =>
    lsGet(LS_CHAR_ORDER) ? 'custom' : 'recent'
  )

  const draggedIdRef = useRef<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const gearChangedAt = Object.fromEntries(characters.map((c) => [c.id, c.simc_updated_at]))

  const changeView = (v: CharView) => {
    setView(v)
    lsSet(LS_VIEW, v)
  }

  const allDiffs = [...new Set(jobs.map((j) => j.difficulty))].sort((a, b) => diffRank(a) - diffRank(b))

  const q = search.trim().toLowerCase()
  const filtered = jobs.filter((j) =>
    (diffFilter.size === 0 || diffFilter.has(j.difficulty)) &&
    (!q || j.char_name.toLowerCase().includes(q) || (j.spec ?? '').toLowerCase().includes(q)),
  )

  const charOrder: string[] = []
  const byChar = new Map<string, { charName: string; bySpec: Map<string, ActiveJob[]> }>()

  for (const job of filtered) {
    const nameKey = job.char_name
    if (!byChar.has(nameKey)) {
      byChar.set(nameKey, { charName: job.char_name, bySpec: new Map() })
      charOrder.push(nameKey)
    }
    const entry = byChar.get(nameKey)!
    const specKey = job.spec
      ? job.spec.charAt(0).toUpperCase() + job.spec.slice(1)
      : 'Default'
    if (!entry.bySpec.has(specKey)) entry.bySpec.set(specKey, [])
    entry.bySpec.get(specKey)!.push(job)
  }

  const sortedCharIds = [...charOrder].sort((a, b) => {
    if (sortMode === 'custom' && customOrder.length > 0) {
      const ai = customOrder.indexOf(a)
      const bi = customOrder.indexOf(b)
      const aPos = ai === -1 ? charOrder.indexOf(a) + 10000 : ai
      const bPos = bi === -1 ? charOrder.indexOf(b) + 10000 : bi
      return aPos - bPos
    }
    if (sortMode === 'az') return byChar.get(a)!.charName.localeCompare(byChar.get(b)!.charName)
    if (sortMode === 'upgrades') {
      const aUp = [...byChar.get(a)!.bySpec.values()].flat().reduce((s, j) => s + (j.dps_gains?.length ?? 0), 0)
      const bUp = [...byChar.get(b)!.bySpec.values()].flat().reduce((s, j) => s + (j.dps_gains?.length ?? 0), 0)
      return bUp - aUp
    }
    return 0
  })

  function handleDragStart(charId: string, e: React.DragEvent) {
    draggedIdRef.current = charId
    setDraggedId(charId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(charId: string, e: React.DragEvent) {
    if (!draggedIdRef.current) return
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
    const base = [...sortedCharIds]
    const from = base.indexOf(sourceId)
    const to = base.indexOf(targetId)
    if (from === -1 || to === -1) return
    const next = [...base]
    next.splice(from, 1)
    next.splice(to, 0, sourceId)
    setCustomOrder(next)
    setSortMode('custom')
    lsSet(LS_CHAR_ORDER, JSON.stringify(next))
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
    lsSet(LS_CHAR_ORDER, null)
  }

  function toggleDiff(diff: string) {
    setDiffFilter((prev) => {
      const next = new Set(prev)
      if (next.has(diff)) next.delete(diff)
      else next.add(diff)
      return next
    })
  }

  // Jobs in the order they appear on screen, so exported links read top-to-bottom
  const orderedJobs = sortedCharIds.flatMap((charId) => {
    const { bySpec } = byChar.get(charId)!
    return [...bySpec.keys()].sort().flatMap((spec) =>
      [...bySpec.get(spec)!].sort((a, b) => diffRank(a.difficulty) - diffRank(b.difficulty)),
    )
  })
  const linkCount = exportableLinks(orderedJobs).length
  const charCount = new Set(jobs.map((j) => j.char_name)).size

  const showControls = allDiffs.length > 1 || charCount > 1 || linkCount > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Controls bar */}
      {showControls && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 8px', flexShrink: 0, flexWrap: 'wrap' }}>
          {charCount > 3 && (
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find character…"
              aria-label="Filter results by character or spec"
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 10, width: 140,
                border: '1px solid var(--border)', background: 'var(--surf2)', color: 'var(--text)',
                outline: 'none', userSelect: 'text',
              }}
            />
          )}

          {allDiffs.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span className="section-label">FILTER</span>
              {allDiffs.map((diff) => (
                <button key={diff} type="button" className="pill" data-active={diffFilter.has(diff)} onClick={() => toggleDiff(diff)}>
                  {DIFF_LABELS[diff] ?? diff}
                </button>
              ))}
              {diffFilter.size > 0 && (
                <button type="button" className="pill" aria-label="Clear filter" onClick={() => setDiffFilter(new Set())} style={{ background: 'none' }}>✕</button>
              )}
            </div>
          )}

          {linkCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
              <span className="section-label">EXPORT</span>
              <button
                type="button"
                className="pill"
                data-ok={copied === 'links' ? 'true' : undefined}
                onClick={() => copy('links', formatLinkList(orderedJobs))}
                title={`Copy ${linkCount} Raidbots report link${linkCount !== 1 ? 's' : ''}, one per line — paste into a bulk droptimizer importer`}
              >
                {copied === 'links' ? 'Copied ✓' : `⧉ ${linkCount} link${linkCount !== 1 ? 's' : ''}`}
              </button>
              <button
                type="button"
                className="pill"
                data-ok={copied === 'discord' ? 'true' : undefined}
                onClick={() => copy('discord', formatDiscordMessage(orderedJobs, DIFF_LABELS))}
                title="Copy the same links with character / spec / difficulty labels, ready to post in Discord"
              >
                {copied === 'discord' ? 'Copied ✓' : '⧉ Discord'}
              </button>
            </div>
          )}

          {charCount > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: linkCount > 0 ? 0 : 'auto' }}>
              <span className="section-label">SORT</span>
              {(['recent', 'az', 'upgrades'] as SortMode[]).map((mode) => {
                const label = mode === 'recent' ? 'Recent' : mode === 'az' ? 'A→Z' : 'Upgrades'
                return (
                  <button key={mode} type="button" className="pill" data-active={sortMode === mode} onClick={() => setSortMode(mode)}>
                    {label}
                  </button>
                )
              })}
              {sortMode === 'custom' && (
                <button type="button" className="pill" data-active onClick={clearCustomOrder} title="Clear the dragged order">
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
                view={view}
                gearChangedAt={gearChangedAt}
                canRerun={!!onRerun && !running}
                onViewChange={changeView}
                isDragging={draggedId === charId}
                isDragOver={dragOverId === charId}
                onDragStart={(e) => handleDragStart(charId, e)}
                onDragOver={(e) => handleDragOver(charId, e)}
                onDrop={(e) => handleDrop(charId, e)}
                onDragEnd={handleDragEnd}
                onDeleteJob={(job) => deleteJob(job.job_id, job.char_id, job.difficulty, job.build_label, job.char_name, job.spec ?? '')}
                onRerun={(ids, diffs) => onRerun?.(ids, diffs)}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
