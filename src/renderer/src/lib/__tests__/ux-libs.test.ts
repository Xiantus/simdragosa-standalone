import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadLastSelection, saveLastSelection, loadPresets, savePresets, upsertPreset, pruneSelection,
  lastDifficulties, DEFAULT_DIFFS,
} from '../selection'
import { changedSlots, parseGear } from '../simcDiff'
import { bestItems, farmSummary, diffsOf } from '../resultsAgg'
import { timeAgo, isStale, formatDuration } from '../time'
import { batchProgress, typicalJobMs } from '../../components/ActiveJobsStrip'
import type { ActiveJob } from '../../stores/useJobStore'

beforeEach(() => localStorage.clear())

describe('selection persistence', () => {
  it('defaults to Heroic with nothing selected', () => {
    expect(loadLastSelection()).toEqual({ chars: [], diffs: DEFAULT_DIFFS })
  })

  it('round-trips the last selection', () => {
    saveLastSelection({ chars: ['a-fire'], diffs: ['raid-mythic'] })
    expect(loadLastSelection()).toEqual({ chars: ['a-fire'], diffs: ['raid-mythic'] })
    expect(lastDifficulties()).toEqual(['raid-mythic'])
  })

  it('falls back to defaults on corrupt storage', () => {
    localStorage.setItem('simdragosa:last-selection', '{not json')
    expect(loadLastSelection().diffs).toEqual(DEFAULT_DIFFS)
    localStorage.setItem('simdragosa:presets', '"nope"')
    expect(loadPresets()).toEqual([])
  })

  it('an empty saved difficulty list still sims something', () => {
    saveLastSelection({ chars: [], diffs: [] })
    expect(lastDifficulties()).toEqual(DEFAULT_DIFFS)
  })

  it('upserts presets by name, case-insensitively', () => {
    let p = upsertPreset([], { name: 'Main ', chars: ['a'], diffs: ['raid-heroic'] })
    p = upsertPreset(p, { name: 'main', chars: ['b'], diffs: ['raid-mythic'] })
    expect(p).toEqual([{ name: 'main', chars: ['b'], diffs: ['raid-mythic'] }])
    savePresets(p)
    expect(loadPresets()).toEqual(p)
  })

  it('drops deleted characters from a selection', () => {
    expect(pruneSelection({ chars: ['a', 'gone'], diffs: ['x'] }, ['a'])).toEqual({ chars: ['a'], diffs: ['x'] })
  })
})

describe('simc gear diff', () => {
  const before = [
    'mage="Xian"',
    'head=,id=1001,bonus_id=1/2,enchant_id=5',
    'trinket1=,id=2001,bonus_id=9',
    '# head=,id=9999',
  ].join('\n')

  it('reads equipped slots only, ignoring commented bag items', () => {
    expect(Object.keys(parseGear(before))).toEqual(['head', 'trinket1'])
  })

  it('reports nothing when only ordering or irrelevant fields differ', () => {
    const after = before.replace('id=1001,bonus_id=1/2,enchant_id=5', 'enchant_id=5,id=1001,bonus_id=1/2,context=3')
    expect(changedSlots(before, after)).toEqual([])
  })

  it('names swapped, added and removed slots', () => {
    const after = [
      'head=,id=1002,bonus_id=1/2',
      'main_hand=,id=3001',
    ].join('\n')
    expect(changedSlots(before, after)).toEqual(['head', 'trinket 1', 'main hand'])
  })
})

describe('results aggregation', () => {
  const jobs = [
    { difficulty: 'raid-heroic', status: 'done', dps_gains: [
      { item_id: 1, dps_gain: 500, ilvl: 321, zone_name: 'Boss A' },
      { item_id: 2, dps_gain: 300, ilvl: 321, zone_name: 'Boss B' },
    ] },
    { difficulty: 'raid-mythic', status: 'done', dps_gains: [
      { item_id: 1, dps_gain: 900, ilvl: 334, pct: 1.5 },
      { item_id: 3, dps_gain: 200, ilvl: 334, zone_name: 'Boss A' },
    ] },
    { difficulty: 'raid-normal', status: 'error', dps_gains: [{ item_id: 4, dps_gain: 9999, ilvl: 1 }] },
  ]

  it('keeps each item at its best difficulty, with per-difficulty gains', () => {
    const best = bestItems(jobs)
    expect(best.map((b) => b.item_id)).toEqual([1, 2, 3])
    expect(best[0]).toMatchObject({ gain: 900, difficulty: 'raid-mythic', ilvl: 334, pct: 1.5, source: 'Boss A' })
    expect(best[0].byDiff).toEqual({ 'raid-heroic': 500, 'raid-mythic': 900 })
    expect(diffsOf(best)).toEqual(['raid-heroic', 'raid-mythic'])
  })

  it('ranks farm spots by total gain and fills missing sources', () => {
    const spots = farmSummary(bestItems(jobs), (id) => (id === 2 ? 'Fallback' : null))
    expect(spots.map((s) => [s.source, s.upgrades, s.total])).toEqual([
      ['Boss A', 2, 1100],
      ['Boss B', 1, 300],
    ])
  })
})

describe('time helpers', () => {
  const now = 1_000_000_000_000
  it('formats relative ages', () => {
    expect(timeAgo(now - 5_000, now)).toBe('just now')
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5m ago')
    expect(timeAgo(now - 3 * 3600_000, now)).toBe('3h ago')
    expect(timeAgo(now - 2 * 86400_000, now)).toBe('2d ago')
    expect(timeAgo(undefined, now)).toBe('')
  })
  it('flags results older than a week as stale', () => {
    expect(isStale(now - 8 * 86400_000, now)).toBe(true)
    expect(isStale(now - 6 * 86400_000, now)).toBe(false)
  })
  it('formats durations', () => {
    expect(formatDuration(65_000)).toBe('1m 05s')
    expect(formatDuration(9_000)).toBe('9s')
  })
})

describe('batch progress', () => {
  const job = (over: Partial<ActiveJob>): ActiveJob => ({
    job_id: Math.random().toString(), char_id: 'c', char_name: 'C', difficulty: 'raid-heroic',
    build_label: 'Default', status: 'queued', log_lines: [], started_at: 0, ...over,
  })

  it('learns the typical duration from finished jobs, ignoring restored ones', () => {
    expect(typicalJobMs([])).toBe(4 * 60_000)
    expect(typicalJobMs([
      job({ status: 'done', started_at: 0, ended_at: 120_000 }),
      job({ status: 'done', started_at: 5, ended_at: 5 }), // restored from DB
    ])).toBe(120_000)
  })

  it('counts the batch in flight and estimates time left', () => {
    const now = 1_000_000
    const jobs = [
      job({ status: 'done', started_at: now - 200_000, ended_at: now - 20_000 }),   // 180 s
      job({ status: 'running', started_at: now - 200_000 }),
      job({ status: 'queued', started_at: now - 200_000, difficulty: 'professionMidnightEpic-331' }),
      job({ status: 'done', started_at: 10, ended_at: 10 }), // old result, not this batch
    ]
    const p = batchProgress(jobs, now)
    expect(p.done).toBe(1)
    expect(p.total).toBe(3)
    // crafted job: 6 × 180 s − 200 s elapsed
    expect(p.etaMs).toBe(6 * 180_000 - 200_000)
  })
})
