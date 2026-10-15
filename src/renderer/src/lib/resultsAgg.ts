// Cross-difficulty views over one character's results: the best version of
// every item, and which boss / dungeon holds the most upgrade value.

import type { DpsGain } from '../../../shared/ipc'
import { diffRank } from './difficulties'

export interface AggJob {
  difficulty: string
  status: string
  dps_gains?: DpsGain[]
}

export interface BestItem {
  item_id: number
  item_name: string | null
  /** Best gain over every difficulty it was simmed at. */
  gain: number
  pct: number | null
  difficulty: string
  ilvl: number | null
  source: string | null
  stats: string | null
  /** difficulty → gain, for the per-track columns. */
  byDiff: Record<string, number>
}

export function bestItems(jobs: AggJob[]): BestItem[] {
  const byId = new Map<number, BestItem>()
  for (const job of jobs) {
    if (job.status !== 'done') continue
    for (const g of job.dps_gains ?? []) {
      const cur = byId.get(g.item_id)
      if (!cur) {
        byId.set(g.item_id, {
          item_id: g.item_id,
          item_name: g.item_name ?? null,
          gain: g.dps_gain,
          pct: g.pct ?? null,
          difficulty: job.difficulty,
          ilvl: g.ilvl ?? null,
          source: g.zone_name ?? null,
          stats: g.stats ?? null,
          byDiff: { [job.difficulty]: g.dps_gain },
        })
        continue
      }
      cur.byDiff[job.difficulty] = Math.max(cur.byDiff[job.difficulty] ?? 0, g.dps_gain)
      cur.item_name ??= g.item_name ?? null
      cur.source ??= g.zone_name ?? null
      if (g.dps_gain > cur.gain) {
        Object.assign(cur, {
          gain: g.dps_gain, pct: g.pct ?? null, difficulty: job.difficulty,
          ilvl: g.ilvl ?? null, stats: g.stats ?? null,
        })
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.gain - a.gain)
}

export interface FarmSpot {
  source: string
  upgrades: number
  /** Sum of each item's best gain — "how much DPS is sitting in here". */
  total: number
  top: BestItem
}

/**
 * Group the best-per-item list by where it drops.  `sourceOf` fills in a
 * source for items whose sim row did not carry one (QE results, old rows).
 */
export function farmSummary(
  items: BestItem[],
  sourceOf: (itemId: number) => string | null | undefined = () => null,
): FarmSpot[] {
  const spots = new Map<string, FarmSpot>()
  for (const item of items) {
    const source = item.source || sourceOf(item.item_id) || 'Unknown source'
    const spot = spots.get(source)
    if (!spot) {
      spots.set(source, { source, upgrades: 1, total: item.gain, top: item })
    } else {
      spot.upgrades++
      spot.total += item.gain
      if (item.gain > spot.top.gain) spot.top = item
    }
  }
  return [...spots.values()].sort((a, b) => b.total - a.total)
}

/** Difficulties present in a set of best items, in display order. */
export function diffsOf(items: BestItem[]): string[] {
  return [...new Set(items.flatMap((i) => Object.keys(i.byDiff)))].sort((a, b) => diffRank(a) - diffRank(b))
}
