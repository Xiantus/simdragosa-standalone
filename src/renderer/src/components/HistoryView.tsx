import React, { useEffect, useState } from 'react'
import type { SimHistoryEntry } from '../../../shared/ipc'
import { diffLabel, diffRank } from '../lib/difficulties'

interface Props {
  charName: string
  metric: string
}

const W = 220
const H = 44

/**
 * One small line chart per difficulty: the best single upgrade over time.
 * When it trends to zero the character has run out of upgrades there.
 */
export default function HistoryView({ charName, metric }: Props): JSX.Element {
  const [rows, setRows] = useState<SimHistoryEntry[] | null>(null)

  useEffect(() => {
    let live = true
    window.api.getSimHistory(charName)
      .then((r) => { if (live) setRows(r ?? []) })
      .catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [charName])

  if (rows === null) return <div style={{ fontSize: 12, color: 'var(--sub)' }}>Loading history…</div>

  const byDiff = new Map<string, SimHistoryEntry[]>()
  for (const r of rows) {
    if (r.difficulty === 'all') continue
    const key = `${r.difficulty}|${r.spec}`
    if (!byDiff.has(key)) byDiff.set(key, [])
    byDiff.get(key)!.push(r)
  }

  if (byDiff.size === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
        No history yet — every sim from now on is recorded here, so you can watch upgrades dry up over the season.
      </div>
    )
  }

  const series = [...byDiff.entries()].sort(([a], [b]) => diffRank(a.split('|')[0]) - diffRank(b.split('|')[0]))

  return (
    <div data-testid="history-view" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {series.map(([key, pts]) => {
        const [diff, spec] = key.split('|')
        const last = pts[pts.length - 1]
        const first = pts[0]
        const max = Math.max(...pts.map((p) => p.top_gain), 1)
        const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * (W - 8) + 4)
        const y = (v: number) => H - 4 - (v / max) * (H - 10)
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.top_gain).toFixed(1)}`).join(' ')
        const delta = last.top_gain - first.top_gain
        return (
          <div key={key} style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '8px 10px', width: W + 22,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span className="section-label">{diffLabel(diff).toUpperCase()}</span>
              {spec && <span style={{ fontSize: 10, color: 'var(--sub)' }}>{spec}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--sub)' }}>
                {pts.length} sim{pts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <svg width={W} height={H} role="img" aria-label={`Best upgrade over time, ${diffLabel(diff)}`}>
              <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.8} strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p.top_gain)} r={2.4} fill="var(--accent)">
                  <title>{`${new Date(p.ended_at).toLocaleDateString()} — top +${Math.round(p.top_gain).toLocaleString()} ${metric}, ${p.upgrades} upgrades`}</title>
                </circle>
              ))}
            </svg>
            <div style={{ display: 'flex', fontSize: 11, color: 'var(--sub)', marginTop: 2, gap: 8 }}>
              <span>Top now <b style={{ color: 'var(--text)' }}>+{Math.round(last.top_gain).toLocaleString()}</b></span>
              <span>{last.upgrades} upgrades</span>
              {pts.length > 1 && (
                <span style={{ marginLeft: 'auto', color: delta <= 0 ? 'var(--green)' : 'var(--yellow)' }}
                  title="Change in the best available upgrade since the first recorded sim — falling means you are gearing up">
                  {delta <= 0 ? '▼' : '▲'} {Math.abs(Math.round(delta)).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
