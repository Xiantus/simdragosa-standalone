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

interface Props {
  job: ActiveJob
}

interface ItemMeta { name: string; icon?: string | null; source?: string | null }

function ItemTooltip({ itemId, icon, name, source, ilvl }: {
  itemId: number; icon?: string | null; name: string; source?: string | null; ilvl?: number | null
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const iconUrl = icon
    ? `https://wow.zamimg.com/images/wow/icons/medium/${icon}.jpg`
    : null

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}
      onMouseEnter={(e) => { setHovered(true); setPos({ x: e.clientX, y: e.clientY }) }}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Item label */}
      <a
        href={`https://www.wowhead.com/item=${itemId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--text)', textDecoration: hovered ? 'underline' : 'none', cursor: 'pointer' }}
      >
        {name}
      </a>
      {ilvl != null && <span style={{ color: 'var(--sub)', marginLeft: 4 }}>({ilvl})</span>}

      {/* Floating tooltip */}
      {hovered && (
        <div style={{
          position: 'fixed',
          left: pos.x + 14,
          top: pos.y - 8,
          zIndex: 9999,
          background: '#1a1a2e',
          border: '1px solid #a855f7',
          borderRadius: 8,
          padding: '8px 10px',
          minWidth: 180,
          maxWidth: 260,
          boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {iconUrl && (
              <img
                src={iconUrl}
                width={36} height={36}
                style={{ borderRadius: 4, border: '1px solid #333', flexShrink: 0 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', lineHeight: 1.3 }}>{name}</div>
              {ilvl != null && (
                <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 2 }}>Item Level {ilvl}</div>
              )}
              {source && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, lineHeight: 1.4 }}>
                  📍 {source}
                </div>
              )}
              <div style={{ fontSize: 10, color: '#475569', marginTop: 5 }}>Click to open on Wowhead</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DpsGainBars({ gains }: { gains: DpsGain[] }): JSX.Element {
  const [meta, setMeta] = useState<Record<number, ItemMeta>>({})

  useEffect(() => {
    const unknownIds = gains
      .filter((g) => !g.item_name)
      .map((g) => g.item_id)
      .filter((id, i, arr) => arr.indexOf(id) === i)

    if (unknownIds.length === 0) return

    window.api.fetchItemNames(unknownIds).then((result) => {
      if (Object.keys(result).length > 0) setMeta(result)
    }).catch(() => {})
  }, [gains])

  const sorted = [...gains].sort((a, b) => b.dps_gain - a.dps_gain).slice(0, 12)
  const maxGain = sorted[0]?.dps_gain ?? 1

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {sorted.map((g) => {
        const pct = Math.max(4, (g.dps_gain / maxGain) * 100)
        const hue = 260 - (sorted.indexOf(g) / Math.max(sorted.length - 1, 1)) * 80
        const itemMeta = meta[g.item_id]
        const rawName = g.item_name ?? itemMeta?.name
        const label = rawName ? rawName.replace(/_/g, ' ') : `Item #${g.item_id}`

        return (
          <div key={`${g.item_id}-${g.dps_gain}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Item name + ilvl */}
            <div style={{
              width: 160, fontSize: 11,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <ItemTooltip
                itemId={g.item_id}
                icon={itemMeta?.icon}
                name={label}
                source={itemMeta?.source}
                ilvl={g.ilvl}
              />
            </div>

            {/* Bar */}
            <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 3,
                background: `hsl(${hue}, 70%, 55%)`,
                transition: 'width 0.3s ease',
              }} />
            </div>

            {/* DPS number */}
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

export default function ResultRow({ job }: Props): JSX.Element {
  const diffLabel = DIFF_LABELS[job.difficulty] ?? job.difficulty
  const [expanded, setExpanded] = useState(false)

  const hasGains = job.status === 'done' && job.dps_gains && job.dps_gains.length > 0

  const statusColor =
    job.status === 'done' ? 'var(--green)' :
    job.status === 'error' ? 'var(--red)' :
    'var(--sub)'

  return (
    <div style={{
      padding: '8px 12px', borderRadius: 6, marginBottom: 6,
      background: 'var(--surf)', border: '1px solid var(--border)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
              {job.char_name}
            </span>
            {job.spec && (
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                {job.spec.charAt(0).toUpperCase() + job.spec.slice(1)}
              </span>
            )}
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

        {/* Toggle expand button */}
        {hasGains && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sub)', fontSize: 11, padding: '2px 6px',
              borderRadius: 4, flexShrink: 0,
            }}
            title={expanded ? 'Hide upgrades' : 'Show upgrades'}
          >
            {job.dps_gains!.length} upgrades {expanded ? '▲' : '▼'}
          </button>
        )}

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

      {/* DPS gain bars — collapsed by default, expand on click */}
      {hasGains && expanded && (
        <DpsGainBars gains={job.dps_gains!} />
      )}
    </div>
  )
}
